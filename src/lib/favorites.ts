/**
 * Favorites store (#132) — on-device venue bookmarks, no accounts.
 *
 * Persists a list of favorited venue ids to localStorage under
 * "pfm.favorites.v1". SSR-safe (all reads guard for window). Exposed to React
 * via useSyncExternalStore so every FavoriteButton + the Saved list (later
 * slice) stay in sync, including across tabs (storage event).
 */

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "pfm.favorites.v1";

// Stable empty snapshot. Referential stability matters for useSyncExternalStore:
// returning a fresh [] on each read would loop.
const EMPTY: readonly string[] = Object.freeze([]);

// Module-singleton cache of the current list. null = not yet read from storage.
// Only replaced when the set actually changes, so snapshots stay stable.
let cache: readonly string[] | null = null;

const listeners = new Set<() => void>();
let storageBound = false;

function readFromStorage(): readonly string[] {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return EMPTY;
    const ids = parsed.filter((x): x is string => typeof x === "string");
    return ids.length > 0 ? Object.freeze(ids) : EMPTY;
  } catch {
    return EMPTY;
  }
}

function getSnapshot(): readonly string[] {
  if (cache === null) cache = readFromStorage();
  return cache;
}

function getServerSnapshot(): readonly string[] {
  return EMPTY;
}

function emit(): void {
  for (const listener of listeners) listener();
}

function handleStorage(e: StorageEvent): void {
  // e.key === null when storage is cleared wholesale.
  if (e.key === STORAGE_KEY || e.key === null) {
    cache = null; // force re-read on next snapshot
    emit();
  }
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (!storageBound && typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
    storageBound = true;
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && storageBound && typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
      storageBound = false;
    }
  };
}

function persist(next: readonly string[]): void {
  cache = next.length > 0 ? Object.freeze([...next]) : EMPTY;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cache));
    } catch {
      // ignore quota / private-mode write failures
    }
  }
  emit();
}

// ─── Imperative API ────────────────────────────────────────────────────────

export function getFavorites(): readonly string[] {
  return getSnapshot();
}

export function isFavorite(id: string): boolean {
  return getSnapshot().includes(id);
}

export function addFavorite(id: string): void {
  const current = getSnapshot();
  if (current.includes(id)) return;
  persist([...current, id]);
}

export function removeFavorite(id: string): void {
  const current = getSnapshot();
  if (!current.includes(id)) return;
  persist(current.filter((x) => x !== id));
}

/** Toggle a venue's favorited state; returns the NEW state (true = now saved). */
export function toggleFavorite(id: string): boolean {
  const current = getSnapshot();
  if (current.includes(id)) {
    persist(current.filter((x) => x !== id));
    return false;
  }
  persist([...current, id]);
  return true;
}

// ─── React bindings ──────────────────────────────────────────────────────────

/** Subscribe to the full favorites list (component re-renders on any change). */
export function useFavorites(): readonly string[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Subscribe to a single venue's favorited state. */
export function useIsFavorite(id: string): boolean {
  return useFavorites().includes(id);
}

/** @internal test-only — reset module state + storage between tests. */
export function __resetFavoritesForTests(): void {
  cache = null;
  listeners.clear();
  storageBound = false;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
}
