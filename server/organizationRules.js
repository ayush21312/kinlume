import { randomUUID } from "node:crypto";
import {
  changeDonations,
  requestTotals,
  validateDonationState,
} from "../src/utils/donations.js";

function field(value, label, max = 120, required = true) {
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new Error(`Enter a valid ${label}.`);
  return value.trim();
}
function website(value = "") {
  if (!value) return "";
  const url = new URL(field(value, "website", 400));
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password
  )
    throw new Error("Use an http or https website address.");
  return url.href;
}
export function resourceFields(input, id) {
  const categories = [...new Set(input.categories || [])];
  if (
    !categories.length ||
    categories.some(
      (value) =>
        !["food", "clothing", "hygiene", "programs", "opportunities"].includes(
          value,
        ),
    )
  )
    throw new Error("Choose at least one service.");
  let coordinates = null;
  const hasLatitude = input.latitude !== "" && input.latitude != null;
  const hasLongitude = input.longitude !== "" && input.longitude != null;
  if (hasLatitude || hasLongitude) {
    const lat = Number(input.latitude),
      lng = Number(input.longitude);
    if (
      !hasLatitude ||
      !hasLongitude ||
      !Number.isFinite(lat) ||
      !Number.isFinite(lng) ||
      Math.abs(lat) > 90 ||
      Math.abs(lng) > 180
    )
      throw new Error(
        "Enter valid latitude and longitude, or leave both blank.",
      );
    coordinates = { lat, lng };
  }
  const category = categories[0];
  return {
    id,
    name: field(input.name, "resource name"),
    categories,
    category,
    city: field(input.city, "city"),
    country: field(input.country, "country", 80),
    address: field(input.address, "address", 300),
    description: field(input.description || "", "description", 1000, false),
    serviceLabel: field(input.serviceLabel, "service name"),
    hours:
      field(input.hours || "", "hours", 1000, false) ||
      "Contact the organization for hours.",
    eligibility:
      field(input.eligibility || "", "eligibility", 1000, false) ||
      "Confirm eligibility with the organization.",
    appointment:
      field(input.appointment || "", "appointment requirements", 500, false) ||
      "Contact the organization.",
    accessibility:
      field(input.accessibility || "", "accessibility", 500, false) ||
      "Contact the organization.",
    phone: field(input.phone || "", "phone number", 80, false),
    website: website(input.website),
    coordinates,
    published: input.published === true,
    sourceName: "Organization listing",
    sourceCheckedAt: new Date().toISOString().slice(0, 10),
    notes: [
      "Organization-provided information. Organization verification is not yet available.",
    ],
    image: {
      src: `/images/${category === "opportunities" ? "programs" : category}.jpg`,
      kind: "stock",
    },
  };
}

export function changeOrganization(state, action) {
  if (action.type === "import-device") {
    if (
      state.organization ||
      state.requests.length ||
      state.pledges.length ||
      state.resources?.length
    )
      throw new Error(
        "Import is only available for an empty organization account.",
      );
    const legacy = validateDonationState(action.legacy);
    if (!legacy.organization)
      throw new Error("No saved organization was found.");
    let next = changeOrganization(
      { ...state },
      { ...legacy.organization, type: "organization" },
    );
    const ids = new Map();
    for (const request of legacy.requests) {
      const id = randomUUID();
      ids.set(request.id, id);
      next = changeDonations(next, { ...request, id, type: "request" });
    }
    next.pledges = legacy.pledges.map((pledge) => ({
      id: randomUUID(),
      requestId: ids.get(pledge.requestId),
      quantity: pledge.quantity,
      received: pledge.received,
      cancelled: pledge.cancelled,
    }));
    return validateDonationState(next);
  }
  if (action.type === "edit-request") {
    const request = state.requests.find((value) => value.id === action.id);
    if (!request) throw new Error("Request not found.");
    const totals = requestTotals(state, request.id);
    const next = structuredClone(state);
    const index = next.requests.findIndex((value) => value.id === action.id);
    // Reuse creation validation, then preserve the identity referenced by pledges.
    const checked = changeDonations(
      { ...state, requests: [], pledges: [] },
      { ...action, type: "request" },
    ).requests[0];
    if (checked.quantity < totals.pledged + totals.received)
      throw new Error(
        "The target cannot be below the pledged and received total.",
      );
    if (
      state.pledges.some((value) => value.requestId === action.id) &&
      (checked.item !== request.item ||
        checked.unit !== request.unit ||
        checked.category !== request.category)
    )
      throw new Error(
        "Items with pledge history cannot be renamed or changed. Create a new request for a different item.",
      );
    next.requests[index] = { ...request, ...checked };
    return next;
  }
  if (action.type === "close-request") {
    const next = structuredClone(state),
      request = next.requests.find((value) => value.id === action.id);
    if (!request) throw new Error("Request not found.");
    request.closed = action.closed === true;
    return next;
  }
  if (action.type === "resource") {
    if (!state.organization) throw new Error("Save your organization first.");
    const next = structuredClone(state);
    const record = resourceFields(action, action.id);
    const index = (next.resources || []).findIndex(
      (value) => value.id === action.id,
    );
    next.resources ||= [];
    if (index < 0) next.resources.unshift(record);
    else next.resources[index] = record;
    return next;
  }
  if (action.type === "organization") {
    const next = changeDonations(state, action);
    next.organization.website = website(action.website);
    next.organization.phone = field(
      action.phone || "",
      "phone number",
      80,
      false,
    );
    return next;
  }
  if (
    action.type === "pledge" &&
    state.requests.find((value) => value.id === action.requestId)?.closed
  )
    throw new Error("This request is closed to new pledges.");
  return changeDonations(state, action);
}
