/**
 * WebGL availability probe — canvas-based, version-independent.
 *
 * WHY canvas probe instead of mapboxgl.supported():
 * mapboxgl.supported() was removed in mapbox-gl v3. The canvas probe works
 * across all library versions and does not require the mapbox-gl bundle to be
 * loaded first.
 *
 * WHY SSR returns true:
 * We must not pre-render the fallback banner on the server. The server has no
 * WebGL context; returning true on the server lets both SSR and the first
 * client paint assume WebGL is available, avoiding a hydration mismatch. A
 * client useEffect then calls isWebGLAvailable() and switches to the fallback
 * only if WebGL is genuinely absent on this device.
 */

/**
 * Returns true if a WebGL rendering context can be obtained on this device,
 * false if WebGL is unavailable or throws during probing.
 *
 * Safe to call in SSR (returns true when window/document are absent).
 */
export function isWebGLAvailable(): boolean {
  // SSR guard — assume supported so server + first client render agree.
  if (typeof window === "undefined" || typeof document === "undefined") {
    return true;
  }

  try {
    const canvas = document.createElement("canvas");
    const ctx =
      (canvas.getContext("webgl2") as WebGL2RenderingContext | null) ??
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ??
      (canvas.getContext(
        "experimental-webgl",
      ) as WebGLRenderingContext | null);
    // Free the probe context immediately — on GPUs with a small context budget,
    // a leaked probe context can starve Mapbox's own context and cause a false
    // "unavailable" fallback. (Panel finding, Codex.)
    if (ctx) {
      // Cast to a minimal interface; real WebGL contexts always have getExtension,
      // but test doubles may not — the optional chain guards both cases.
      (ctx as { getExtension?: (s: string) => { loseContext(): void } | null })
        .getExtension?.("WEBGL_lose_context")?.loseContext();
      canvas.width = 0;
      canvas.height = 0;
    }
    return ctx !== null;
  } catch {
    // Some environments throw during getContext (e.g. privacy-hardened browsers).
    return false;
  }
}
