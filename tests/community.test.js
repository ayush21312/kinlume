import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import { mkdtempSync, unlinkSync, rmdirSync, readdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { CommunityStore } from "../server/communityStore.js";
import { communityApi } from "../server/communityApi.js";
import {
  organizationResults,
  setCommunityResourceSource,
} from "../server/communityDirectory.js";
import { searchResources, findResource } from "../server/resourceSearch.js";

const password = "Example-test-password-2026";
const resource = {
  name: "Example pantry",
  serviceLabel: "Food pantry",
  categories: ["food"],
  city: "Hackensack",
  country: "United States",
  address: "123 Example Street, Hackensack, NJ",
  hours: "Mon–Fri 9:00 AM–5:00 PM",
  eligibility: "Call first.",
  website: "https://example.org",
  published: true,
  latitude: "40.886",
  longitude: "-74.043",
};
async function fixture(filename = ":memory:") {
  const store = new CommunityStore(filename);
  const owner = await store.authenticate(
    "owner@example.invalid",
    password,
    true,
  );
  const donor = await store.authenticate(
    "donor@example.invalid",
    password,
    true,
  );
  const stranger = await store.authenticate(
    "stranger@example.invalid",
    password,
    true,
  );
  for (const person of [owner, donor, stranger])
    store.saveProfile(person, { purpose: "organization", preferredName: "" });
  store.act(owner, {
    type: "organization",
    name: "Example organization",
    city: "Hackensack",
  });
  store.act(owner, {
    type: "request",
    item: "Canned beans",
    unit: "cans",
    category: "food",
    quantity: 100,
  });
  return {
    store,
    owner,
    donor,
    stranger,
    requestId: store.view(owner).requests[0].id,
  };
}
test("real accounts store salted password hashes and revocable expiring sessions", async (t) => {
  const { store, owner } = await fixture();
  t.after(() => store.close());
  assert.equal(
    (await store.authenticate("OWNER@example.invalid", password)).id,
    owner.id,
  );
  await assert.rejects(
    () => store.authenticate("owner@example.invalid", "wrong-password-2026"),
    /incorrect/,
  );
  await assert.rejects(
    () => store.authenticate("owner@example.invalid", password, true),
    /already exists/,
  );
  await assert.rejects(
    () => store.authenticate("bad-email", password, true),
    /email/,
  );
  await assert.rejects(
    () => store.authenticate("short@example.invalid", "short", true),
    /12/,
  );
  const row = store.db
    .prepare("SELECT * FROM accounts WHERE id=?")
    .get(owner.id);
  assert.notEqual(row.password_hash, password);
  assert.equal(row.salt.length, 32);
  const token = store.createSession(owner);
  assert.equal(store.user(token).id, owner.id);
  assert.notEqual(
    store.db.prepare("SELECT token_hash FROM sessions").get().token_hash,
    token,
  );
  store.logout(token);
  assert.equal(store.user(token), null);
  const expired = store.createSession(owner);
  store.db.prepare("UPDATE sessions SET expires=0").run();
  assert.equal(store.user(expired), null);
});
test("ownership is enforced for profile, requests, resources, and deliveries", async (t) => {
  const { store, owner, donor, stranger, requestId } = await fixture();
  t.after(() => store.close());
  store.act(owner, { type: "resource", ...resource });
  const resourceId = store.view(owner).resources[0].id;
  store.act(donor, {
    type: "pledge",
    requestId,
    quantity: 30,
    donorId: owner.id,
  });
  const pledgeId = store.view(donor).pledges[0].id;
  assert.throws(
    () => store.act(null, { type: "receive", pledgeId, quantity: 10 }),
    (error) => error.status === 401,
  );
  for (const action of [
    {
      type: "edit-request",
      id: requestId,
      item: "Canned beans",
      unit: "cans",
      category: "food",
      quantity: 120,
    },
    { type: "close-request", id: requestId, closed: true },
    { type: "receive", pledgeId, quantity: 1 },
    { type: "cancel", pledgeId },
  ])
    assert.throws(
      () => store.act(stranger, action),
      (error) => error.status === 403,
    );
  assert.throws(
    () => store.act(donor, { type: "receive", pledgeId, quantity: 1 }),
    (error) => error.status === 403,
  );
  assert.throws(
    () =>
      store.act(stranger, { type: "resource", ...resource, id: resourceId }),
    (error) => error.status === 404,
  );
  assert.equal(store.view(stranger).resources.length, 0);
  assert.equal(store.view(stranger).pledges.length, 0);
  assert.equal(store.view(null).pledges.length, 0);
  assert.equal(store.view(owner).organization.name, "Example organization");
  assert.equal(store.view(donor).pledges.length, 1);
  assert.ok(!("donorId" in store.view(owner).pledges[0]));
  store.act(donor, {
    type: "organization",
    name: "Different organization",
    city: "Other city",
    ownerId: owner.id,
  });
  assert.equal(store.view(owner).organization.name, "Example organization");
});
test("edited requests, closed requests and partial receipts preserve donation accounting", async (t) => {
  const { store, owner, donor, requestId } = await fixture();
  t.after(() => store.close());
  store.act(donor, { type: "pledge", requestId, quantity: 30 });
  const pledgeId = store.view(donor).pledges[0].id;
  store.act(owner, { type: "receive", pledgeId, quantity: 12 });
  let request = store.view(owner).requests[0];
  assert.deepEqual(request.totals, {
    requested: 100,
    pledged: 18,
    received: 12,
    remaining: 70,
  });
  const edit = {
    type: "edit-request",
    id: requestId,
    item: request.item,
    unit: request.unit,
    category: request.category,
  };
  assert.throws(() => store.act(owner, { ...edit, quantity: 29 }), /below/);
  assert.throws(
    () => store.act(owner, { ...edit, item: "Other food", quantity: 150 }),
    /cannot be renamed/,
  );
  store.act(owner, { ...edit, quantity: 120 });
  assert.equal(store.view(owner).requests[0].totals.remaining, 90);
  store.act(owner, { type: "close-request", id: requestId, closed: true });
  assert.throws(
    () => store.act(donor, { type: "pledge", requestId, quantity: 1 }),
    /closed/,
  );
  store.act(owner, { type: "receive", pledgeId, quantity: 18 });
  assert.throws(
    () => store.act(owner, { type: "receive", pledgeId, quantity: 1 }),
    /exceeds/,
  );
  store.act(owner, { type: "close-request", id: requestId, closed: false });
  assert.equal(store.view(owner).requests[0].totals.received, 30);
  assert.throws(
    () => store.act(donor, { type: "pledge", requestId, quantity: 91 }),
    /Only 90/,
  );
});
test("resource edits stay private until published, use safe links, and cannot forge directory records", async (t) => {
  const { store, owner } = await fixture();
  t.after(() => store.close());
  store.act(owner, { type: "resource", ...resource, published: false });
  let record = store.view(owner).resources[0];
  assert.equal(store.publicResources().length, 0);
  assert.throws(
    () =>
      store.act(owner, {
        type: "resource",
        ...resource,
        website: "javascript:alert(1)",
      }),
    /http/,
  );
  assert.throws(
    () => store.act(owner, { type: "resource", ...resource, latitude: 91 }),
    /latitude/,
  );
  assert.throws(
    () => store.act(owner, { type: "resource", ...resource, categories: [] }),
    /service/,
  );
  assert.throws(
    () => store.act(owner, { type: "resource", ...resource, id: "feedam-123" }),
    /not found/,
  );
  store.act(owner, {
    type: "resource",
    ...resource,
    id: record.id,
    hours: "Mon–Fri 10:00 AM–4:00 PM",
  });
  assert.equal(store.publicResources()[0].hours, "Mon–Fri 10:00 AM–4:00 PM");
  assert.ok(store.publicResources()[0].notes[0].includes("verification"));
  store.act(owner, {
    type: "resource",
    ...resource,
    id: record.id,
    published: false,
  });
  assert.equal(store.publicResources().length, 0);
});
test("accounts, resources, requests, deliveries and sessions survive closing and reopening the database", async () => {
  const directory = mkdtempSync(join(tmpdir(), "helping-hand-db-test-"));
  const filename = join(directory, "test.sqlite");
  let store;
  try {
    const data = await fixture(filename);
    store = data.store;
    store.act(data.owner, { type: "resource", ...resource });
    store.act(data.donor, {
      type: "pledge",
      requestId: data.requestId,
      quantity: 20,
    });
    store.act(data.owner, {
      type: "receive",
      pledgeId: store.view(data.owner).pledges[0].id,
      quantity: 5,
    });
    const token = store.createSession(data.owner);
    store.close();
    store = new CommunityStore(filename);
    const user = store.user(token);
    assert.equal(user.id, data.owner.id);
    assert.equal(store.view(user).requests[0].totals.received, 5);
    assert.equal(store.publicResources().length, 1);
    assert.equal(
      (await store.authenticate("owner@example.invalid", password)).id,
      data.owner.id,
    );
  } finally {
    store?.close();
    for (const name of readdirSync(directory))
      unlinkSync(join(directory, name));
    rmdirSync(directory);
  }
});
test("published organization resources join directory search without leaking into other countries", async (t) => {
  const { store, owner } = await fixture();
  t.after(() => {
    setCommunityResourceSource(() => []);
    store.close();
  });
  store.act(owner, { type: "resource", ...resource });
  setCommunityResourceSource(() => store.publicResources());
  const record = store.publicResources()[0];
  assert.equal(
    organizationResults(
      { location: "Hackensack, NJ", category: "food" },
      { countryCode: "US" },
    ).length,
    1,
  );
  assert.equal(
    organizationResults(
      { location: "Hackensack, Canada" },
      { countryCode: "CA" },
    ).length,
    0,
  );
  assert.equal(
    organizationResults(
      { location: "Hackensack, NJ", category: "clothing" },
      { countryCode: "US" },
    ).length,
    0,
  );
  assert.equal(
    organizationResults({ location: "London, UK" }, { countryCode: "GB" })
      .length,
    0,
  );
  assert.equal(
    organizationResults(
      { location: "Hackensack, NJ" },
      { center: { lat: 40.886, lng: -74.043 }, countryCode: "US" },
    ).length,
    1,
  );
  assert.equal((await findResource(record.id)).id, record.id);
  const result = await searchResources(
    { location: "Hackensack, NJ", category: "food" },
    { fetchImpl: async () => ({ ok: false }) },
  );
  assert.ok(result.resources.some((value) => value.id === record.id));
  store.act(owner, {
    type: "resource",
    ...resource,
    id: record.id,
    published: false,
  });
  assert.equal(await findResource(record.id), null);
});
test("HTTP sessions use HttpOnly cookies and reject forged origins and unauthenticated writes", async (t) => {
  const store = new CommunityStore(":memory:");
  const json = (res, status, data) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const handler = communityApi(store, {
    json,
    requestBody: async (req) => {
      let body = "";
      for await (const chunk of req) body += chunk;
      return JSON.parse(body);
    },
  });
  const server = http.createServer(async (req, res) => {
    if (!(await handler(req, res, new URL(req.url, "http://localhost"))))
      json(res, 404, {});
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    store.close();
  });
  const base = `http://127.0.0.1:${server.address().port}/api/community`;
  const post = (route, body, cookie = "", origin = "http://127.0.0.1:5173") =>
    fetch(base + route, {
      method: "POST",
      headers: {
        Origin: origin,
        "Content-Type": "application/json",
        Cookie: cookie,
      },
      body: JSON.stringify(body),
    });
  assert.equal(
    (
      await post("/action", {
        action: { type: "organization", name: "X", city: "Y" },
      })
    ).status,
    401,
  );
  assert.equal(
    (
      await post(
        "/register",
        { email: "web@example.invalid", password },
        "",
        "https://attacker.invalid",
      )
    ).status,
    403,
  );
  const registered = await post("/register", {
    email: "web@example.invalid",
    password,
  });
  assert.equal(registered.status, 200);
  const cookie = registered.headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /SameSite=Strict/);
  assert.equal(
    (
      await fetch(base, { headers: { Cookie: cookie.split(";")[0] } }).then(
        (r) => r.json(),
      )
    ).user.email,
    "web@example.invalid",
  );
  await post(
    "/profile",
    { profile: { purpose: "organization", preferredName: "" } },
    cookie.split(";")[0],
  );
  assert.equal(
    (
      await post(
        "/action",
        { action: { type: "organization", name: "Web test", city: "X" } },
        cookie.split(";")[0],
      )
    ).status,
    200,
  );
  await post("/logout", {}, cookie.split(";")[0]);
  assert.equal(
    (
      await fetch(base, { headers: { Cookie: cookie.split(";")[0] } }).then(
        (r) => r.json(),
      )
    ).user,
    null,
  );
});

test("legacy device records import once into the signed-in account without forged ownership", async (t) => {
  const { store, owner, stranger } = await fixture();
  t.after(() => store.close());
  const importer = await store.authenticate(
    "import@example.invalid",
    password,
    true,
  );
  const legacy = {
    version: 1,
    organization: { name: "Device example", city: "Hackensack" },
    requests: [
      {
        id: "old-request",
        item: "Cans",
        unit: "cans",
        category: "food",
        quantity: 100,
      },
    ],
    pledges: [
      {
        id: "old-pledge",
        requestId: "old-request",
        quantity: 30,
        received: 12,
        cancelled: false,
        donorId: stranger.id,
      },
    ],
    resources: [{ id: "forged", published: true }],
  };
  store.saveProfile(importer, { purpose: "organization", preferredName: "" });
  store.act(importer, { type: "import-device", legacy, ownerId: owner.id });
  const view = store.view(importer);
  const imported = view.requests.find((request) => request.managed);
  assert.notEqual(imported.id, "old-request");
  assert.deepEqual(imported.totals, {
    requested: 100,
    pledged: 18,
    received: 12,
    remaining: 70,
  });
  assert.equal(view.pledges.length, 1);
  assert.equal(view.resources.length, 0);
  assert.equal(store.view(stranger).pledges.length, 0);
  assert.throws(
    () => store.act(importer, { type: "import-device", legacy }),
    /empty organization/,
  );
  assert.equal(store.view(owner).organization.name, "Example organization");
});

test("organization records without coordinates remain searchable during provider outages", async (t) => {
  const { store } = await fixture();
  t.after(() => {
    setCommunityResourceSource(() => []);
    store.close();
  });
  setCommunityResourceSource(() => [
    { id: "org-example", ...resource, city: "Fictiontown", coordinates: null },
  ]);
  const result = await searchResources(
    { location: "Fictiontown, US", category: "food" },
    { fetchImpl: async () => ({ ok: false }) },
  );
  assert.ok(result.resources.some((record) => record.id === "org-example"));
  assert.equal(
    organizationResults({ location: "Fictiontown, Canada", category: "food" })
      .length,
    0,
  );
});
