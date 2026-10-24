# Helping Hand: accounts and private questionnaire

The app now has a real local backend for accounts and saved personal preferences. No additional packages or large downloads were needed.

## Try it

1. Open the app and choose Create an account. Use an email and a password with at least 12 characters.
2. Choose Find help, Donate or volunteer, or Manage an organization.
3. Help seekers complete three short steps: needs; area and optional circumstances; travel and availability. Donors and organization managers only complete the first step.
4. Save and continue. Help-seeker answers fill the initial resource search and Visit planner.
5. Open Settings → Edit preferences to review or change answers. Sign out and back in to see that they persist.

Guest browsing remains available through Continue without an account. Account setup is required for account-based donation and organization changes.

## What is collected

Required account fields: email and password. Required help preferences: at least one need, city or postal code, a travel selection (including Not sure), travel limit and usual availability.

Optional: preferred name, household range, broad challenges, private notes and step-free access. There is no requirement for exact home address, date of birth, income amount, government ID, bank details or medical history. Notes warn against including sensitive identifiers; obvious identity/payment-number patterns are rejected. This validation is a basic safeguard, not a complete sensitive-data detector.

## Follow one action through the code

When you click Save and continue:

1. `PersonalSurvey.jsx` collects a draft with React state. Each checkbox changes only that draft; Back preserves it.
2. `AccountProvider.jsx` shares one account state with the whole app. `useCommunity.js` sends the draft to POST `/api/community/profile`.
3. `communityApi.js` checks the session cookie and the request origin. The server uses the signed-in account, never a browser-supplied user ID.
4. `personalProfile.js` validates allowed fields, limits text lengths and checks time order. Unknown fields are discarded.
5. `communityStore.js` saves the profile under that account ID in the `personal_profiles` SQLite table. It is separate from public organization information.
6. The returned profile updates React state. `App.jsx` opens the app, seeds location/category and fills the Visit planner. Actual visit dates and conversation messages stay in memory.

Registration stores a salted scrypt password hash, not the password. Sessions use random tokens in HttpOnly cookies; only token hashes are stored in the database. Switching accounts remounts the app so the previous account's in-memory chat and plan are cleared.

## AI personalization

The checkbox starts off unchecked. When enabled, the server builds a limited AI context from needs, area, travel/access preferences, usual availability, household range and selected broad challenges. Preferred name, email and private notes are excluded from that automatic context.

The server reads the profile using the actual session; the browser cannot attach another account's profile. Chat messages and explicitly attached visit preferences still go to the configured hosted AI provider when you use chat. Turning off profile personalization does not make chat messages private from that provider.

## Verification

81 automated tests passed, covering authentication, ownership, donation totals, questionnaire validation, separate profiles, mandatory setup, AI consent and the existing planner/resource rules.

Browser checks used a disposable synthetic account: registration, missing-needs validation, all three questionnaire steps, saved search filters, persistence after reopening, edit/cancel, sign-out/sign-in, and planner defaults. A real hosted AI reply correctly referred to the synthetic account's public-transport preference.

The phone screenshot shows the final questionnaire step. The original black, orange and off-white theme remains.

## Current limits

This backend runs locally on your computer. It is not yet a public hosted service. Before a public release, add HTTPS, secure production cookie configuration, account recovery/email verification, operational backups and privacy/account-deletion controls. Organization verification is also still needed. Questionnaire data is private by application access rules but is not encrypted at rest in the local SQLite file.

## Learning exercise

Change a travel preference, save it, then explain where each copy lives: the form draft, shared React account state and SQLite row. Next, explain why hiding another person's profile in the UI would not be enough without the server ownership check.
