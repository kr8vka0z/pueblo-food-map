// cloudflare-env.d.ts — the one hand-written type for the Worker's env: every
// binding, var and secret in wrangler.jsonc, as `CloudflareEnv` (read by
// src/lib/cloudflareContext.ts's getCloudflareContext(), cloudflare-workers.d.ts's
// `import { env } from "cloudflare:workers"`, and custom-worker.ts's handlers),
// plus the `process.env` typing for the secrets and vars read that way.
// Add a new binding, var or secret here in the same PR that adds it to
// wrangler.jsonc.
//
// WHY hand-written, not `wrangler types`: this app also targets the DOM
// (tsconfig `lib: ["dom", ...]` — Mapbox, forms, etc.). Wrangler's runtime
// types include Cloudflare's HTMLRewriter `Element` type, which collides with
// lib.dom's `Element` and silently corrupts unrelated DOM types across the
// whole project (observed: every `as HTMLSelectElement` cast in the form tests
// broke, plus src/components/Map.tsx's GeoJSON typing — see #237 checkpoint c
// report). Without the runtime types, the generated file names types it can't
// resolve (`Fetcher`, `Ai`) and drops secrets that exist only as Worker
// secrets, so it had to be hand-patched after every run anyway. Instead, the
// few runtime types used are imported by name from
// @cloudflare/workers-types/experimental, which adds no globals.
import type {
  D1Database as CFD1Database,
  Fetcher,
  R2Bucket as CFR2Bucket,
} from "@cloudflare/workers-types/experimental";
import type { AiBinding } from "@/lib/eventTranslate";

declare global {
  type D1Database = CFD1Database;
  type R2Bucket = CFR2Bucket;

  interface CloudflareEnv {
    // Bindings (prod and env.staging each declare their own).
    ADMIN_DB: D1Database;
    BOX_PHOTOS: R2Bucket;
    EVENT_FLYERS: R2Bucket;
    ASSETS: Fetcher;
    // #757 Workers AI binding ("Suggest Spanish" on the admin event form,
    // src/lib/eventTranslate.ts). Typed with the one method used: the runtime
    // `Ai` type needs the full runtime types (see header). Optional because
    // local dev and tests have no binding and the route treats that as a
    // clean 503.
    AI?: AiBinding;

    // Vars. #318 passkey isolation: BETTER_AUTH_RP_ID is set on staging only,
    // so it is undefined on prod (auth-options.ts, isProductionWorker).
    BETTER_AUTH_RP_ID?: string;
    // #485 comma-separated IP/CIDR list custom-worker.ts's /ingest proxy checks
    // via src/lib/ipMatch.ts before forwarding to PostHog.
    ANALYTICS_EXCLUDED_IPS?: string;
    CF_ANALYTICS_ACCOUNT_ID: string;
    POSTHOG_PROJECT_ID: string;
    // #679 the one account that sees /admin/activity (src/lib/adminOwner.ts).
    ADMIN_OWNER_EMAIL?: string;

    // Secrets (docs/agents/secrets.md). HC_PING_URL is prod only.
    POSTHOG_API_HOST?: string;
    NEXT_PUBLIC_MAPBOX_TOKEN: string;
    RESEND_API_KEY: string;
    HC_PING_URL?: string;
  }

  // Wrangler's convention: `Cloudflare.Env` is the env type workerd's
  // `cloudflare:workers` module types against; GlobalProps names the entry.
  namespace Cloudflare {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type -- an alias by declaration merging, Wrangler's own pattern
    interface Env extends CloudflareEnv {}
    interface GlobalProps {
      mainModule: typeof import("./custom-worker");
    }
  }

  // workerd mirrors vars and secrets into process.env (AGENTS.md "Runtime
  // reads"). Optionality matches what wrangler used to generate: tests set
  // RESEND_API_KEY with vi.stubEnv because a required key can't be deleted.
  namespace NodeJS {
    interface ProcessEnv {
      BETTER_AUTH_RP_ID?: string;
      ANALYTICS_EXCLUDED_IPS: string;
      CF_ANALYTICS_ACCOUNT_ID: string;
      POSTHOG_PROJECT_ID: string;
      POSTHOG_API_HOST?: string;
      NEXT_PUBLIC_MAPBOX_TOKEN: string;
      RESEND_API_KEY: string;
      HC_PING_URL?: string;
    }
  }
}

export {};
