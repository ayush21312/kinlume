# Helping Hand: global search, AI, and the competition plan

Updated October 19, 2026.

Current AI/planner setup: see Monday-AccessIQ-and-AI.md. Groq is now connected. No local model is installed; do not download a local runtime or model without the user’s approval.

## What changed

The app now remembers the last city you searched instead of resetting to Hackensack.
Tap the location beneath the resource search box, enter a city and country, and press
Search. Examples: London, UK; Paris, France; Toronto, Canada. US city/state and ZIP
searches still work. The keyword box filters the selected area's results; it does not
change the location.

US searches use Feed America and the existing researched listings. UK searches add
Give Food's food-bank locations. Worldwide searches use OpenStreetMap community-service
data. When detailed map queries fail, the app can show named community facilities
from Photon's place index. These have **unconfirmed services**: they are not labeled
as food pantries or free benefits programs. A food-only filter can therefore return
no results even when generic community facilities exist in the area.

There is no connected source that guarantees every pantry, program, or opportunity
worldwide. An empty search means no matching listing was returned by these providers,
not that help does not exist. Programs, eligibility rules, language support and
directory partnerships need country-by-country expansion.

Sources remain linked in each detail page. Existing photo matching works with these
new listings too, but a real location photo is not guaranteed.

## How one search works

1. `LocationSearch.jsx` calls `setLocation` when you press Search.
2. `useResourceSearch.js` saves that location in this browser and requests `/api/resources`.
3. `resourceSearch.js` selects a provider for the resolved country.
4. `internationalResources.js` translates each international provider's different
   fields into the same resource object that React already understands.
5. React renders those objects as cards and map pins. Saved places retain their
   details after you change cities or reload.

This shared resource shape is the key idea: adding a provider should not require
rewriting every screen. Unknown hours, eligibility and availability stay unknown.
Donation requests indicate what an organization wants donated; they never prove what
someone can collect.

The public services are appropriate for a small demonstration. The code caches and
bounds searches. A widely used public app needs a hosted or self-hosted search service,
provider agreements where necessary, and stronger service monitoring. The location
and map endpoints can be changed in server environment settings.

Provider documentation:

- [Photon API and demonstration-server limits](https://github.com/komoot/photon)
- [Give Food API](https://www.givefood.org.uk/api/2/docs/)
- [Public Overpass services](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [OpenStreetMap attribution and ODbL](https://www.openstreetmap.org/copyright)

## A free AI API key is not the same as unlimited free AI

### Gemini: a limited free hosted option with important restrictions

Eligible developers can visit [Google AI Studio](https://aistudio.google.com/apikey),
sign in, select/create a project, and create an API key. The free tier covers selected
models within its usage limits. Do not enable billing if your intention is to stay
on the free tier, and check the project's current tier and quotas.

However, Google's current terms require API users to be 18+, prohibit API apps
directed toward or likely to be accessed by under-18s, and prohibit sending sensitive,
confidential or personal information through unpaid services. Apps serving the EEA,
Switzerland or UK must use paid services. These restrictions make Gemini's free tier
unsuitable as Helping Hand's default public assistant. Creating a parent's key does
not remove the app's audience restrictions. Gemini has **not** been connected here.

- [Create a Gemini key](https://ai.google.dev/gemini-api/docs/api-key)
- [Free-tier pricing and limits](https://ai.google.dev/gemini-api/docs/pricing)
- [Age, region and data-use terms](https://ai.google.dev/gemini-api/terms)

Never paste a secret key into chat, React source files or a Git repository.

### OpenAI: already supported, separately billed

The existing server adapter supports OpenAI. An API key authenticates requests;
it does not guarantee free usage. ChatGPT subscriptions and API billing are separate.
If an eligible account has promotional credits, check that account's billing page
for the actual amount and expiry rather than assuming credits are included.

Keep `OPENAI_API_KEY` and `OPENAI_MODEL` in `.env.server`, never in a `VITE_` variable.
Restart the server after editing it. No paid requests or purchases were made here.

[OpenAI billing guidance](https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform)

### Local AI: connected in code, no API key required

The new optional Ollama adapter runs a model on your computer. This avoids per-request
AI API fees; it still uses your computer's memory, storage and electricity. It needs
installation and a model download before it will work. Quality and response speed
depend on the model and your hardware. A local computer must stay running to serve it.

1. Install [Ollama for Windows](https://ollama.com/download/windows).
2. Download a model, for example `ollama pull qwen3:4b` in a terminal. This particular
   download is approximately 2.5 GB; smaller models are available if needed.
3. Open `.env.server` in the project, keeping any existing secrets private. Add or
   update these two settings:

   ```dotenv
   AI_PROVIDER=ollama
   OLLAMA_MODEL=qwen3:4b
   ```

4. Keep Ollama running and restart Helping Hand's API server. If starting the app
   from scratch, use `npm run dev`.
5. Open Assistant and try a nonsensitive example such as “Find food near London, UK.”
   Successful AI replies show the AI badge and “AI runs on this computer.” If the
   model is unavailable, the app explicitly falls back to resource-search replies.

The adapter has been checked with simulated model responses. A real model has not
been installed or tested on this computer, so this is prepared integration, not an
already-running AI assistant. Resource searches still contact external directory
providers; local AI does not make those searches offline.

[Ollama local chat API](https://docs.ollama.com/api/chat) ·
[Qwen3 4B download](https://ollama.com/library/qwen3:4b)

## Your Sunday–Thursday blueprint: honest status and next steps

| Day | Current status | Work remaining |
| --- | --- | --- |
| Sunday: Resource Finder | Cards, details, filters, saves, map and API search exist. International coverage is partial. | Improve reliable country providers and verify services; do not claim worldwide completeness. |
| Monday: AccessIQ | Conversational resource search and optional AI adapters exist. | Build the practical visit planner: needs, travel mode, time window, access needs, clear matching rules and confirmation steps. |
| Tuesday: Donation Hub | Official giving links and a local nonprofit draft exist. | Add real organization-managed item requests and a complete donate-items workflow. Your later request to remove pledges overrides the old blueprint's pledge feature. |
| Wednesday: Dashboard and persistence | Saved places/preferences persist in this browser. | Add a shared database, sign-in, organization ownership rules, verification workflow and editing dashboard. |
| Thursday: Test and demonstrate | Search/data tests and production build checks run. | Test the completed end-to-end workflows on narrow screens, then prepare the demo and explain limitations. |

**Next coding priority: Monday's AccessIQ planner.** Begin with transparent rules:
filter by need and service area; reject explicitly incompatible access conditions;
evaluate a visit only when reliable hours and travel information exist; otherwise
ask the user to confirm missing details. Never invent bus routes or travel times.
AI can explain recommendations, but the rules should still work without an AI model.

For learning, trace “Find food near London, UK” from the composer to the server,
provider adapter, normalized resource object, response, and rendered listing. Then
try an unknown city and explain why the error cannot safely fall back to New Jersey.
