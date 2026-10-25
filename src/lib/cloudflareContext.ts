// cloudflareContext.ts — the one place server code gets the Worker's bindings (env) and waitUntil.
//
// WHY a local helper with OpenNext's old name and shape: under vinext the Worker runs our code directly in workerd,
// so bindings come from the native `cloudflare:workers` module rather than an adapter. Keeping
// `getCloudflareContext()` (sync) and `getCloudflareContext({ async: true })` (Promise) means callers didn't change,
// and tests mock this one module (vitest runs in Node, where `cloudflare:workers` doesn't exist).
//
// WHY both call forms: this codebase calls it both ways (route handlers destructure the sync form, auth/adminDb await
// the async one). An async-only helper would hand every sync caller a Promise, and `env.ADMIN_DB` would be undefined.
import { AsyncLocalStorage } from "node:async_hooks";
import { env, waitUntil } from "cloudflare:workers";

type CloudflareContext = {
  env: CloudflareEnv;
  ctx: { waitUntil(promise: Promise<unknown>): void };
  /** The current request's `request.cf` (geo etc.), or undefined outside a request. */
  cf: unknown;
};

// WHY: OpenNext's context carried `request.cf`, and auth.ts reads it for the sign-in log's geo (#679). workerd has no
// ambient per-request `cf`, so custom-worker.ts stores it here around each fetch (runWithRequestCf).
const requestCf = new AsyncLocalStorage<unknown>();

export function runWithRequestCf<T>(cf: unknown, fn: () => T): T {
  return requestCf.run(cf, fn);
}

export function getCloudflareContext(): CloudflareContext;
export function getCloudflareContext(opts: { async: true }): Promise<CloudflareContext>;
export function getCloudflareContext(opts?: { async: true }): CloudflareContext | Promise<CloudflareContext> {
  const context: CloudflareContext = { env, ctx: { waitUntil }, cf: requestCf.getStore() };
  return opts?.async ? Promise.resolve(context) : context;
}
