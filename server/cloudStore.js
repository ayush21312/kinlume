import { emptyDonations, requestTotals } from "../src/utils/donations.js";
import { validatePersonalProfile } from "./personalProfile.js";
import { applyWorkspaceAction } from "./workspaceAction.js";
import { problem } from "./cloud-errors.js";

export class CloudStore {
  constructor({ url, serviceKey, fetchImpl = fetch }) {
    if (!/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || "") || !serviceKey)
      throw problem("Cloud database is not configured.", 503);
    this.url = url;
    this.serviceKey = serviceKey;
    this.fetch = fetchImpl;
  }
  async request(route, { method = "GET", body, token, headers = {} } = {}) {
    let response;
    try {
      response = await this.fetch(this.url + route, {
        method,
        headers: {
          apikey: this.serviceKey,
          Authorization: `Bearer ${token || this.serviceKey}`,
          "Content-Type": "application/json",
          ...headers,
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(12000),
      });
    } catch {
      throw problem(
        "The account service could not be reached. Try again.",
        503,
      );
    }
    const data =
      response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      // Never forward provider diagnostics, SQL, credentials or email addresses.
      const code = data?.error_code || data?.code;
      if (code === "email_address_not_authorized")
        throw problem(
          "Account creation is temporarily unavailable. Please try again later.",
          503,
        );
      if (response.status === 429)
        throw problem("Please wait a moment before trying again.", 429);
      if (code === "email_not_confirmed")
        throw problem("Confirm your email before signing in.", 401);
      if (
        route.includes("/auth/") &&
        [400, 401, 403, 422].includes(response.status)
      )
        throw problem(
          "Sign-in failed. Check your email, password, and email confirmation.",
          401,
        );
      throw problem(
        "The account service could not complete this request. Try again.",
        503,
      );
    }
    return data;
  }
  async limit(bucket, count, seconds = 60) {
    const allowed = await this.request("/rest/v1/rpc/kinlume_rate_limit", {
      method: "POST",
      body: {
        bucket_name: bucket,
        max_requests: count,
        window_seconds: seconds,
      },
    });
    if (allowed !== true)
      throw problem("Please wait a moment before trying again.", 429);
  }
  async authenticate(email, password, register = false) {
    if (
      typeof email !== "string" ||
      email.length > 254 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    )
      throw problem("Enter a valid email address.");
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 128
    )
      throw problem("Use a password between 12 and 128 characters.");
    return this.request(
      register ? "/auth/v1/signup" : "/auth/v1/token?grant_type=password",
      { method: "POST", body: { email: email.trim().toLowerCase(), password } },
    );
  }
  async ensureWorkspace(user) {
    await this.request("/rest/v1/kinlume_workspaces?on_conflict=owner_id", {
      method: "POST",
      body: { owner_id: user.id, data: { ...emptyDonations(), resources: [] } },
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    });
  }
  async workspaces() {
    const all = [];
    for (let offset = 0; ; offset += 500) {
      const rows = await this.request(
        `/rest/v1/kinlume_workspaces?select=owner_id,data,version&order=owner_id&offset=${offset}&limit=500`,
      );
      if (!Array.isArray(rows))
        throw problem("Could not load organization records.", 503);
      all.push(
        ...rows.map((row) => ({
          owner: row.owner_id,
          state: row.data,
          version: row.version,
        })),
      );
      if (rows.length < 500) break;
      if (offset >= 9500)
        throw problem("This directory needs a narrower server query.", 503);
    }
    return all;
  }
  async profile(user) {
    if (!user) return null;
    const rows = await this.request(
      `/rest/v1/kinlume_profiles?user_id=eq.${encodeURIComponent(user.id)}&select=data`,
    );
    return rows?.[0]?.data || null;
  }
  async saveProfile(user, input) {
    if (!user) throw problem("Sign in to save your answers.", 401);
    const data = {
      ...validatePersonalProfile(input),
      updatedAt: new Date().toISOString(),
    };
    await this.request("/rest/v1/kinlume_profiles?on_conflict=user_id", {
      method: "POST",
      body: { user_id: user.id, data },
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
    return this.view(user);
  }
  async view(user) {
    const [rows, profile] = await Promise.all([
      this.workspaces(),
      this.profile(user),
    ]);
    const mine = rows.find((row) => row.owner === user?.id);
    return {
      user: user ? { email: user.email } : null,
      profile,
      organization: mine?.state.organization || null,
      resources: mine?.state.resources || [],
      requests: rows.flatMap(({ owner, state }) =>
        state.requests.map((request) => ({
          ...request,
          organization: state.organization,
          managed: owner === user?.id,
          hasHistory: state.pledges.some(
            (pledge) => pledge.requestId === request.id,
          ),
          totals: requestTotals(state, request.id),
        })),
      ),
      pledges: rows.flatMap(({ owner, state }) =>
        state.pledges
          .filter(
            (pledge) =>
              user && (owner === user.id || pledge.donorId === user.id),
          )
          .map(({ donorId, ...pledge }) => ({
            ...pledge,
            mine: donorId === user?.id,
            canCancel: owner === user?.id || donorId === user?.id,
          })),
      ),
    };
  }
  async act(user, action) {
    if (!user) throw problem("Sign in to continue.", 401);
    if (!(await this.profile(user)))
      throw problem("Complete account setup before continuing.", 409);
    // Compare-and-swap makes competing pledges recheck the latest available need.
    // A lost response is never blindly retried: only a known version conflict is.
    for (let attempt = 0; attempt < 5; attempt++) {
      const rows = await this.workspaces();
      const { owner, next } = applyWorkspaceAction(rows, user, action);
      const version = rows.find((row) => row.owner === owner).version;
      const updated = await this.request(
        `/rest/v1/kinlume_workspaces?owner_id=eq.${owner}&version=eq.${version}&select=owner_id`,
        {
          method: "PATCH",
          body: { data: next, version: version + 1 },
          headers: { Prefer: "return=representation" },
        },
      );
      if (updated?.length === 1) return this.view(user);
    }
    throw problem("Another update was just saved. Refresh and try again.", 409);
  }
  async publicResources() {
    return (await this.workspaces()).flatMap(({ state }) =>
      (state.resources || [])
        .filter((resource) => resource.published)
        .map((resource) => ({
          ...resource,
          sourceUrl: resource.website || state.organization?.website || "",
          organizationName: state.organization?.name,
        })),
    );
  }
}
