import tzLookup from '@photostructure/tz-lookup';
import { distanceMiles } from '../src/utils/resourceData.js';
import { validatePlannerProfile } from './plannerValidation.js';
import { openingWindows } from './openingWindows.js';
import {
  addDays,
  dateInZone,
  localTimestamp,
  minuteOfDay,
  displayTime,
} from './plannerTime.js';

function zoneAt(point) {
  try {
    return tzLookup(point.lat, point.lng ?? point.lon);
  } catch {
    return null;
  }
}

function accessStatus(resource) {
  const text = String(resource.accessibility || '');
  if (
    /not (?:wheelchair )?accessible|wheelchair(?: access)?\s*[:=]\s*no\b|ADA accessibility:\s*no\b/i.test(
      text,
    )
  )
    return 'no';
  if (/limited|unknown|not (?:known|listed|specified)/i.test(text))
    return 'unknown';
  if (
    /wheelchair(?: access)?\s*[:=]\s*yes\b|ADA accessibility:\s*yes\b|step.free\s*[:=]\s*yes\b/i.test(
      text,
    )
  )
    return 'yes';
  return 'unknown';
}

function travelFor(resource, origin, profile) {
  if (Object.hasOwn(profile.travelOverrides, resource.id))
    return {
      minutes: profile.travelOverrides[resource.id],
      source: 'provided',
      label: 'One-way time you entered',
    };
  if (
    !origin ||
    !resource.coordinates ||
    !['walk', 'car'].includes(profile.transport)
  )
    return {
      minutes: null,
      source: 'unknown',
      label: 'Travel time needs confirmation',
    };
  const miles = distanceMiles(origin, resource.coordinates);
  const speed = profile.transport === 'walk' ? 3 : 20;
  const buffer = profile.transport === 'walk' ? 5 : 10;
  // Haversine distance is NOT a road or walking route. Use a conservative
  // multiplier and mark every result as an estimate, never live directions.
  const minutes = Math.ceil((((miles * 1.4) / speed) * 60 + buffer) / 5) * 5;
  return {
    minutes,
    source: 'estimate',
    miles: Math.round(miles * 10) / 10,
    label: 'Estimated one-way time from the search area centre',
  };
}

function serviceIntervals(resource, start, end, timeZone) {
  const intervals = [];
  let known = true;
  const firstDate = dateInZone(start, timeZone),
    lastDate = dateInZone(end, timeZone);
  for (let date = firstDate; date <= lastDate; date = addDays(date, 1)) {
    const schedule = openingWindows(resource.hours, date);
    if (!schedule.known) {
      known = false;
      continue;
    }
    for (const [open, close] of schedule.windows) {
      const begins = localTimestamp(date, open, timeZone),
        ends = localTimestamp(date, close, timeZone);
      if (begins == null || ends == null) {
        known = false;
        continue;
      }
      intervals.push([begins, ends]);
    }
  }
  return { known, intervals };
}

export function buildVisitPlan(
  rawProfile,
  resources,
  origin,
  { now = Date.now() } = {},
) {
  const profile = validatePlannerProfile(rawProfile);
  const automaticZone = zoneAt(origin);
  const timeZone = profile.timeZone || automaticZone || 'UTC';
  const today = dateInZone(now, timeZone);
  if (profile.date < today || profile.date > addDays(today, 90))
    throw Object.assign(
      new Error('Choose a visit date from today through the next 90 days.'),
      { status: 400 },
    );
  let start = localTimestamp(
    profile.date,
    minuteOfDay(profile.startTime),
    timeZone,
  );
  const end = localTimestamp(
    profile.date,
    minuteOfDay(profile.endTime),
    timeZone,
  );
  if (start == null || end == null)
    throw Object.assign(
      new Error(
        'That clock time is skipped or repeated by a daylight-saving change. Choose a different time.',
      ),
      { status: 400 },
    );
  start = Math.max(start, now);
  const options = [],
    excluded = [],
    referrals = [];
  const reject = (resource, reason) =>
    excluded.push({ id: resource.id, name: resource.name, reason });
  if (start >= end)
    return {
      profile,
      status: 'none',
      message:
        'That time window has already passed. Choose a later time or date.',
      timeZone,
      options: [],
      resources: [],
      excluded: [],
      referrals: [],
      unmetNeeds: profile.needs,
    };

  for (const resource of resources) {
    const matchedNeeds = profile.needs.filter((need) =>
      resource.categories?.includes(need),
    );
    if (!matchedNeeds.length) continue;
    if (resource.coverage && !resource.coordinates) {
      referrals.push(resource);
      continue;
    }
    if (
      !profile.includeSeniors &&
      /senior|age(?:d)?\s*60|adults\s*(?:age\s*)?60/i.test(
        `${resource.serviceLabel} ${resource.eligibility}`,
      )
    ) {
      reject(resource, 'Senior services were not selected.');
      continue;
    }
    if (
      !profile.includeVeterans &&
      /veteran/i.test(`${resource.name} ${resource.eligibility}`)
    ) {
      reject(resource, 'Veteran services were not selected.');
      continue;
    }
    const access = accessStatus(resource);
    if (profile.stepFree && access === 'no') {
      reject(resource, 'The listing reports no wheelchair access.');
      continue;
    }
    const travel = travelFor(resource, origin, profile);
    const minutes = travel.minutes || 0;
    if (travel.minutes != null && minutes > profile.maxTravelMinutes) {
      reject(
        resource,
        `${travel.source === 'estimate' ? 'Estimated' : 'Entered'} one-way travel exceeds your ${profile.maxTravelMinutes}-minute limit.`,
      );
      continue;
    }
    if (2 * minutes + profile.visitMinutes > (end - start) / 60000) {
      reject(
        resource,
        'Travel, a visit, and returning would exceed your available time.',
      );
      continue;
    }
    const resourceZone =
      resource.timeZone ||
      profile.timeZone ||
      zoneAt(resource.coordinates) ||
      timeZone;
    // Some directories publish administrative office hours, not supply hours.
    const officeHours =
      matchedNeeds.some((need) =>
        ['food', 'clothing', 'hygiene'].includes(need),
      ) &&
      /main office|office location|office hours|administrative/i.test(
        `${resource.eligibility || ''} ${resource.description || ''}`,
      );
    const schedule = officeHours
      ? { known: false, intervals: [] }
      : serviceIntervals(resource, start, end, resourceZone);
    const earliestArrival = start + minutes * 60000;
    const latestFinish = end - minutes * 60000;
    const interval = schedule.intervals.find(
      ([opens, closes]) =>
        Math.max(opens, earliestArrival) + profile.visitMinutes * 60000 <=
        Math.min(closes, latestFinish),
    );
    if (schedule.known && !interval) {
      reject(
        resource,
        'Published hours do not allow the visit and return within your time window.',
      );
      continue;
    }
    const appointment =
      /appointments?:\s*yes|appointment required|reservation|required appointment/i.test(
        resource.appointment || '',
      );
    const needsConfirmation =
      !schedule.known ||
      travel.minutes == null ||
      (profile.stepFree && access !== 'yes') ||
      appointment ||
      profile.transport === 'ride' ||
      profile.transport === 'unknown';
    const arrival =
      interval && travel.minutes != null
        ? Math.max(interval[0], earliestArrival)
        : null;
    const leave =
      arrival == null ? null : arrival + profile.visitMinutes * 60000;
    const reasons = [
      `Offers ${matchedNeeds.join(', ')} according to its listing.`,
    ];
    if (interval) reasons.push('Published hours overlap your available time.');
    if (travel.minutes != null)
      reasons.push(
        `${travel.source === 'estimate' ? 'About ' : ''}${minutes} minutes each way; within your travel limit.`,
      );
    if (profile.stepFree && access === 'yes')
      reasons.push(
        'The listing reports accessible entry; confirm your specific needs.',
      );
    const cautions = [];
    if (officeHours)
      cautions.push(
        'Published times may be office hours. Confirm when supplies are distributed.',
      );
    if (profile.transport === 'ride')
      cautions.push(
        'Arrange a ride first. Entering a travel time does not book transportation.',
      );
    if (profile.transport === 'transit')
      cautions.push(
        'Confirm that the service runs for both journeys. Use the longer of the outward and return travel times.',
      );
    if (!schedule.known)
      cautions.push(
        'Service hours are missing, unusual, or appointment-based. Confirm them first.',
      );
    if (travel.source === 'estimate')
      cautions.push(
        'Travel is a straight-line estimate, not a live route. Check roads, paths, crossings and traffic in directions.',
      );
    if (travel.minutes == null)
      cautions.push(
        profile.transport === 'ride'
          ? 'Arrange a ride and enter its one-way time before relying on this visit.'
          : 'Check a usable round-trip route and enter its one-way travel time.',
      );
    if (profile.stepFree && access !== 'yes')
      cautions.push(
        'Step-free access has not been confirmed. Contact the organization.',
      );
    if (appointment)
      cautions.push(
        'Arrange the listed appointment or reservation before travelling.',
      );
    const steps = [
      `Contact ${resource.name} to confirm services, eligibility, supplies and any appointment.`,
      travel.minutes == null
        ? 'Check directions and enter the one-way travel time to check the visit again.'
        : `Check ${profile.transport === 'transit' ? 'public-transport' : profile.transport === 'walk' ? 'walking' : 'travel'} directions; allow ${minutes} minutes each way ${travel.source === 'estimate' ? '(estimated from the search area centre)' : '(the time you entered)'}.`,
      arrival == null
        ? `Once hours and travel are confirmed, allow at least ${profile.visitMinutes} minutes on site and time to return.`
        : `Aim to arrive at ${displayTime(arrival, resourceZone)} (${resourceZone}); allow ${profile.visitMinutes} minutes on site.`,
    ];
    if (leave != null)
      steps.push(
        `Return by about ${displayTime(leave + minutes * 60000, timeZone)} (${timeZone}), subject to the route and current service conditions.`,
      );
    // Meeting more needs and having usable hours/access outrank simple distance.
    const score =
      matchedNeeds.length * 100 +
      (schedule.known ? 40 : 0) +
      (profile.stepFree && access === 'yes' ? 20 : 0) -
      (needsConfirmation ? 30 : 0) -
      Math.min(minutes, 180) / 10;
    options.push({
      resourceId: resource.id,
      matchedNeeds,
      fit: needsConfirmation ? 'confirm' : 'estimated',
      reasons,
      cautions,
      steps,
      travel,
      arrival: arrival == null ? null : new Date(arrival).toISOString(),
      resourceTimeZone: resourceZone,
      score,
    });
  }
  options.sort(
    (a, b) => b.score - a.score || a.resourceId.localeCompare(b.resourceId),
  );
  const selected = options.slice(0, 3);
  const listedResources = selected.map((option) =>
    resources.find((resource) => resource.id === option.resourceId),
  );
  const unmetNeeds = profile.needs.filter(
    (need) =>
      !selected.some((option) => option.matchedNeeds.includes(need)) &&
      !referrals.some((resource) => resource.categories.includes(need)),
  );
  return {
    profile,
    timeZone,
    timeZoneEstimated: !profile.timeZone,
    status: selected.length || referrals.length ? 'options' : 'none',
    message: selected.length
      ? selected.every((option) => option.fit === 'confirm')
        ? 'These options need confirmation before you can rely on a visit.'
        : 'These visit options fit using published hours and the travel assumptions shown.'
      : referrals.length
        ? 'No in-person visit fits. These online directories may still help.'
        : 'No suitable visit was found for these preferences.',
    options: selected,
    resources: listedResources,
    excluded: excluded.slice(0, 8),
    excludedCount: excluded.length,
    referrals: referrals.slice(0, 3),
    unmetNeeds,
    note: 'Options are separate visits, not a timed multi-stop route. Confirm service hours, eligibility and holiday changes before travelling.',
  };
}

export function compactPlan(plan) {
  return {
    status: plan.status,
    message: plan.message,
    note: plan.note,
    exclusionReasons: [
      ...new Set((plan.excluded || []).map((item) => item.reason)),
    ],
    timeZone: plan.timeZone,
    profile: plan.profile,
    unmetNeeds: plan.unmetNeeds,
    options: plan.options.map(
      ({ resourceId, fit, reasons, cautions, steps }) => ({
        resourceId,
        fit,
        reasons,
        cautions,
        steps,
      }),
    ),
  };
}
