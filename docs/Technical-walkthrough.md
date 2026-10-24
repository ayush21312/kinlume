# Kinlume: technical walkthrough

Updated October 24, 2026. Read this alongside the project in `C:\Users\ajitk\OneDrive\Documents\Projects\Congressional App Challenge`.

## 1. The technologies and their jobs

Kinlume is a React web application with a Node server and SQLite database. It now also includes a web app manifest for installation in supporting browsers. It is not an App Store/Play Store native binary.

- HTML supplies the document and root element.
- React builds the screens from reusable components written in JavaScript and JSX. JSX looks like HTML but can use JavaScript values and event handlers.
- CSS controls color, spacing, responsive layout, transitions, focus indicators and reduced motion.
- Vite starts the development interface and builds optimized files for deployment.
- Node receives API requests, validates them, calls external services, and reads/writes the database.
- SQLite persists accounts and organization data in a file on the server.
- Groq runs the language model. Kinlume supplies instructions and selected directory facts; it does not train the model.

An API is an agreed way for two pieces of software to exchange requests and responses. Most of this app's responses are JSON: structured text made of objects, arrays and values.

## 2. Where the app starts

`index.html` contains `<div id="root">` and loads `src/main.jsx`.

`main.jsx` mounts React in that element. `AccountProvider` makes account state and account actions available to components. `AppLaunch` handles the opening animation. `App` selects the screen to display.

`App.jsx` owns page selection, keyword search, saved resource IDs, chat messages and visit preferences. React state is memory that changes when the user interacts. Calling a state setter causes React to update the affected interface.

For example, typing in the search field calls `setSearch`. The derived matching list is recalculated and passed into `HomeView`. This updates the cards without reloading the entire website. `useMemo` caches a derived result between relevant changes; it is not permanent storage.

`useEffect` coordinates things outside rendering, such as requests, browser events and cleanup. `useLayoutEffect` is used where measuring or resetting layout must happen before painting. Effects remove listeners or abort outdated requests when appropriate.

## 3. Resource search

Read these files in order:

1. `src/components/LocationSearch.jsx`: collects a location.
2. `src/hooks/useResourceSearch.js`: requests directory results when location or filters change. It cancels old requests so a slow previous location cannot replace a newer one.
3. `server/index.js`: routes `/api/resources` to the search module.
4. `server/resourceSearch.js`: chooses providers, caches requests and merges results with known local records.
5. `server/internationalResources.js`: handles international location lookup and mapped resource sources.
6. `src/utils/resourceData.js`: converts provider-specific records into a consistent resource shape and merges duplicates.
7. `src/utils/filterResources.js`: combines category filtering with keyword matching over names, services, locations and descriptions.
8. `src/components/HomeView.jsx` and `ResourceCard.jsx`: render the two-column results.

The common resource structure lets one card and detail screen display different providers. Unknown hours or accessibility remain unknown; the app must not invent them.

`src/utils/searchSpelling.js` is a small local dictionary of common service-word mistakes. A suggestion appears in Home and changes the search only after a user clicks it. It does not guess city names. Browser spell-check and phone autocorrection are requested for chat and narrative fields; availability depends on browser/keyboard settings. This is not a full spelling engine.

## 4. Maps and photos

`MapView.jsx` uses Leaflet to render an OpenStreetMap-based map. Resources get markers only when they have usable coordinates. Selecting a place opens its details; directions links open an external mapping service. A map pin does not prove a service is currently open.

`ResourceImage.jsx` initially uses the record's image. An IntersectionObserver notices when a card reaches the screen and then requests an automatic photo if needed. This avoids loading photo lookups for every off-screen result. `server/photos.js` checks candidate Wikimedia Commons images for location/name agreement and acceptable licensing. Detail screens show attribution. Stock images remain a fallback.

## 5. AI assistant

`AssistantView.jsx` owns the composer and displays messages. It sends recent conversation turns to `/api/assistant` using `fetch`. `fetch` is the browser's HTTP request API.

The server:

1. Validates the message structure in `assistant.js`.
2. Reads the signed-in user's allowed personalization through the session, not a browser-supplied account ID.
3. Uses `chat.js` to determine the requested assistance and find relevant records.
4. Uses `aiProvider.js` to send selected records and instructions to the configured model.
5. Parses the reply and checks referenced resource IDs against the supplied catalog.
6. Returns an explanation and resource references to the interface.

The private API key is loaded by Node from `.env.server`. It is never bundled into React. Saved profile personalization requires opt-in; names, emails and private notes are excluded from automatic profile context. Anything explicitly typed into a chat is part of the chat sent to the provider.

The model is instructed to avoid invented hours, eligibility decisions or transport arrangements, but language-model output is still fallible. If the provider fails, the app can show directory-based results. Describe this as grounded resource assistance, not guaranteed accuracy or a fine-tuned model you trained.

## 6. The visit planner: your most important logic

`VisitPlanner.jsx` collects needs, transport, date, available hours, maximum travel, visit duration and accessibility preferences. `/api/plan` validates input with `plannerValidation.js`, searches resources and passes them to `visitPlanner.js`.

The planner uses explicit rules rather than asking a model to decide feasibility. It checks service categories, eligibility restrictions, opening windows, travel limits, time for the visit and the return journey. It handles local time zones. It ranks useful options and explains rejected or uncertain ones.

Travel based on straight-line distance is labeled an estimate. Transit without a usable travel time remains conditional. Missing hours or accessibility information requires confirmation. An unsuccessful plan explains what prevented a suitable visit. The AI may explain a plan but cannot override these checks.

## 7. Accounts, ownership and saved information

`AccountProvider.jsx` keeps the interface in sync with `/api/community`. `AccountForm.jsx` collects credentials. `PersonalSurvey.jsx` collects preferences, which `personalProfile.js` validates.

`communityStore.js` creates the SQLite tables:

- `accounts`: email, password hash and salt.
- `sessions`: hashed session token, owner and expiry.
- `personal_profiles`: private questionnaire per account.
- `workspaces`: each account's organization/resources/donation records.

Passwords use scrypt with a random salt. Successful sign-in creates a random session token in an HttpOnly cookie. The database stores a hash of that token. HttpOnly prevents browser JavaScript from reading the cookie; it does not replace server validation.

`communityApi.js` reads that session, validates request origins and dispatches authenticated actions. `organizationRules.js` checks ownership and data rules. Hiding an Edit button is not security: the server must reject another account's edit even if they manually construct a request.

Accounts, questionnaires and donations persist in SQLite. Saved resource bookmarks and appearance settings currently use browser localStorage. Chats and individual visit plans are in React memory. Reloading clears that memory. There is no Supabase integration, email verification or password-reset email service yet.

## 8. Donation accounting

`DonateView.jsx` switches between donor and organization interfaces. `RequestEditor.jsx` edits requests. `SupplyRequestCard.jsx` shows totals and accepts pledges. `OrganizationDashboard.jsx` lets an owner review pledges and record deliveries.

`src/utils/donations.js` calculates totals and validates quantities. Server rules authorize and persist actions. The client cannot make an invalid quantity valid by bypassing an input's minimum/maximum.

Example: an organization requests 20 kits. A donor pledges 8: requested 20, outstanding pledged 8, received 0, unpledged need 12. The organization records 3 delivered: outstanding pledged 5, received 3, unpledged need still 12. The remaining 5 are not counted as received. Cancelling those 5 makes the unpledged need 17.

## 9. Styling, installation and phone behavior

`design-system.css` defines reusable tokens and the responsive screen structure. `motion.css` defines small transitions and loading effects. `launch.css` moves the opening name into the header. `BottomNav.jsx` is kept outside the scrolling content so it stays stable. Desktop uses a rail; phones use the bottom bar.

`public/manifest.webmanifest` defines the installation name, icons, start URL and standalone display. PNG icons are 192 and 512 pixels; Apple has a 180-pixel touch icon. `useAppInstall.js` listens for the browser's installation-available event. Settings shows Install Kinlume only when that event is available. The user must click and approve installation. On supported iPhones, installation is normally through Safari's share menu.

Installed mode removes the decorative browser-preview frame. Safe-area spacing accommodates device cutouts. `ConnectionStatus.jsx` shows a notice when the browser reports no connection. It cannot detect every server/provider outage.

There is no offline service worker or offline API cache. This avoids treating stale hours/inventory or cached private account responses as current. Search, AI and account changes still need a working server and connection. Installation support does not host the backend: a real phone needs a reachable HTTPS deployment, not this computer's `127.0.0.1` address.

Installation documentation: https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable

## 10. Tests and explaining your work

`tests/` covers filtering, typo suggestions, image sources, request validation, AI output checks/recovery, time zones, impossible visits, private profiles, sessions, ownership and donation accounting. `npm test` passed 93 tests after these refinements; `npm run build` also passed. External service availability and every browser/device are not proven by these tests.

For the video, explain one complete action rather than memorizing filenames: user input → React state/request → Node validation → provider or database → JSON response → updated screen. Show a normal case and a rejected case. Be able to explain why the planner checks the return trip and why a pledge is different from a delivery.

## 11. Further data sources

Existing integrations include Feed America (`feedam.org`, separate from the Feeding America nonprofit), Give Food for UK resources, OpenStreetMap/location providers, Wikimedia Commons photos and sourced program referrals.

Good next integrations, researched but not newly connected in this refinement:

- HRSA health-center web services support state/county/ZIP queries. Registration is required for a token. Use official eligibility/cost information rather than labeling every clinic free. https://data.hrsa.gov/tools/web-services
- Give Food also publishes donation needs. This could improve UK donation discovery, but imported needs must remain separate from requests owned by Kinlume accounts. Their API rules require credits and preserving item order; their site requests contact before launching with the data. https://www.givefood.org.uk/api/

Neither source creates verified Kinlume partner organizations automatically. Before recording, improving the quality and reliability of the demonstrated workflow is more valuable than adding several untested providers.
