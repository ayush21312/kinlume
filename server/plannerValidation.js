import { minuteOfDay } from './plannerTime.js';

export function validatePlannerProfile(value) {
  const fail = (message) => {
    throw Object.assign(new Error(message), { status: 400 });
  };
  if (!value || typeof value !== 'object' || Array.isArray(value))
    fail('Complete the visit preferences.');
  const allowedNeeds = ['food', 'clothing', 'hygiene', 'programs'];
  const needs = Array.isArray(value.needs) ? [...new Set(value.needs)] : [];
  if (
    !needs.length ||
    needs.length > 4 ||
    needs.some((need) => !allowedNeeds.includes(need))
  )
    fail('Choose at least one type of help.');
  const location =
    typeof value.location === 'string' ? value.location.trim() : '';
  if (
    !location ||
    location.length > 100 ||
    !/^[\p{L}\p{N}\s,.'-]+$/u.test(location)
  )
    fail('Enter a city and state or country.');
  if (!['walk', 'transit', 'car', 'ride', 'unknown'].includes(value.transport))
    fail('Choose how you will travel.');
  const date = typeof value.date === 'string' ? value.date : '';
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    !Number.isFinite(Date.parse(`${date}T12:00:00Z`)) ||
    new Date(`${date}T12:00:00Z`).toISOString().slice(0, 10) !== date
  )
    fail('Choose a valid visit date.');
  const start = minuteOfDay(value.startTime),
    end = minuteOfDay(value.endTime);
  if (start === null || end === null || end <= start)
    fail('End time must be later than start time on the same day.');
  const maxTravelMinutes = Number(value.maxTravelMinutes);
  const visitMinutes = Number(value.visitMinutes || 20);
  if (
    !Number.isInteger(maxTravelMinutes) ||
    maxTravelMinutes < 5 ||
    maxTravelMinutes > 180
  )
    fail('Travel limit must be between 5 and 180 minutes one way.');
  if (
    !Number.isInteger(visitMinutes) ||
    visitMinutes < 10 ||
    visitMinutes > 120
  )
    fail('Allow between 10 and 120 minutes for a visit.');
  const timeZone =
    typeof value.timeZone === 'string' ? value.timeZone.trim() : '';
  if (timeZone) {
    try {
      new Intl.DateTimeFormat('en', { timeZone }).format();
    } catch {
      fail('Choose a valid time zone, such as America/New_York.');
    }
  }
  const travelOverrides = {};
  // Only travel times are accepted here, never browser-supplied listing facts.
  for (const [id, minutes] of Object.entries(value.travelOverrides || {}).slice(
    0,
    10,
  )) {
    if (
      !/^[a-z0-9-]{1,80}$/.test(id) ||
      !Number.isInteger(Number(minutes)) ||
      Number(minutes) < 0 ||
      Number(minutes) > 360
    )
      fail('Enter a valid one-way travel time.');
    travelOverrides[id] = Number(minutes);
  }
  return {
    needs,
    location,
    transport: value.transport,
    date,
    startTime: value.startTime,
    endTime: value.endTime,
    maxTravelMinutes,
    visitMinutes,
    timeZone,
    stepFree: value.stepFree === true,
    includeSeniors: value.includeSeniors === true,
    includeVeterans: value.includeVeterans === true,
    travelOverrides,
  };
}
