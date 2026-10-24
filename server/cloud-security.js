import { createHash } from "node:crypto";

export function trustedOrigin(origin, env = process.env) {
  if (
    /^http:\/\/(127\.0\.0\.1|localhost):(517[3-9]|518[0-3]|4173)$/.test(
      origin || "",
    )
  )
    return !env.VERCEL;
  const allowed = (env.APP_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  return allowed.includes(origin);
}

export function requestFingerprint(request) {
  // Vercel supplies this header; never use an account ID supplied by a browser.
  const address =
    request.headers["x-vercel-forwarded-for"] ||
    request.socket?.remoteAddress ||
    "unknown";
  return createHash("sha256").update(String(address)).digest("hex");
}
