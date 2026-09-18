"use client";

/**
 * useBoxPhotos — client-side fetch of a single box's approved photo history
 * (GET /api/public/blessing-boxes/[id]/photos, Blessing Boxes slice 5).
 * Mirrors useBoxVenues.ts's shape exactly (fetch-on-mount, best-effort,
 * cancel flag on unmount) — this list isn't filter-driven the way
 * useBoxActivity's is, so there's no need for that hook's filters-key
 * re-fetch machinery. The route itself caps the response at
 * MAX_HISTORY_PHOTOS (src/lib/boxPhotos.ts) — this hook has no pagination
 * of its own; BoxPhotoGrid.tsx's "Show more photos" button only reveals
 * more of the already-fetched array.
 */

import { useEffect, useState } from "react";

export interface BoxPhotoListItem {
  id: number;
  createdAt: string;
}

export interface UseBoxPhotosResult {
  photos: BoxPhotoListItem[];
  loading: boolean;
}

export function useBoxPhotos(boxId: string): UseBoxPhotosResult {
  const [state, setState] = useState<{ boxId: string; photos: BoxPhotoListItem[] }>({ boxId, photos: [] });

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/public/blessing-boxes/${encodeURIComponent(boxId)}/photos`)
      .then((res) => (res.ok ? (res.json() as Promise<{ photos: BoxPhotoListItem[] }>) : null))
      .then((data) => {
        if (cancelled) return;
        setState({ boxId, photos: data?.photos ?? [] });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ boxId, photos: [] });
      });

    return () => {
      cancelled = true;
    };
  }, [boxId]);

  const loading = state.boxId !== boxId;
  return { photos: loading ? [] : state.photos, loading };
}
