import { cloudUser, cloudLogout, writeSession } from "./cloudSession.js";
import { trustedOrigin, requestFingerprint } from "./cloud-security.js";
import { problem } from "./cloud-errors.js";

export function cloudCommunityApi(store, { json, requestBody }) {
  return async (request, response, url) => {
    if (!url.pathname.startsWith("/api/community")) return false;
    try {
      if (request.method === "GET" && url.pathname === "/api/community") {
        const user = await cloudUser(request, response, store);
        json(response, 200, await store.view(user));
        return true;
      }
      if (request.method !== "POST") throw problem("Not found.", 404);
      if (!trustedOrigin(request.headers.origin))
        throw problem("Open the app from its approved address.", 403);
      if (!request.headers["content-type"]?.startsWith("application/json"))
        throw problem("Send JSON.", 415);
      const body = await requestBody(request);
      if (!body || typeof body !== "object" || Array.isArray(body))
        throw problem("Send a valid request.");
      const route = url.pathname.slice("/api/community".length);
      await store.limit(`account:${requestFingerprint(request)}`, 60);
      if (route === "/login" || route === "/register") {
        await store.limit(`signin:${requestFingerprint(request)}`, 20, 900);
        const session = await store.authenticate(
          body.email,
          body.password,
          route === "/register",
        );
        if (!session.access_token) {
          json(response, 200, {
            ...(await store.view(null)),
            notice: "Check your email to confirm your account, then sign in.",
          });
        } else {
          const user = await store.request("/auth/v1/user", {
            token: session.access_token,
          });
          await store.ensureWorkspace(user);
          writeSession(response, session, Boolean(process.env.VERCEL));
          json(response, 200, await store.view(user));
        }
      } else if (route === "/logout") {
        await cloudLogout(request, response, store);
        json(response, 200, await store.view(null));
      } else {
        const user = await cloudUser(request, response, store);
        if (!user) throw problem("Sign in to continue.", 401);
        await store.ensureWorkspace(user);
        if (route === "/profile")
          json(response, 200, await store.saveProfile(user, body.profile));
        else if (route === "/action")
          json(response, 200, await store.act(user, body.action));
        else throw problem("Not found.", 404);
      }
    } catch (error) {
      json(response, error.status || 400, {
        error: error.status ? error.message : "Could not save this change. Check the fields and try again.",
      });
    }
    return true;
  };
}
