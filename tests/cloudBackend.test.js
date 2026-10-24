import test from "node:test";
import assert from "node:assert/strict";
import { CloudStore } from "../server/cloudStore.js";
import { cloudUser, writeSession } from "../server/cloudSession.js";
import { trustedOrigin } from "../server/cloud-security.js";
import { applyWorkspaceAction } from "../server/workspaceAction.js";
import { responseJson } from "../src/utils/responseJson.js";
import { emptyDonations } from "../src/utils/donations.js";

const owner = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "owner@example.invalid",
};
const donor = {
  id: "22222222-2222-4222-8222-222222222222",
  email: "donor@example.invalid",
};
const stranger = {
  id: "33333333-3333-4333-8333-333333333333",
  email: "stranger@example.invalid",
};
function fixture() {
  const rows = [owner, donor, stranger].map((user) => ({
    owner: user.id,
    version: 0,
    state: { ...emptyDonations(), resources: [] },
  }));
  function act(user, action) {
    const changed = applyWorkspaceAction(rows, user, action);
    rows.find((row) => row.owner === changed.owner).state = changed.next;
    return changed;
  }
  act(owner, {
    type: "organization",
    name: "Test nonprofit",
    city: "Hackensack",
    phone: "",
    website: "",
  });
  act(owner, {
    type: "request",
    item: "Test kits",
    quantity: 10,
    unit: "kits",
    category: "hygiene",
  });
  return { rows, act, id: rows[0].state.requests[0].id };
}
function store() {
  return new CloudStore({
    url: "https://example.supabase.co",
    serviceKey: "test-server-key",
  });
}

test("cloud action rules reject forged ownership and preserve pledge/receipt accounting", () => {
  const f = fixture();
  assert.throws(
    () =>
      f.act(stranger, {
        type: "edit-request",
        id: f.id,
        item: "forged",
        quantity: 10,
        unit: "kits",
        category: "hygiene",
      }),
    /own organization/,
  );
  f.act(donor, { type: "pledge", requestId: f.id, quantity: 7 });
  const pledge = f.rows[0].state.pledges[0];
  assert.equal(pledge.donorId, donor.id);
  assert.throws(
    () =>
      f.act(stranger, { type: "receive", pledgeId: pledge.id, quantity: 2 }),
    /own organization/,
  );
  f.act(owner, { type: "receive", pledgeId: pledge.id, quantity: 2 });
  assert.equal(f.rows[0].state.pledges[0].received, 2);
  assert.throws(
    () => f.act(stranger, { type: "cancel", pledgeId: pledge.id }),
    /own organization/,
  );
});
test("cloud view does not expose donor identifiers, another profile or another donor's pledges", async () => {
  const f = fixture();
  f.act(donor, { type: "pledge", requestId: f.id, quantity: 3 });
  const db = store();
  db.workspaces = async () => f.rows;
  db.profile = async (user) => (user ? { preferredName: user.id } : null);
  const guest = await db.view(null);
  assert.equal(guest.profile, null);
  assert.deepEqual(guest.pledges, []);
  const unrelated = await db.view(stranger);
  assert.deepEqual(unrelated.pledges, []);
  const own = await db.view(donor);
  assert.equal(own.pledges.length, 1);
  assert.equal("donorId" in own.pledges[0], false);
  assert.equal(own.profile.preferredName, donor.id);
});
test("competing cloud writes revalidate latest need instead of accepting overpledges", async () => {
  const f = fixture();
  const db = store();
  db.profile = async () => ({ purpose: "donate" });
  db.workspaces = async () => structuredClone(f.rows);
  let patches = 0;
  db.request = async (route) => {
    assert.ok(route.includes("version=eq.0"));
    patches++;
    f.act(stranger, { type: "pledge", requestId: f.id, quantity: 4 });
    f.rows[0].version++;
    return []; // Another request won the compare-and-swap.
  };
  await assert.rejects(
    db.act(donor, { type: "pledge", requestId: f.id, quantity: 8 }),
  );
  assert.equal(patches, 1);
  assert.equal(f.rows[0].state.pledges.length, 1);
  assert.equal(f.rows[0].state.pledges[0].quantity, 4);
});
test("cloud writes do not repeat a mutation after an uncertain network result", async () => {
  const f = fixture();
  const db = store();
  db.profile = async () => ({});
  db.workspaces = async () => f.rows;
  let calls = 0;
  db.request = async () => {
    calls++;
    throw new Error("Connection lost");
  };
  await assert.rejects(
    db.act(donor, { type: "pledge", requestId: f.id, quantity: 2 }),
    /Connection lost/,
  );
  assert.equal(calls, 1);
});
test("cloud failures keep provider diagnostics and service keys out of user errors", async () => {
  const db = new CloudStore({
    url: "https://example.supabase.co",
    serviceKey: "secret-for-test",
    fetchImpl: async (url, options) => {
      assert.equal(options.headers.apikey, "secret-for-test");
      return new Response(
        JSON.stringify({ message: "secret-for-test SQL diagnostic" }),
        { status: 500 },
      );
    },
  });
  await assert.rejects(
    db.request("/rest/v1/kinlume_profiles"),
    (error) =>
      error.status === 503 &&
      !error.message.includes("secret-for-test") &&
      !error.message.includes("SQL"),
  );
});
test("persistent limits fail closed when the shared service denies a request", async () => {
  const db = store();
  db.request = async () => false;
  await assert.rejects(db.limit("test", 1), (error) => error.status === 429);
});
test("production accepts exact approved origins only, without localhost or wildcard subdomains", () => {
  const env = { VERCEL: "1", APP_ORIGINS: "https://kinlume.vercel.app" };
  assert.equal(trustedOrigin("https://kinlume.vercel.app", env), true);
  for (const value of [
    "http://127.0.0.1:5173",
    "https://kinlume.vercel.app.evil.test",
    "https://other.vercel.app",
    undefined,
  ])
    assert.equal(trustedOrigin(value, env), false);
});
test("hosted session cookies are Secure and HttpOnly and clear both tokens on logout", () => {
  let cookies;
  const response = {
    setHeader(name, value) {
      cookies = value;
    },
  };
  writeSession(response, {
    access_token: "access",
    refresh_token: "refresh",
    expires_in: 3600,
  });
  assert.equal(cookies.length, 2);
  assert.ok(
    cookies.every(
      (value) =>
        value.includes("HttpOnly") &&
        value.includes("Secure") &&
        value.includes("SameSite=Strict"),
    ),
  );
  writeSession(response, null);
  assert.ok(cookies.every((value) => value.includes("Max-Age=0")));
});
test("expired cloud tokens refresh only through Supabase and the refreshed user is verified", async () => {
  const calls = [];
  let cookies;
  const db = {
    request: async (route, options) => {
      calls.push(route);
      if (route === "/auth/v1/user" && options.token === "old")
        throw Object.assign(new Error("expired"), { status: 401 });
      if (route.includes("refresh_token"))
        return {
          access_token: "new",
          refresh_token: "rotated",
          expires_in: 3600,
        };
      return owner;
    },
  };
  const user = await cloudUser(
    { headers: { cookie: "kinlume_access=old; kinlume_refresh=refresh" } },
    {
      setHeader(name, value) {
        cookies = value;
      },
    },
    db,
  );
  assert.equal(user.id, owner.id);
  assert.equal(user.access, "new");
  assert.equal(calls.length, 3);
  assert.ok(cookies[0].includes("new"));
});
test("HTML deployment failures become a readable message rather than a JSON parser exception", async () => {
  await assert.rejects(
    responseJson(
      new Response("<html>404</html>", {
        status: 404,
        headers: { "Content-Type": "text/html" },
      }),
    ),
    /service is unavailable/,
  );
  assert.deepEqual(
    await responseJson(
      new Response('{"ok":true}', {
        headers: { "Content-Type": "application/json" },
      }),
    ),
    { ok: true },
  );
});
