import test from "node:test";
import assert from "node:assert/strict";
import {
  emptyDonations,
  changeDonations,
  requestTotals,
  readDonations,
  validateDonationState,
  quantity,
} from "../src/utils/donations.js";

function setup() {
  const org = changeDonations(emptyDonations(), {
    type: "organization",
    name: "Test pantry",
    city: "Test city",
  });
  return changeDonations(org, {
    type: "request",
    id: "request",
    item: "Canned beans",
    unit: "cans",
    quantity: "100",
    category: "food",
  });
}
const pledge = (state, amount, id = "pledge") =>
  changeDonations(state, {
    type: "pledge",
    id,
    requestId: "request",
    quantity: amount,
  });

test("pledges reserve outstanding need but do not count as received", () => {
  const state = pledge(setup(), 30);
  assert.deepEqual(requestTotals(state, "request"), {
    requested: 100,
    pledged: 30,
    received: 0,
    remaining: 70,
  });
});
test("partial and complete receipts move items from pledged to received once", () => {
  const state = pledge(setup(), 30);
  const partial = changeDonations(state, {
    type: "receive",
    pledgeId: "pledge",
    quantity: 12,
  });
  assert.deepEqual(requestTotals(partial, "request"), {
    requested: 100,
    pledged: 18,
    received: 12,
    remaining: 70,
  });
  const delivered = changeDonations(partial, {
    type: "receive",
    pledgeId: "pledge",
    quantity: 18,
  });
  assert.deepEqual(requestTotals(delivered, "request"), {
    requested: 100,
    pledged: 0,
    received: 30,
    remaining: 70,
  });
  assert.throws(() =>
    changeDonations(delivered, {
      type: "receive",
      pledgeId: "pledge",
      quantity: 1,
    }),
  );
});
test("cancelling a partially received pledge releases only undelivered items", () => {
  let state = pledge(setup(), 30);
  state = changeDonations(state, {
    type: "receive",
    pledgeId: "pledge",
    quantity: 12,
  });
  state = changeDonations(state, { type: "cancel", pledgeId: "pledge" });
  assert.deepEqual(requestTotals(state, "request"), {
    requested: 100,
    pledged: 0,
    received: 12,
    remaining: 88,
  });
  assert.throws(() =>
    changeDonations(state, {
      type: "receive",
      pledgeId: "pledge",
      quantity: 1,
    }),
  );
  assert.throws(() =>
    changeDonations(state, { type: "cancel", pledgeId: "pledge" }),
  );
});
test("multiple pledges cannot overfill a request", () => {
  let state = pledge(setup(), 30);
  assert.throws(() => pledge(state, 71, "second"));
  state = pledge(state, 70, "second");
  assert.equal(requestTotals(state, "request").remaining, 0);
  assert.throws(() => pledge(state, 1, "third"));
});
test("negative, decimal, zero, nonfinite and malformed quantities are rejected", () => {
  for (const value of [
    -1,
    0,
    1.2,
    NaN,
    Infinity,
    "",
    "1e2",
    "3x",
    "+2",
    " 2",
    1000001,
  ]) {
    assert.throws(() => quantity(value));
    assert.throws(() => pledge(setup(), value));
  }
});
test("invalid requests and identifiers cannot change existing records", () => {
  const state = pledge(setup(), 10);
  assert.throws(() => pledge(state, 5));
  assert.throws(() =>
    changeDonations(state, {
      type: "pledge",
      id: "x",
      requestId: "missing",
      quantity: 1,
    }),
  );
  assert.throws(() =>
    changeDonations(emptyDonations(), {
      type: "request",
      id: "x",
      item: "Food",
      unit: "cans",
      quantity: 1,
      category: "food",
    }),
  );
  assert.throws(() =>
    changeDonations(state, {
      type: "request",
      id: "x",
      item: " ",
      unit: "cans",
      quantity: 1,
      category: "food",
    }),
  );
  assert.equal(state.pledges[0].quantity, 10);
});
test("saved state survives serialization and corrupted data fails closed", () => {
  const state = pledge(setup(), 20);
  assert.deepEqual(
    readDonations({ getItem: () => JSON.stringify(state) }),
    state,
  );
  assert.deepEqual(readDonations({ getItem: () => null }), emptyDonations());
  assert.throws(() => readDonations({ getItem: () => "{bad" }));
  assert.throws(() =>
    validateDonationState({
      ...state,
      pledges: [{ ...state.pledges[0], received: 21 }],
    }),
  );
  assert.throws(() =>
    validateDonationState({
      ...state,
      requests: [{ ...state.requests[0], quantity: 10 }],
    }),
  );
});
test("separate requests retain independent totals and input state is immutable", () => {
  const before = setup();
  const next = pledge(before, 100);
  assert.equal(before.pledges.length, 0);
  assert.equal(requestTotals(next, "request").received, 0);
  assert.throws(() =>
    changeDonations(next, {
      type: "receive",
      pledgeId: "pledge",
      quantity: 101,
    }),
  );
  const delivered = changeDonations(next, {
    type: "receive",
    pledgeId: "pledge",
    quantity: 100,
  });
  assert.deepEqual(requestTotals(delivered, "request"), {
    requested: 100,
    pledged: 0,
    received: 100,
    remaining: 0,
  });
  assert.throws(() =>
    changeDonations(delivered, { type: "cancel", pledgeId: "pledge" }),
  );
});
