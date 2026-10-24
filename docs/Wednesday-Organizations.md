# Helping Hand — Wednesday: organization dashboard

October 21, 2026

## What is finished

Open **Donate → Organization** and create an account. Save your organization's name, city, phone, and website. The dashboard has three sections:

- **Resources:** add a resource, edit its services, address, hours, eligibility, contact details, and accessibility information. New resources start as drafts. Check **Show in resource searches** when you want a listing included in this app's directory. You can turn that off later.
- **Requests:** create and edit supply requests. Close a request to stop new pledges; reopen it when needed. Closing doesn't delete its history or prevent recording an existing delivery.
- **Pledges:** review donations and record complete or partial deliveries. The reference on a pledge helps distinguish donations of the same item.

Changes are stored on the app server, rather than only in one browser. Accounts, sessions, profiles, resources, requests, pledges, and receipts survive a refresh and an API restart. No new packages, services, or AI models were downloaded.

Organization accounts manage only records they created. Existing third-party directory listings remain read-only. Creating an account does not verify that an organization is a registered nonprofit.

## How one edit moves through the code

Suppose an organization changes a request from 100 cans to 120 cans:

1. `RequestEditor.jsx` collects the form values. `OrganizationDashboard.jsx` passes the edit to `useCommunity.js`.
2. The hook sends an action to `/api/community/action`. The browser includes its session cookie automatically.
3. `communityApi.js` checks the request origin and reads the signed-in account from the server's session table. An account identifier supplied in the request body does not determine ownership.
4. `CommunityStore.act()` starts a database transaction, finds the request's organization, and checks that this account owns it.
5. `organizationRules.js` validates the edit. The target cannot fall below already received items plus outstanding pledges. Once an item has pledge history, its name, unit, and category stay fixed; a different item needs a new request.
6. The transaction saves the change. The server returns an updated view with fresh totals, and React renders it. The interface shows success only after the server saves successfully.

A **transaction** keeps validation and saving together. Two donations cannot both reserve the same last available quantity by checking an old total independently.

## Authentication and authorization

**Authentication** answers “Which account is signed in?” Passwords are stored as salted scrypt hashes. Successful sign-in creates a random session token, carried in an HttpOnly, SameSite cookie; the database stores a hash of that token. Sessions expire and sign-out revokes them.

**Authorization** answers “May this account change this record?” Every organization mutation checks the saved owner on the server. A donor can pledge to another organization and cancel their own outstanding pledge, but cannot edit its profile, change its request, or record a receipt. Only the organization's owner records deliveries. Hiding an Edit button is not the ownership check.

The implementation uses Node's built-in [SQLite API](https://nodejs.org/api/sqlite.html) and [crypto functions](https://nodejs.org/api/crypto.html#cryptoscryptpassword-salt-keylen-options-callback). The installed Node runtime supports these APIs, so no database installer was needed.

## Where records live

The private database is `.data/community.sqlite` inside the Congressional App Challenge project. That folder is ignored by Git. Keep it private and preserve it when moving the project. To make a simple filesystem backup, stop the API first and copy the `.data` folder. Do not copy it into `public/` or upload it with browser assets.

Browser-saved resources remain on the device, and conversations and visit preferences still remain in the React session. Signing into the organization dashboard does not yet save a personal assistance profile.

Earlier browser donation records have not been deleted. To import them, sign into an account with an empty organization, expand **About these listings**, and choose **Import device records**. This copies the profile, requests, and donation history into your account, creates new record IDs, and leaves the originals intact. It cannot overwrite an existing organization or claim another account's records.

## Directory and map behavior

Visible organization resources join the existing resource searches and can be used by the visit planner and assistant. Drafts are excluded. Organizations cannot replace outside directory records by submitting their IDs.

Map coordinates are optional. A resource without exact coordinates remains searchable by city and country, but gets no invented map pin or travel estimate. Users can still open directions using its address. A listing's hours and eligibility are organization-provided information, not a live guarantee.

## Verification

**74 automated tests passed**, and the production build passed. Coverage includes password hashing, sign-in and expired sessions, sign-out, forged origins, unauthenticated writes, attempts to edit another organization's records, quantity limits, partial deliveries, safe request edits, drafts, publishing, importing earlier records, and database reopening.

Browser checks covered account creation, incorrect and correct passwords, profile edits, resource creation and changed hours, draft/visible status, shared request visibility, pledging, recording a partial delivery, editing the target, refresh persistence, and sign-out. The navigation stayed 68 pixels tall at a 320-pixel phone width with no horizontal overflow.

The screenshots use a fictional example organization. Its disposable account and server records were removed after testing; no test listing was left in the live directory.

## Scope and Thursday

This is a working local backend; it has not been hosted online. Before public deployment, configure HTTPS and Secure cookies, deployment-specific origins, backups, email recovery/verification, and organization verification/moderation. Those services are not claimed to be connected.

Thursday can focus on the final competition walkthrough and remaining accessibility/error checks. The four core feature flows now exist: finding help, planning a visit, pledging supplies, and managing an organization's resources and deliveries.

## Learning exercise

Create two accounts. Have one create an organization and a request; use the other to pledge items. Predict the requested, pledged, received, and remaining numbers before recording a partial delivery. Then inspect `CommunityStore.act()` and explain why changing an organization ID in a browser request cannot grant the donor permission to record that delivery.
