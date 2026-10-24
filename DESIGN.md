# Kinlume design system

Kinlume is a practical resource directory for people seeking essential services,
with a second workflow for donors and community organizations. Finding help must be
clear, legible and low effort. The interface should feel considered without asking
people to navigate promotional content or decorative dashboards.

## Visual direction

Warm paper, charcoal, and terracotta. Keep the established identity and native
Segoe UI typography. Photography identifies places; typography and alignment do
the rest. No gradients, hero banners, invented statistics, decorative illustrations,
or new logos. Text stays direct: Resources, Map, Donate, Assistant, Saved, Settings.

The resource directory retains two columns with photos above text. It is the one
screen where a grid helps comparison. Settings, donations, organization records,
and assistant references use rows and dividers instead of repeated containers.

## Audit and preserved behavior

The old interface had a 430px phone frame on desktop, overlapping style layers,
uneven type and field sizes, resource cards stretched by long names, and heavy
containers around otherwise simple content. The redesign addresses layout and
hierarchy rather than replacing product behavior.

The APIs, database, sign-in, profile consent, ownership rules, donation accounting,
planner logic and resource sources are unchanged. Resource saving stays on this
device. Organization and account changes continue through the existing backend.
The existing opening animation and reduced-motion behavior are retained.

## Source of truth

`src/design-system.css` defines tokens, layout and components. `src/motion.css`
defines short state transitions and loading treatments; `src/launch.css` owns the
opening animation. The old `styles.css` and `interface.css` are no longer imported.
Copies of the previous modified interface files are in
`legacy/redesign-2026-10-22/` for reference and recovery.

Use the existing React components and plain CSS. No font downloads, component
libraries or animation packages are required.

## Palette

| Token              | Value     | Use                                         |
| ------------------ | --------- | ------------------------------------------- |
| `--paper`          | `#faf8f5` | Main page background                        |
| `--surface`        | `#ffffff` | Inputs, elevated map controls               |
| `--surface-subtle` | `#f2eee8` | Quiet grouped controls                      |
| `--ink`            | `#292622` | Body text and headings                      |
| `--muted`          | `#70685f` | Supporting text                             |
| `--line`           | `#e4ddd4` | Dividers and quiet borders                  |
| `--control-line`   | `#9b9287` | Input boundaries                            |
| `--accent`         | `#c67c4e` | Established warm accent, loading and motion |
| `--accent-text`    | `#98512e` | Links and selected labels                   |
| `--action`         | `#a45a36` | Primary actions with white text             |
| `--accent-soft`    | `#f6e9de` | Selected choices and user messages          |
| `--success`        | `#276348` | Received supplies and success feedback      |
| `--warning`        | `#88601f` | Caution                                     |
| `--error`          | `#a13330` | Validation errors                           |

The darker action shade retains the orange identity while improving contrast with
white button text. Selection uses a label, border or position as well as color.
Never use the accent as the default background for every interactive item.

## Typography

Use Segoe UI Variable Text → Segoe UI → platform system fonts. No Arial fallback,
heavy display font, or remote font request. Base size is 15px; form fields are 16px
to retain readability and avoid mobile input zoom. Larger text is controlled by
the existing user setting.

| Role            | Scale                      | Weight |
| --------------- | -------------------------- | ------ |
| Page title      | 1.65em mobile, 2em desktop | 600    |
| Section title   | 1.15em                     | 600    |
| Resource title  | ~1em                       | 600    |
| Body            | 1em / 1.5–1.7 line height  | 400    |
| Labels          | .93em                      | 500    |
| Supporting text | .85–.9em                   | 400    |
| Supply counts   | 1.6em, tabular numerals    | 500    |

Resource titles may occupy two lines in the grid; the complete title remains the
button's accessible name and is shown on the detail page. Never truncate critical
instructions, validation, eligibility or contact information.

## Spacing and responsive structure

Spacing scale: 4, 8, 12, 16, 20, 24, 32, 40, 48px. Use 8px for local relationships,
16px within a control group, and 24–32px between sections. Avoid inserting panels
or explanatory captions when a heading and spacing are enough.

- Below 600px: full-height app, 20px gutters (16px below 350px), fixed bottom
  navigation, two resource columns.
- 600–999px: wider centered content, 32px gutters, bottom navigation.
- At 1000px and above: a 184px navigation rail, wider main pane, compact search
  header, maximum 800px reading/content column. Resource photos use a shallower
  aspect ratio so names and actions remain visible on shorter windows.
- Account setup stays in a focused, centered column instead of stretching forms
  across desktop. Map and assistant panes fill their remaining height.

Only the content or conversation scrolls. Do not animate the app frame, change
navigation height between routes, or use scrollIntoView to reveal messages.

## Components and composition

- `PageHeading`: one title row with optional real result count.
- `EmptyState`: one outline icon, a short title and one useful action.
- Resource cards: unboxed photo, small service label, title, town and detail action.
  Bookmark controls are independent 44px buttons, not nested in the photo button.
- Detail pages: photo, service/title, contact actions, visit facts, then a source
  and photo-credit disclosure. Preserve unknown eligibility and hours as unknown.
- Primary buttons: solid action color, 8px radius, minimum 44px height. Secondary
  buttons are neutral. Links and text actions remain visually lighter.
- Fields: visible labels, consistent padding, 48px control height. Checkbox/radio
  sizes must never inherit text-input widths. Related time fields form two columns.
- Tabs: underline for modes and dashboard sections; a quiet segmented control for
  donor versus organization view; outlined choices for resource categories.
- Assistant: a simple start state with three existing actions; user text in a warm
  bubble, assistant text on the page, resource references as separated rows.
- Donations: requested, pledged and received numbers have equal semantics but
  received supplies alone fill the progress bar. Preserve their accounting rules.
- Settings: account identity, preference actions and appearance are grouped by
  headings and dividers. The text-size setting uses a native accessible checkbox.
- Survey: three progress segments reflect actual steps; optional fields and AI
  consent remain optional. No changes to what is collected or shared.

## Motion, loading and accessibility

Routine transitions are 150–220ms; use opacity and small transforms. Avoid bouncing,
hover elevation on every item, and layout animation. The opening title transition
is a separate, once-per-opening sequence and measures its real destination.

Resource skeletons follow the responsive photo proportions. Keep real results
visible during refresh when the existing search hook provides cached results.
Loading indicators have readable status labels; decorative skeletons are hidden
from assistive technology. Error and success messages retain their alert/status
roles. Never make the page wait for a photo before offering help.

Keep focus outlines visible, keyboard-accessible native controls, and 44px touch
targets for primary controls. Use reduced-motion media rules for all animations,
including the appearance switch. Long addresses, account emails and organization
names must wrap without widening the viewport. Do not hide attribution, source
links or important service uncertainty as a visual shortcut.

## Future screen checklist

1. What is the primary action, and is it clear without a paragraph of explanation?
2. Can this be a row or section rather than another card?
3. Are all colors and control proportions from this system?
4. Does real long content fit at 320px, 390px, tablet and desktop widths?
5. Are loading, empty, error and success states useful?
6. Can the feature be operated with a keyboard and reduced motion?
7. Have data access and existing business rules remained unchanged?

## Verification — October 22, 2026

- Production build passed; all 91 existing regression tests passed.
- Rendered checks at 320×740, 390×844, 768×1024 and 1440×900.
- Confirmed two resource columns, no page-level horizontal overflow, and stable
  navigation geometry. Map attribution and controls remain visible.
- Exercised category/search filters, no-results recovery, save/unsave, detail-page
  navigation, planning forms, organization required-field validation, settings,
  and questionnaire editing/cancel. The temporary bookmark was restored; no
  account, organization, profile or donation records were changed.
- Verified visible keyboard focus and 44px primary targets. Measured contrast:
  body on paper 14.20:1; secondary text on paper 5.17:1; white primary-button text
  5.13:1; selected category text 6.52:1. Reduced-motion rules remain in place.
- Browser error log was clear during the final review.
- This is interface QA, not a claim of a full accessibility audit or public hosting.
