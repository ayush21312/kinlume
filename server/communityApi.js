import { problem } from "./communityStore.js";
export const validOrigin = (origin) =>
  /^http:\/\/(127\.0\.0\.1|localhost):(517[3-9]|518[0-3]|4173)$/.test(
    origin || "",
  );
const cookieName = "helping_hand_session";
const sessionToken = (request) =>
  (request.headers.cookie || "")
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(cookieName + "="))
    ?.slice(cookieName.length + 1) || "";

export const accountFromRequest = (request, store) =>
  store.user(sessionToken(request));

export function communityApi(store, { json, requestBody }) {
  const attempts = new Map();
  return async function handle(request, response, url) {
    if (!url.pathname.startsWith("/api/community")) return false;
    try {
      const token = sessionToken(request),
        user = store.user(token);
      if (request.method === "GET" && url.pathname === "/api/community") {
        json(response, 200, store.view(user));
        return true;
      }
      if (request.method !== "POST") throw problem("Not found.", 404);
      if (!validOrigin(request.headers.origin))
        throw problem("Open the app from its local address.", 403);
      if (!request.headers["content-type"]?.startsWith("application/json"))
        throw problem("Send JSON.", 415);
      const body = await requestBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw problem("Send a valid request.");
      const route = url.pathname.slice("/api/community".length);
      if (route === "/login" || route === "/register") {
        const ip = request.socket.remoteAddress;
        const recent = (attempts.get(ip) || []).filter(
          (time) => Date.now() - time < 15 * 60000,
        );
        if (recent.length >= 20)
          throw problem(
            "Too many sign-in attempts. Try again in 15 minutes.",
            429,
          );
        recent.push(Date.now());
        attempts.set(ip, recent);
        const account = await store.authenticate(
          body.email,
          body.password,
          route === "/register",
        );
        store.logout(token); // Rotate the session after every successful sign-in.
        const session = store.createSession(account);
        response.setHeader(
          "Set-Cookie",
          `${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800`,
        );
        json(response, 200, store.view(account));
      } else if (route === "/logout") {
        store.logout(token);
        response.setHeader(
          "Set-Cookie",
          `${cookieName}=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0`,
        );
        json(response, 200, store.view(null));
      } else if (route === "/profile")
        json(response, 200, store.saveProfile(user, body.profile));
      else if (route === "/action")
        json(response, 200, store.act(user, body.action));
      else throw problem("Not found.", 404);
    } catch (error) {
      json(response, error.status || 400, {
        error:
          error.status || !/sqlite|SQLITE|constraint/i.test(error.message)
            ? error.message
            : "Could not save this change. Please try again.",
      });
    }
    return true;
  };
}
