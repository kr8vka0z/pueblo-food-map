-- migrations/0003_better_auth_schema.sql
--
-- Better Auth engine schema (#314 Phase 1) -- provisions the tables the
-- self-hosted Better Auth library needs to eventually replace Cloudflare
-- Access on the admin surface. This migration only creates the tables; it
-- does not change how anything is authenticated. Cloudflare Access
-- continues to gate /admin/** unmodified through this phase and the
-- phases after it, until an explicit later cutover (see AGENTS.md's
-- Better Auth section for the phase breakdown).
--
-- Generated via `npx @better-auth/cli generate` against
-- scripts/auth-cli.config.ts (an in-memory better-sqlite3 database, not
-- ADMIN_DB -- see that file's header WHY for why generation can't target
-- D1 directly). Reviewed by hand for D1 compatibility: no BEGIN/COMMIT
-- (D1 disallows interactive transactions; this output has none), and every
-- statement is a plain CREATE TABLE / CREATE INDEX D1 executes as-is.
--
-- Tables: user, session, account, verification (core Better Auth) plus
-- passkey (the @better-auth/passkey plugin, WebAuthn credentials).
-- `verification` also backs the magicLink plugin's sign-in tokens --
-- magicLink adds no table of its own. No sendMagicLink implementation or
-- login UI exists yet (Phase 2); this phase only needs the schema so the
-- shape is correct once that lands. All rows live in this same
-- pueblo-food-map-admin D1 database -- no Workers KV anywhere.
--
-- Applying this migration -- NOT part of a Worker deploy, same as
-- 0001/0002 (see AGENTS.md "Public submissions queue" -- "Applying the
-- migration" note): a D1 schema migration is independent of `wrangler
-- deploy`. Local: `npx wrangler d1 migrations apply pueblo-food-map-admin
-- --local`. Remote/production: deliberately NOT applied in Phase 1 --
-- explicit handoff item, applied at a later phase's merge.

create table "user" ("id" text not null primary key, "name" text not null, "email" text not null unique, "emailVerified" integer not null, "image" text, "createdAt" date not null, "updatedAt" date not null);

create table "session" ("id" text not null primary key, "expiresAt" date not null, "token" text not null unique, "createdAt" date not null, "updatedAt" date not null, "ipAddress" text, "userAgent" text, "userId" text not null references "user" ("id") on delete cascade);

create table "account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" date, "refreshTokenExpiresAt" date, "scope" text, "password" text, "createdAt" date not null, "updatedAt" date not null);

create table "verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" date not null, "createdAt" date not null, "updatedAt" date not null);

create table "passkey" ("id" text not null primary key, "name" text, "publicKey" text not null, "userId" text not null references "user" ("id") on delete cascade, "credentialID" text not null, "counter" integer not null, "deviceType" text not null, "backedUp" integer not null, "transports" text, "createdAt" date, "aaguid" text);

create index "session_userId_idx" on "session" ("userId");

create index "account_userId_idx" on "account" ("userId");

create index "verification_identifier_idx" on "verification" ("identifier");

create index "passkey_userId_idx" on "passkey" ("userId");

create index "passkey_credentialID_idx" on "passkey" ("credentialID");