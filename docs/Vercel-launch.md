# Kinlume: public launch with Vercel

Prepared October 24, 2026 for the current project. This is a deployment plan, not confirmation of a live deployment.

## What was added

- `/terms.html` and `/privacy.html` are readable without sign-in, work without client JavaScript, and are linked from account forms, the survey, and Settings.
- `src/data/legal.json` is the editable source. Operator name and public email are intentionally empty at the owner's request. The pages prominently say Draft; they do not claim registered company or trademark status.
- `scripts/generate-legal.mjs` generates the pages before development startup and production builds. After changing policy text during an existing dev session, run `npm run legal:generate`.
- The copyright notice is `© 2026 Kinlume`. Third-party materials keep their own ownership and licenses. The registered trademark symbol is not used.
- `.vercelignore` excludes the local database, environment files and historical backups from direct Vercel uploads. `.gitignore` also excludes deployment-specific environment files. Ignore files do not remove secrets already tracked by Git; inspect the repository before publishing.

These are draft documents describing current implementation, not a claim of legal compliance or a finished public policy. A public operator/contact method, practical data-request process, appropriate retention practices and review must be completed before collecting public registrations. Do not add an agreement checkbox to a draft and treat that as completed consent. Hosting, database and email providers must be reflected once selected.

## Why the current app cannot simply be uploaded as a finished Vercel service

Vercel can build and serve the React/Vite interface. The current backend is a continuously running Node HTTP server on port 3001 and uses `.data/community.sqlite`. Vercel Functions cannot provide this file with the persistent, shared filesystem semantics needed by the app. Moving SQLite to `/tmp` would lose or split account/donation records and is not a solution.

The development Vite proxy to localhost is also not a deployed API. Uploading only `dist` produces the interface and legal pages, but not working accounts, donations, AI or live resource search.

Vercel source: https://vercel.com/kb/guide/is-sqlite-supported-in-vercel

## Recommended architecture

- Vercel: React static interface and server API functions.
- Supabase: hosted PostgreSQL plus authentication.
- Server-only Groq configuration: AI requests remain behind a server endpoint.

Supabase is a proposed next step; it is not connected to the current app. A separate persistent backend host could preserve more of the existing Node/SQLite code, but would add another hosted service to manage. Do not create subscriptions, enable paid fallback, publish data, or migrate private records without the owner's authorization.

## Implementation order

1. Preserve the local database and app. Use an isolated test database with fictional demo users for the first cloud migration. Do not commit/upload the current `.data` folder or `.env.server`.
2. Create hosted tables for private profiles, organizations, resources, requests, pledges and deliveries. Keep each record's owner relationship explicit. Convert SQLite-specific persistence to PostgreSQL queries.
3. Connect Supabase Auth for sign-in, verification and password recovery. Configure site and redirect URLs for the final domain. Existing custom scrypt accounts do not automatically become Supabase users; plan account migration/re-enrollment separately and do not silently move real accounts.
4. Enable row-level security and test it. A person can read/edit their own private profile and manage only their own organization. Public queries expose only intended published listing fields. Never put a service-role key in React or a `VITE_` variable. Service-role operations bypass RLS and need explicit server authorization.
5. Preserve atomic donation accounting. A database transaction/function must recheck outstanding need before accepting a pledge and recheck pending quantity before recording a receipt. Separate serverless requests must not overfill a request during concurrent writes. RLS alone does not validate these totals.
6. Adapt the Node routing into Vercel Functions for resources, photos, chat, planning and community actions. Reuse pure validation/matching modules. Do not start `http.createServer().listen()` inside a request handler. Verify hosted authentication on every protected action and replace localhost-only origin checks with the exact approved domains. In-memory caches and rate-limit maps are not shared reliably across instances; use a suitable shared mechanism for public-service limits.
7. Keep client requests same-origin under `/api`. This avoids making browser cookies depend on an unrelated API domain. If custom cookies remain, make them Secure on HTTPS and review CSRF/session settings. Do not replace origin validation with a wildcard.
8. Import the source repository into Vercel after reviewing tracked files for secrets and private data. Choose Vite, build command `npm run build`, output directory `dist`. The source must contain the implemented API functions, not only static assets. Use the lockfile for installation.
9. Set production/preview environment variables in the hosting dashboard. Store `GROQ_API_KEY` and privileged database credentials as server-only secrets. Only intentionally public configuration belongs in `VITE_` variables. Do not upload `.env.server` to supply production secrets.
10. Configure authentication email delivery and test verification/recovery from an external mailbox. Review provider sending restrictions and current plan limits; do not assume unlimited sending.
11. Finish the legal documents with the actual operator/contact and deployed data practices. Add an account-data export/deletion request process and retention/backup policy. Review third-party data licensing, attribution and launch-contact requirements.
12. Use an HTTPS preview for final testing, then publish the approved production deployment. Verify every API route, deep links, sign-in/recovery, ownership, two-account donations, concurrent quantity checks, provider failures, phone layouts, install behavior and data persistence after redeployment.

## Where you will manage things

- Vercel dashboard: deployments, domain, environment variables and function diagnostics.
- Supabase dashboard (after integration): hosted tables, auth users, access policies and email configuration.
- Kinlume organization dashboard: organization listings, requests, pledges and receipts.

A Vercel preview URL/domain is enough to test the hosted app; a custom domain can follow. Check current provider limits and terms before choosing a plan. No hosting account, subscription, database migration or public deployment was performed as part of adding the legal pages.

## Official references

- Vercel frontend support: https://vercel.com/docs/frameworks/frontend
- Vercel environment variables: https://vercel.com/docs/environment-variables
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase row-level security: https://supabase.com/docs/guides/database/postgres/row-level-security
- Trademark symbols: https://www.uspto.gov/trademarks/basics/what-trademark
- Children's privacy considerations: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
