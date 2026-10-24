# Hosted backend

Vercel serves Kinlume's React interface and API functions. Supabase Auth manages hosted accounts; PostgreSQL stores private profiles and organization/donation workspaces. Local development retains its separate SQLite database and existing local accounts.

## Code flow

`api/handler.js` maps Vercel's rewritten route to `server/index.js`. `cloudCommunityApi.js` dispatches hosted account/profile/donation actions. `cloudSession.js` verifies the access token with Supabase and rotates refresh tokens when needed. Hosted cookies are Secure, HttpOnly and SameSite=Strict. `cloudStore.js` accesses the database with a server-only credential.

`workspaceAction.js` shares authorization and validation with the local SQLite implementation. PostgreSQL writes use conditional version checks: a competing pledge must reload and revalidate the latest remaining need. Network failures with an uncertain write result are not blindly retried.

## Setup

Production Vercel Secrets: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_ORIGINS, AI_PROVIDER, GROQ_API_KEY and GROQ_MODEL. APP_ORIGINS is an exact comma-separated allowlist; preview deployments need separate approved configuration. Privileged keys never belong in VITE_ variables or Git.

Apply supabase/migrations/20261024_kinlume.sql once to the new database. The profiles, workspaces and rate-limit tables all have RLS enabled and deny direct anonymous/authenticated client access. Only the server role accesses them; every protected API mutation must therefore keep verifying the caller and ownership.

Set Supabase Auth's Site URL to the production URL. Keep email confirmation enabled. New hosted accounts confirm their email and then sign in. Password-recovery UI, custom SMTP, organization verification and account export/deletion UI are separate unfinished features.

GET /api/health checks database connectivity without returning account data. GET /api/assistant/status checks provider/model readiness. Neither alone proves every workflow works.

## Storage and scale

kinlume_profiles holds validated private surveys keyed to the verified user. kinlume_workspaces holds organization/resource/request/pledge/receipt JSON with a version counter. kinlume_rate_limits holds short-lived counters keyed by a hashed network bucket or global service bucket.

The workspace model preserves the prototype's rules. A large deployment should normalize tables and scope/paginate public listing queries. Further production work includes idempotency identifiers, an audit log, backups, appropriate retention and data-request controls.

Local users are not automatically migrated to Supabase. Never upload .data/community.sqlite. Hosted users create hosted accounts. Legal documents remain drafts until operator/contact details and public request procedures are completed.
