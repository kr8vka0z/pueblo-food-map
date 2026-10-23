// cloudflareWorkersStub.ts — test-only stand-in for workerd's built-in `cloudflare:workers` module (vitest.config.mts alias).
//
// WHY: vitest runs in Node, which has no `cloudflare:workers`, so any test that merely imports a module reaching
// src/lib/cloudflareContext.ts would fail to load. Tests that need bindings mock cloudflareContext.ts itself; this stub
// only lets the import resolve, and throws if code actually reads a binding, the way a real call outside a Worker fails.
export const env: Record<string, unknown> = new Proxy({}, {
  get(_t, prop) {
    throw new Error(`cloudflare:workers env.${String(prop)} read in a test; mock src/lib/cloudflareContext.ts instead`);
  },
});

export function waitUntil(): void {
  throw new Error("cloudflare:workers waitUntil called in a test; mock src/lib/cloudflareContext.ts instead");
}
