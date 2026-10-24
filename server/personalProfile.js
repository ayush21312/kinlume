import {
  purposes,
  personalNeeds,
  circumstances,
  householdSizes,
  travelModes,
} from "../src/data/profileOptions.js";
const values = (options) => options.map(([value]) => value);
function choice(value, options, label) {
  if (!values(options).includes(value)) throw new Error(`Choose ${label}.`);
  return value;
}
function text(value, label, max, required = false) {
  if (value == null) value = "";
  if (
    typeof value !== "string" ||
    value.trim().length > max ||
    (required && !value.trim())
  )
    throw new Error(`Enter a valid ${label}.`);
  return value.trim();
}
function multiple(value, options, label, required = false) {
  if (
    !Array.isArray(value) ||
    value.length > options.length ||
    value.some((item) => !values(options).includes(item))
  )
    throw new Error(`Choose valid ${label}.`);
  const result = [...new Set(value)];
  if (required && !result.length)
    throw new Error("Choose at least one type of help.");
  return result;
}
export function validatePersonalProfile(input) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new Error("Complete the questionnaire.");
  const profile = {
    purpose: choice(input.purpose, purposes, "how you will use the app"),
    preferredName: text(input.preferredName, "preferred name", 60),
  };
  // Donors and organization managers do not need to disclose financial circumstances.
  if (profile.purpose !== "help") return { ...profile, aiConsent: false };
  const startTime = text(input.startTime, "available start time", 5, true),
    endTime = text(input.endTime, "available end time", 5, true);
  if (
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(endTime) ||
    endTime <= startTime
  )
    throw new Error("Choose an end time later than the start time.");
  const maxTravelMinutes = Number(input.maxTravelMinutes);
  if (![15, 30, 45, 60, 90, 120, 180].includes(maxTravelMinutes))
    throw new Error("Choose a travel limit.");
  const notes = text(input.notes, "notes", 500);
  if (/\b\d{3}[- ]\d{2}[- ]\d{4}\b|\b\d{13,19}\b/.test(notes))
    throw new Error("Remove identity or payment numbers from your notes.");
  return {
    ...profile,
    needs: multiple(input.needs, personalNeeds, "needs", true),
    location: text(input.location, "city or postal code", 100, true),
    circumstances: multiple(
      input.circumstances || [],
      circumstances,
      "circumstances",
    ),
    householdSize: choice(
      input.householdSize || "unknown",
      householdSizes,
      "household size",
    ),
    transport: choice(
      input.transport || "unknown",
      travelModes,
      "transportation",
    ),
    maxTravelMinutes,
    startTime,
    endTime,
    stepFree: input.stepFree === true,
    notes,
    aiConsent: input.aiConsent === true,
  };
}
export function assistantProfile(profile) {
  if (profile?.aiConsent !== true || profile.purpose !== "help") return null;
  // Names, account emails and private free-text notes never enter the AI payload.
  return {
    needs: profile.needs,
    area: profile.location,
    transport: profile.transport,
    challenges: profile.circumstances.map(
      (value) => circumstances.find(([id]) => id === value)?.[1],
    ),
    household: householdSizes.find(([id]) => id === profile.householdSize)?.[1],
    stepFree: profile.stepFree,
    maxTravelMinutes: profile.maxTravelMinutes,
    availableFrom: profile.startTime,
    backBy: profile.endTime,
  };
}
