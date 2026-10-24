// All donation changes pass through these rules, so both views use the same totals.
export const DONATION_STORAGE_KEY = "helping-hand-donations-v1";
export const emptyDonations = () => ({
  version: 1,
  organization: null,
  requests: [],
  pledges: [],
});

function text(value, label, maximum = 120) {
  if (
    typeof value !== "string" ||
    !value.trim() ||
    value.trim().length > maximum
  )
    throw new Error(`Enter a valid ${label}.`);
  return value.trim();
}

export function quantity(value) {
  // Reject decimals, signs, exponents and partial numbers rather than rounding.
  const raw = String(value);
  if (
    !/^\d+$/.test(raw) ||
    !Number.isSafeInteger(Number(raw)) ||
    Number(raw) < 1 ||
    Number(raw) > 1000000
  )
    throw new Error("Enter a whole quantity between 1 and 1,000,000.");
  return Number(raw);
}

export function requestTotals(state, requestId) {
  const request = state.requests.find((item) => item.id === requestId);
  if (!request) throw new Error("This request no longer exists.");
  const pledges = state.pledges.filter((item) => item.requestId === requestId);
  const received = pledges.reduce((sum, item) => sum + item.received, 0);
  // A delivered item stops being an outstanding pledge. It is counted only once.
  const pledged = pledges.reduce(
    (sum, item) => sum + (item.cancelled ? 0 : item.quantity - item.received),
    0,
  );
  return {
    requested: request.quantity,
    pledged,
    received,
    remaining: Math.max(0, request.quantity - pledged - received),
  };
}

export function validateDonationState(state) {
  if (
    !state ||
    state.version !== 1 ||
    !Array.isArray(state.requests) ||
    !Array.isArray(state.pledges)
  )
    throw new Error("Saved donation data could not be read.");
  const ids = new Set();
  function unique(id) {
    if (typeof id !== "string" || !id || ids.has(id))
      throw new Error("Invalid donation record.");
    ids.add(id);
  }
  if (state.organization) {
    text(state.organization.name, "organization name");
    text(state.organization.city, "city");
  }
  for (const request of state.requests) {
    unique(request.id);
    text(request.item, "item name");
    text(request.unit, "unit", 40);
    quantity(request.quantity);
    if (
      !state.organization ||
      !["food", "clothing", "hygiene", "other"].includes(request.category)
    )
      throw new Error("Invalid supply request.");
  }
  for (const pledge of state.pledges) {
    unique(pledge.id);
    quantity(pledge.quantity);
    if (
      !state.requests.some((request) => request.id === pledge.requestId) ||
      !Number.isSafeInteger(pledge.received) ||
      pledge.received < 0 ||
      pledge.received > pledge.quantity ||
      typeof pledge.cancelled !== "boolean"
    )
      throw new Error("Invalid pledge record.");
  }
  for (const request of state.requests) {
    const totals = requestTotals(state, request.id);
    if (totals.pledged + totals.received > totals.requested)
      throw new Error("Donation totals exceed the request.");
  }
  return state;
}

export function readDonations(storage) {
  const saved = storage.getItem(DONATION_STORAGE_KEY);
  return saved === null
    ? emptyDonations()
    : validateDonationState(JSON.parse(saved));
}

export function changeDonations(state, action) {
  validateDonationState(state);
  const next = structuredClone(state);
  if (action.type === "organization") {
    next.organization = {
      name: text(action.name, "organization name"),
      city: text(action.city, "city"),
    };
  } else if (action.type === "request") {
    if (!next.organization) throw new Error("Add your organization first.");
    if (!["food", "clothing", "hygiene", "other"].includes(action.category))
      throw new Error("Choose an item category.");
    next.requests.unshift({
      id: action.id,
      item: text(action.item, "item name"),
      unit: text(action.unit, "unit", 40),
      category: action.category,
      quantity: quantity(action.quantity),
    });
  } else if (action.type === "pledge") {
    const amount = quantity(action.quantity);
    const totals = requestTotals(next, action.requestId);
    if (amount > totals.remaining)
      throw new Error(
        `Only ${totals.remaining} more are needed. Reduce your quantity.`,
      );
    next.pledges.unshift({
      id: action.id,
      requestId: action.requestId,
      quantity: amount,
      received: 0,
      cancelled: false,
    });
  } else if (action.type === "receive" || action.type === "cancel") {
    const pledge = next.pledges.find((item) => item.id === action.pledgeId);
    if (!pledge || pledge.cancelled)
      throw new Error("This pledge is no longer active.");
    if (action.type === "cancel") {
      if (pledge.quantity === pledge.received)
        throw new Error("This pledge has already been received.");
      pledge.cancelled = true;
    } else {
      const amount = quantity(action.quantity);
      if (amount > pledge.quantity - pledge.received)
        throw new Error(
          "The received quantity exceeds the outstanding pledge.",
        );
      pledge.received += amount;
    }
  } else throw new Error("Unknown donation action.");
  return validateDonationState(next);
}
