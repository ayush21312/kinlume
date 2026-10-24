import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

// Both public pages are generated from one readable source of policy text.
const root = new URL("../", import.meta.url);
const policy = JSON.parse(
  await readFile(new URL("src/data/legal.json", root), "utf8"),
);
const escape = (value) =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
for (const [kind, title] of [
  ["terms", "Terms of service"],
  ["privacy", "Privacy policy"],
]) {
  const draft =
    policy.status !== "published" ||
    !policy.operatorName ||
    !policy.contactEmail;
  const sections = policy[kind]
    .map(
      ([heading, body]) =>
        "<section><h2>" +
        escape(heading) +
        "</h2><p>" +
        escape(body) +
        "</p></section>",
    )
    .join("\n");
  const contact = policy.contactEmail
    ? '<p>Contact: <a href="mailto:' +
      escape(policy.contactEmail) +
      '">' +
      escape(policy.contactEmail) +
      "</a></p>"
    : "<p>Public contact details: not provided.</p>";
  const html =
    '<!doctype html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="robots" content="noindex"><title>' +
    title +
    ' · Kinlume</title><link rel="icon" href="/brand/kinlume-icon.svg" type="image/svg+xml"><link rel="stylesheet" href="/legal.css"></head><body><header><a href="/">Kinlume</a></header><main><nav class="legal-nav" aria-label="Legal information"><a href="/">Back to app</a><a href="/terms.html">Terms of service</a><a href="/privacy.html">Privacy policy</a></nav><h1>' +
    title +
    '</h1><p class="meta">Updated ' +
    escape(policy.updated) +
    "</p>" +
    (draft
      ? '<p class="draft"><strong>Draft for the current prototype.</strong> Operator and contact details are not finalized. Review and complete this document before public launch.</p>'
      : "") +
    (policy.operatorName
      ? "<p>Operator: " + escape(policy.operatorName) + "</p>"
      : "") +
    sections +
    contact +
    "</main><footer><p>© 2026 Kinlume. Third-party content retains its original ownership and licensing.</p></footer></body></html>\n";
  await writeFile(new URL("public/" + kind + ".html", root), html);
}
console.log(
  "Generated Terms and Privacy pages; missing contact details remain explicitly marked as draft.",
);
