# Kinlume

A phone-width React app with international resource search (partial coverage) and a conversational helper.

## Run

Use Node 24 or later. Run npm install once and npm run dev to start React and the
local API together. Vite's default address is http://127.0.0.1:5173/.
If a preview is already running on 5174, it uses the same API on port 3001.
Run npm test and npm run build before sharing code changes.

## International search and AI setup

Read `docs/Global-search-and-AI.md` for the current coverage limits, free AI choices,
local Ollama setup, an explanation of the new code, and an honest blueprint status.
US searches use Feed America; UK searches add Give Food. Other countries use mapped
OpenStreetMap community services. When detailed map queries fail, Photon can return
community facilities whose assistance type is explicitly unconfirmed. An empty food
filter does not mean no food assistance exists. The last searched city is saved locally.

## What is connected

- Feed America supplies food-assistance and program records by city/state or ZIP.
  Five-minute server caches limit repeated requests. Only selected modes are fetched;
  we do not import the entire country into the browser.
- Locally sourced Bergen records enrich duplicate API results. Their hours and source
  links are preserved rather than overwritten by an older provider record.
- Programs supports WIC, health centers, school meals, summer meals, SNAP/benefit
  agency directories, energy assistance, and job-center referrals. Health services
  are not represented as automatically free, and school meals may require enrollment.
- Opportunities links to current volunteer directories and CFA's volunteer page.
  These are sourced referrals, not a live API feed of individual job/volunteer postings.
- The map works outside Bergen County. Only records with real coordinates get pins;
  online directories do not get invented map locations.
- Saved places keep their IDs and API record snapshots on this device. This lets an
  Austin place remain saved when the main search returns to New Jersey.
- Wikimedia Commons is a key-free automatic photo source. Lookup starts only when
  a stock-image card becomes visible. A match needs name agreement, nearby geographic
  coordinates, and an accepted public-domain/Creative Commons license. Credits and
  license links appear in the detail page. Many small organizations have no matching
  Commons photo, so stock fallbacks and the existing researched photos remain useful.
- The assistant opens directly as a conversation. There is no questionnaire or full
  resource grid underneath. Without an AI key it runs clearly labeled Resource search
  mode: simple intent/location parsing plus real directory results, not simulated AI.

These are directory listings, not guaranteed current inventory or eligibility decisions.
Feed America records can be duplicated, incomplete, or inconsistent. Review primary
organization information when resolving conflicts. No partners are automatically verified.

## Monday: AccessIQ and hosted AI

Assistant now includes a visit-planning form, deterministic matching rules, time-window and round-trip checks, access preferences, and practical steps. Groq supplies hosted AI explanations using the private server key. Read docs/Monday-AccessIQ-and-AI.md for the current workflow, code explanation, tests and limits. No local model is downloaded or installed by the app. Ask the user before any future large download.

## Other AI provider (optional)

For an OpenAI alternative, set AI_PROVIDER=openai, OPENAI_API_KEY and OPENAI_MODEL in the private .env.server file. The example defaults to Groq.
Restart the API server. The key stays on the server, never in a VITE_ browser variable.
Chat works in directory mode without this setup. With AI configured, recent messages
and selected resource facts are sent to OpenAI using store:false. This does not mean
zero provider retention. Saved questionnaire answers are stored in the private account database; chat transcripts are not saved on disk.
Chats stay in React memory until reload. Directory mode sends the requested town/type
to the selected directory and location provider; photo lookup sends resource names/cities to Wikimedia, not chat text.

The development server is loopback-only. Public deployment still needs HTTPS, operational backups, privacy controls, email recovery and organization verification. Accounts and SQLite storage now work on the local server.
Public hosting, live transit routing and actual model fine-tuning are not implemented. Hosted Groq replies and Monday’s AccessIQ planner are connected.

## Follow the code

1. App.jsx owns the selected page, keyword, saved IDs, and conversation.
2. useResourceSearch fetches /api/resources when the location/category/program changes.
   It cancels old searches so a slower response cannot replace a newer city.
3. server/resourceSearch.js calls Feed America, caches responses, and remembers records.
4. resourceData.js normalizes provider fields and merges equivalent records. Unknown
   values remain unknown; a SNAP retailer does not become a free food pantry.
5. ResourceImage requests /api/photos/:id only when a card is visible. photos.js looks
   up licensed Commons images and refuses weak matches. React renders plain-text credits.
6. AssistantView sends conversation turns to /api/assistant. chat.js extracts a basic
   location/need and searches the same directory. Optional AI uses only those candidates.
7. programs.json contains explicitly sourced program/opportunity referrals; resources.json
   contains the original Bergen snapshot. Neither is presented as an API of live openings.

Exercises: trace a location change from LocationSearch to Feed America; explain why
the preferred organization source survives a duplicate merge; follow one Commons photo
from filename/location matching to its credit; explain how Resource search differs from AI.

Source documentation and photo credits are in DATA_SOURCES.md and ASSETS.md.

## Tuesday update — October 20

The donation workflow supports local supply requests, item pledges, partial receipts,
and cancellations, with separate requested, outstanding pledged, and received totals.
See docs/Tuesday-Donations.md for the data flow, verification, and remaining shared-account work.
The interface now calls assistance planning Visit planner. Bottom navigation uses a
fixed screen row. Donation data remains on this browser; sign-in and organization
ownership are Wednesday's work. This update supersedes earlier donation-only-link descriptions.

## Wednesday update — October 21

Organization accounts, server-side ownership checks, and persistent records are now
connected. Open Donate → Organization to sign in, edit your profile, add/edit
resources, manage supply requests, and record deliveries. Records are saved in the
private .data/community.sqlite database (Node 24 or newer is required). Resources
start as drafts; enable Show in resource searches to include them in this app's
directory. Existing outside directory listings remain read-only.

See docs/Wednesday-Organizations.md for a code walkthrough, earlier device-data
import, verification, and hosting limits. This update supersedes earlier statements
that accounts or shared donation records are not implemented. It is still a local
server; public hosting, email recovery, and organization verification are not connected.

## Account setup and private preferences

The app now opens with sign-in and registration. Guests can still browse resources.
New accounts complete a questionnaire before account actions. Help seekers choose needs,
an area and travel preferences; household range and circumstances are optional. Donors
and organization managers only choose their purpose and an optional preferred name.

Profiles are stored in the private SQLite database, owned by the signed-in account.
Settings → Edit preferences lets people update their answers. The survey seeds resource
search and the Visit planner; individual visit dates and chats remain session-only.
AI personalization is opt-in. Names, email and private notes are excluded from automatic
AI context. Explicit chat messages and attached visit preferences go to the configured
AI provider when chatting. See docs/Accounts-and-Survey.md for a readable walkthrough.

## Interface motion

Small page fades, image fades, button feedback and loading states are defined in
`src/motion.css`, loaded after the existing theme. `LoadingIndicator.jsx` provides
a shared accessible spinner or assistant dots. `ResourceSkeleton.jsx` mirrors the
two-column cards while an uncached search loads. No animation library is required.

The main page is keyed by destination so its entrance runs on navigation. The
phone shell and bottom navigation are never transformed; their dimensions stay
fixed. Survey answers remain in React state as each step enters. Animations and
transitions are disabled under the device prefers-reduced-motion setting.

### App opening transition

`AppLaunch.jsx` shows a centred Kinlume title while account data loads.
After a brief 700 ms opening, it measures the actual header and moves the title
into place over 680 ms as the black screen fades. Slow requests reveal the
existing loading UI after four seconds. It runs only on page opening, not on
sign-in or tab changes. Reduced-motion users skip the opening animation.
The animation uses CSS in `src/launch.css`; no package or download is needed.

### Natural chat and explicit visit discussions

Greetings bypass directory lookup but still use the configured AI. Saved survey
preferences remain background context; they do not automatically build a visit plan.
Only Discuss this plan attaches the current plan to a chat. New chat clears that
attachment. Provider/privacy details remain in Settings rather than below the composer.

### Employment chat and AI recovery

Paid job requests use employment referrals rather than volunteering or career
clothing. Bergen Job Center and NJ Job Source are sourced in DATA_SOURCES.md.
These are service/portal referrals; individual live vacancies are not imported.

Groq output_parse_failed, json_validate_failed and tool_use_failed errors recover
with one JSON-object retry on the same configured model. Tool calls are disabled;
all replies still pass the server parser and known-resource-ID checks. Network
failures get one retry; credential, configuration and quota failures do not.
Diagnostics include only provider/status/error codes, never prompts or keys.

## Current visual system

The responsive redesign is documented in DESIGN.md. Start with
src/design-system.css for tokens, page layout and controls; src/motion.css and
src/launch.css handle motion separately. PageHeading and EmptyState share the
common screen structure. ResourceCard provides the two-column image-led grid.
The old styles.css and interface.css are retained as references but are no longer
loaded. The APIs, data model and account/organization rules are unchanged.

## Installation, spelling and technical walkthrough

See docs/Technical-walkthrough.md for the complete implementation explanation.
The app now supplies a standalone web app manifest and PNG phone icons. Settings
shows Install Kinlume when the browser offers installation. A real phone needs a
reachable HTTPS deployment; this does not add offline resource/account access.
Home offers explicit corrections for common service-word typos, without guessing
city names. Chat and narrative fields request browser spelling assistance.
All 93 tests and the production build passed after these refinements.


## Hosted backend

Vercel uses api/handler.js and vercel.json to serve /api requests. Hosted mode
requires SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, APP_ORIGINS and configured AI
variables as server secrets. Apply supabase/migrations/20261024_kinlume.sql once
to a new project. Supabase Auth manages hosted accounts; local SQLite accounts
are preserved separately. Cloud workspaces use version checks to prevent lost
updates and overpledging. All browser database access is denied by default;
verified server-side ownership rules control every mutation. The health endpoint
checks connectivity without returning account data. See docs/Hosted-backend.md.
