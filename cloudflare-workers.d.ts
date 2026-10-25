// cloudflare-workers.d.ts — types for workerd's built-in `cloudflare:workers` module, the two exports
// src/lib/cloudflareContext.ts uses.
//
// WHY declared by hand: the full declaration ships with @cloudflare/workers-types' global runtime types, which collide
// with lib.dom (see cloudflare-env.d.ts). Kept as a script file (no import/export) so this is an ambient module.
declare module "cloudflare:workers" {
  export const env: CloudflareEnv;
  export function waitUntil(promise: Promise<unknown>): void;
}
