# Kinlume project preferences

- Keep new code readable and explain how a user action flows through it.
- Ask before any large download and state its estimated size. Do not download AI
  model weights or install local AI runtimes without explicit, size-aware approval.
- Use the configured hosted AI provider. Never enable billing or switch to a paid
  fallback automatically.
- Keep real API keys in the ignored `.env.server` file. Never display them, copy
  them into browser code, or put them in examples, screenshots, logs or Git.

- Use plain feature labels such as Assistant and Visit planner. Avoid invented
  feature brand names, promotional slogans, and unnecessary status badges.

- Preserve the original black, warm orange, and off-white palette. Indeed is a
  reference for layout, buttons, typography, and polish, not its blue color theme.

- Keep resources in the original two-column, image-above-text card grid. Use
  the native Segoe UI/system font stack instead of Arial; avoid heavy type.

- Account and organization records are stored in .data/community.sqlite. Preserve
  this private database; never reset or delete it during routine development.
- Keep organization ownership checks on the server. Never rely on browser-supplied
  account IDs or UI visibility to authorize edits or donation receipts.

- Personal questionnaires belong only to the signed-in account in personal_profiles.
  Keep them out of public organization responses and browser localStorage.
- Automatic AI personalization requires explicit opt-in. Exclude names, email and
  private free-text notes from the AI profile payload; never log questionnaire answers.

- Follow DESIGN.md and src/design-system.css for interface work. Do not re-import
  the retired styles.css/interface.css layers. Preserve the mobile bottom bar,
  desktop navigation rail, resource grid, native font stack and reduced motion.
