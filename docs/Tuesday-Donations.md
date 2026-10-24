# Helping Hand: Tuesday donation workflow

October 20, 2026

## What is working

The Donate tab has two views. Organization lets you save an organization, create supply requests, see pledges, and record deliveries. Donate items lets you filter requests, pledge a whole item quantity, and cancel an outstanding pledge.

Both views read the same records. Changes survive refreshes on the same browser and origin. Other open tabs update through the browser's storage event. Where supported, a browser lock serializes saves from multiple tabs. No data is sent to a nonprofit or published online.

The example organization created during testing is fictional. Its name is **Example Community Pantry**, in **Example city**. It is separate from the real resource directory. Its request currently demonstrates a partial delivery.

## Understand the quantities

- **Requested:** the organization's total target.
- **Pledged:** items promised but not delivered or cancelled.
- **Received:** items the organization has recorded as delivered.
- **Still needed:** requested minus outstanding pledges minus received.

For example, an organization requests 100 cans. A donor pledges 30. The screen shows requested 100, pledged 30, received 0, and 70 still needed. Recording a delivery of 12 changes pledged to 18 and received to 12. Still needed remains 70. Cancelling the undelivered remainder changes pledged to 0 and still needed to 88; the 12 received remain recorded.

The progress bar shows received items only. Fully pledged requests remain incomplete until deliveries arrive. Invalid quantities, overpledging, and receiving more than an outstanding pledge are rejected.

## Trace one action through the code

1. In `src/components/DonateView.jsx`, the pledge form collects the quantity and identifies its request. It passes a `pledge` action to the hook.
2. `src/hooks/useDonations.js` reads the latest saved records before applying the action.
3. `src/utils/donations.js` validates the quantity, looks up the remaining need, and returns a new state containing the pledge. It does not modify the old state.
4. The hook writes the new state to local storage. Only after saving succeeds does it update React state and show success.
5. Both views call `requestTotals` to calculate their numbers. There is no separate donor total that can drift from the organization's total.

Separate records make these relationships understandable: each request has a unique ID, and each pledge points to one request. A pledge records its original quantity, received quantity, and cancellation status.

## Design and AI checks

The interface now uses **Assistant** and **Visit planner** instead of feature brand names. The connection badge and promotional home banner are removed. Long listing warnings expand on demand. Privacy information and material limitations remain visible.

The bottom navigation occupies its own grid row and has five equal columns with tab labels. It remained 68 pixels tall at 320 × 568 and 430 × 740, with no horizontal document overflow. The phone donation preview was checked at 375 × 812.

Live Groq replies and linked directory results were verified. A chat bug that included a follow-up question in the city search was fixed and covered by a regression test. Existing planner checks still cover closed resources, time windows, return travel, unknown transit times, accessibility, and missing information.

Validation: **65 automated tests passed**, and the production build passed. Browser checks covered request creation, a pledge above the limit, a valid pledge, organization visibility, partial delivery, and refresh persistence. No packages or AI models were downloaded for this work.

## Next: Wednesday

Tuesday's workflow is complete as a local demonstration. Before real donors and organizations can share it, Wednesday still needs a shared backend, sign-in, organization ownership checks, and organization editing. The Organization tab is currently a local view, not an authenticated account. Switching views does not confer real organizational authority.

Until those pieces exist, don't use this version to coordinate actual deliveries. Local storage is editable by the browser user and is not a security boundary.

## Learning exercise

Create a second request with a different item. Pledge some of it, record part of the delivery, and predict all four numbers before looking at the screen. Then follow the matching action in `changeDonations` and explain why receiving an item doesn't reduce the remaining need a second time.
