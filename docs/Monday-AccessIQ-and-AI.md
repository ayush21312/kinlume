# Helping Hand: Monday’s AccessIQ and AI

## What is finished

Assistant now has two modes: **Chat** and **Plan a visit**. Chat uses the Groq key
stored privately in `.env.server`. The model runs on Groq’s servers. No local AI
model is installed, and the downloaded Ollama runtime has been removed. Ask before
any future large download. Starting the app does not install or download models.

AccessIQ works independently of the AI model. It collects the help needed, starting
area, transportation, visit date, available time, travel limit, and step-free access
preference. More preferences include visit length, service groups and a time-zone
override. Preferences and chat stay in this React session; they disappear on reload.

## Try one complete workflow

1. Open Assistant → Plan a visit.
2. Choose Food, Hackensack, Car, a forthcoming weekday, 9:00–17:00, and 30 minutes
   each way. Press Find a plan.
3. Read why an option matches and its practical steps. Open Resource details or
   Directions. Save a resource if useful; returning from details preserves the plan.
4. Choose Discuss this plan. The assistant receives your preferences, the server’s
   planning results, and the relevant directory facts. It explains those results.
5. Edit the available window to 9:00–9:05. AccessIQ should report that no visit fits.
   Open “Why other visits were left out” to see the specific reasons.
6. Try public transportation. Without a usable route and travel time, the app marks
   the option as needing confirmation instead of inventing a bus route. Enter the
   longer one-way time from outward/return directions and use Recheck.

## The matching rules, in plain English

- Keep resources matching at least one selected need.
- Keep online directories separate from physical visits; no invented map pins.
- Leave out senior/veteran services unless that group was selected. This filtering
  is not a determination of eligibility: the organization must confirm its rules.
- Leave out listings reporting an access barrier when step-free access is needed.
  Unknown access remains a confirmation task.
- For walking/car travel, estimate from the search-area centre. The formula uses
  straight-line distance × 1.4, approximately 3 mph walking or 20 mph driving, plus
  a small buffer, rounded up to five minutes. These are assumptions, not live routes.
- For transit, rides or an unknown mode, do not invent a route or travel time.
  A user-entered time is explicitly identified as user-entered. A ride still has to
  be arranged; entering a time does not book transportation.
- Allow time to travel out, complete the visit, and return before “Back by.”
- Read only unambiguous opening-hour patterns. Explicit closure and a closing time
  that cannot accommodate the visit rule out that option. Monthly, appointment-only,
  incomplete and unusual schedules require confirmation.
- Rank options by how many needs they cover, usable hours/access information, then
  travel time. Being closest does not rescue a closed or impossible visit.
- Return up to three separate visit options with reasons, cautions and steps. These
  are alternatives, not a combined multi-stop itinerary.

Every plan still asks users to confirm current hours, supplies, eligibility and any
appointment. Published hours and calculated travel estimates cannot prove that an
organization will be open or able to serve someone.

## Follow one action through the code

**Action: press Find a plan.**

1. `VisitPlanner.jsx` holds the editable form and sends its answers to `/api/plan`.
2. `server/index.js` accepts the request only from the local app, checks its size,
   validates the preferences, and asks the directory for real resource records.
3. `plannerValidation.js` checks needs, dates, clock times, limits and time zones.
   It discards extra fields, so the browser cannot submit invented listing facts.
4. `visitPlanner.js` applies the rules above and ranks the remaining options.
5. `openingWindows.js` reads supported schedules conservatively.
6. `plannerTime.js` compares actual times in explicit IANA time zones. It handles
   overnight hours and rejects skipped/repeated daylight-saving clock times.
7. React receives the plan and displays the explanations. App.jsx retains the valid
   preferences and result while you navigate to details and back.

**Action: press Discuss this plan.**

1. AssistantView sends the question and attached preferences to `/api/assistant`.
2. The server searches again and recomputes the rules. It does not trust a plan or
   organization facts supplied by the browser.
3. Only the selected visit options and online referrals enter the AI catalog.
   Rejected visits cannot be returned as linked recommendations.
4. `aiProvider.js` calls Groq with the key in an authorization header, never React.
5. The model returns structured JSON. `readModelReply` validates it and allows
   references only to IDs supplied by the server.
6. The chat displays the reply and resource links. Free-tier limits or network
   failures produce a clearly labeled resource-search fallback; AccessIQ still works.

This is a specialized, directory-grounded assistant, not a fine-tuned model. Keeping
organization facts in current directory records is more useful than training a model
to memorize hours that can change.

## Why the time-zone helper exists

The server can run in a different time zone from a resource. A 9 a.m. visit in Los
Angeles must not become 9 a.m. in New Jersey. The small time-zone lookup dependency
(about 88 KB unpacked) estimates an IANA zone from the search location. The UI labels
automatic zones as estimated; users can override the resource-area zone near borders.
The browser does not download geographic datasets or AI model weights.

## AI setup and privacy

The current private server settings select Groq and `openai/gpt-oss-20b`. The example
file contains blank credentials. Never put a real key into the example file, Git,
React source, a `VITE_` variable or a chat message. Restart the local API after editing
`.env.server`. An API key authenticates your account; available quota depends on your
provider plan. No billing upgrade or automatic paid-provider fallback was configured.

The AI status indicator checks the provider connection and model availability.
“AI connected” means that check succeeded; quota can still be exhausted later. Chat
explains when messages and attached preferences are sent to Groq. Do not enter identity
documents, account numbers or other unnecessary personal information.

- [Groq free-tier limits](https://console.groq.com/docs/rate-limits)
- [Groq data handling](https://console.groq.com/docs/your-data)
- [Groq account requirements](https://console.groq.com/docs/legal/services-agreement)
- [Structured AI replies](https://console.groq.com/docs/structured-outputs)
- [Time-zone lookup documentation and accuracy limits](https://github.com/photostructure/tz-lookup)

## What was checked

Automated checks cover closed hours, overnight schedules, missing hours, impossible
round trips, travel limits, missing transit routes, user-entered travel times, access
barriers, multiple needs, restricted groups, appointments, invalid input, daylight
saving, online referrals, secret handling, model response validation and quota errors.
Real Groq requests and browser workflows are checked separately from these tests. The final automated suite passes 56 tests. Real hosted replies were verified for both ordinary visit explanations and an impossible five-minute trip. The API key was also checked to be absent from the browser build.

Useful learning exercises:

1. Change a test pantry’s closing time. Predict whether the visit still fits before
   running the test.
2. Explain why a resource with unknown hours becomes “Confirm before planning this
   visit,” while an explicitly closed resource is rejected.
3. Explain why the return leg must be counted, especially for public transportation.
4. Find the score calculation and explain how a resource covering two needs can
   outrank a closer resource that covers one.
5. Trace an invalid end time from the form to validation and the visible error.

## Blueprint status after Monday

Monday’s scoped planner is implemented: needs, transportation, available time,
accessibility, transparent filtering/ranking, practical steps and no-fit explanations.
AI chat is connected through the hosted provider. Advanced live transit routing,
guaranteed inventory, automatic bookings and optimized multi-stop routes remain
outside this version’s scope.

Tuesday’s Donation Hub and Wednesday’s authenticated organization dashboard remain
separate work. Your later request to simplify donations and remove pledges still
takes precedence over the older blueprint’s pledge feature.
