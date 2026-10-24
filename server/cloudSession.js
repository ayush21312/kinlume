import { problem } from "./cloud-errors.js";
const accessName = "kinlume_access";
const refreshName = "kinlume_refresh";
function cookie(request, name) {
  return (
    (request.headers.cookie || "")
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(name + "="))
      ?.slice(name.length + 1) || ""
  );
}
export function writeSession(response, session, secure = true) {
  const options = `HttpOnly; SameSite=Strict; Path=/api${secure ? "; Secure" : ""}`;
  response.setHeader("Set-Cookie", [
    `${accessName}=${session?.access_token || ""}; ${options}; Max-Age=${session ? Math.min(Number(session.expires_in) || 3600, 3600) : 0}`,
    `${refreshName}=${session?.refresh_token || ""}; ${options}; Max-Age=${session ? 604800 : 0}`,
  ]);
}
export async function cloudUser(request, response, store) {
  let access = cookie(request, accessName);
  const refresh = cookie(request, refreshName);
  if (!access && !refresh) return null;
  let user;
  if (access) {
    try {
      user = await store.request("/auth/v1/user", { token: access });
    } catch (error) {
      if (error.status !== 401) throw error;
    }
  }
  if (!user && refresh) {
    try {
      const session = await store.request(
        "/auth/v1/token?grant_type=refresh_token",
        { method: "POST", body: { refresh_token: refresh } },
      );
      user = await store.request("/auth/v1/user", {
        token: session.access_token,
      });
      access = session.access_token;
      writeSession(response, session, Boolean(process.env.VERCEL));
    } catch (error) {
      if (error.status !== 401) throw error;
      writeSession(response, null, Boolean(process.env.VERCEL));
      return null;
    }
  }
  if (!user || !/^[0-9a-f-]{36}$/i.test(user.id) || !user.email) return null;
  return { id: user.id, email: user.email, access };
}
export async function cloudLogout(request, response, store) {
  const access = cookie(request, accessName);
  if (access) {
    try {
      await store.request("/auth/v1/logout?scope=local", {
        method: "POST",
        token: access,
      });
    } catch (error) {
      if (error.status !== 401)
        throw problem("Could not sign out. Try again.", 503);
    }
  }
  writeSession(response, null, Boolean(process.env.VERCEL));
}
