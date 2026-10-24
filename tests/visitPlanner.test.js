import test from 'node:test';
import assert from 'node:assert/strict';
import { openingWindows } from '../server/openingWindows.js';
import { buildVisitPlan } from '../server/visitPlanner.js';
import { localTimestamp, dateInZone } from '../server/plannerTime.js';
import { validatePlannerProfile } from '../server/plannerValidation.js';

const now = Date.parse('2026-10-19T12:00:00Z');
const origin = { lat: 40.89, lng: -74.04 };
const profile = {
  needs: ['food'],
  location: 'Hackensack, NJ',
  transport: 'walk',
  date: '2026-10-20',
  startTime: '09:00',
  endTime: '12:00',
  maxTravelMinutes: 30,
  visitMinutes: 20,
  timeZone: 'America/New_York',
};
const pantry = {
  id: 'test-pantry',
  name: 'Test pantry',
  categories: ['food'],
  hours: 'Tu 09:00-12:00',
  eligibility: 'Contact to confirm.',
  appointment: 'No appointment listed.',
  accessibility: 'Wheelchair access: yes',
  coordinates: { lat: 40.891, lng: -74.041 },
  timeZone: 'America/New_York',
};
const plan = (records = [pantry], changes = {}) =>
  buildVisitPlan({ ...profile, ...changes }, records, origin, { now });

test('hours support explicit weekday ranges, breaks and closed days', () => {
  assert.deepEqual(
    openingWindows('Mon - Fri: 9:00am - 5:00pm', '2026-10-20').windows,
    [[540, 1020]],
  );
  assert.deepEqual(
    openingWindows('Mo-Fr 09:00-12:00,13:00-17:00; Sa-Su off', '2026-10-20')
      .windows,
    [
      [540, 720],
      [780, 1020],
    ],
  );
  assert.deepEqual(
    openingWindows('Mo-Fr 09:00-17:00; Sa-Su off', '2026-10-24'),
    { known: true, windows: [] },
  );
  assert.deepEqual(
    openingWindows('Monday: 09:00-17:00\nTuesday: Closed', '2026-10-20'),
    { known: true, windows: [] },
  );
});

test('monthly, incomplete, ambiguous and appointment-based hours stay unknown', () => {
  for (const hours of [
    'Second and fourth Tuesday, 3:30pm',
    'By appointment',
    'Mon-Fri: 9-5',
    'Call for hours',
    'Tu 09:00-11:00; PH off',
  ])
    assert.equal(openingWindows(hours, '2026-10-20').known, false, hours);
  assert.equal(openingWindows('Mo 09:00-17:00', '2026-10-20').known, false);
});

test('overnight opening windows carry into the following day', () => {
  assert.deepEqual(openingWindows('Mo 22:00-02:00', '2026-10-20'), {
    known: true,
    windows: [[0, 120]],
  });
});

test('a feasible visit includes arrival and return time with explicit estimates', () => {
  const result = plan();
  assert.equal(result.options.length, 1);
  assert.equal(result.options[0].fit, 'estimated');
  assert.equal(result.options[0].arrival, '2026-10-20T13:10:00.000Z');
  assert.match(result.options[0].cautions.join(' '), /not a live route/);
  assert.match(result.options[0].steps.at(-1), /Return by/);
});

test('a nearby closed resource loses to an open resource', () => {
  const result = plan([
    { ...pantry, id: 'closed', hours: 'Tu off' },
    { ...pantry, id: 'open' },
  ]);
  assert.deepEqual(
    result.options.map((option) => option.resourceId),
    ['open'],
  );
  assert.match(result.excluded[0].reason, /Published hours/);
});

test('travel limit and complete round trip both reject impossible visits', () => {
  assert.equal(
    plan([{ ...pantry, coordinates: { lat: 41.05, lng: -74.2 } }]).options
      .length,
    0,
  );
  const short = plan([pantry], { startTime: '09:00', endTime: '09:30' });
  assert.equal(short.status, 'none');
  assert.match(short.excluded[0].reason, /returning/);
});

test('a visit that cannot finish before closing is rejected', () => {
  const result = plan([{ ...pantry, hours: 'Tu 09:00-09:20' }]);
  assert.equal(result.options.length, 0);
  assert.match(result.excluded[0].reason, /Published hours/);
});

test('transit without a route is conditional, not a fabricated scheduled visit', () => {
  const result = plan([pantry], { transport: 'transit' });
  assert.equal(result.options[0].fit, 'confirm');
  assert.equal(result.options[0].arrival, null);
  assert.equal(result.options[0].travel.minutes, null);
  assert.match(result.options[0].cautions.join(' '), /round-trip route/);
});

test('user-entered transit time is checked, including the return leg', () => {
  const checked = plan([pantry], {
    transport: 'transit',
    travelOverrides: { 'test-pantry': 25 },
  });
  assert.equal(checked.options[0].travel.source, 'provided');
  assert.equal(checked.options[0].arrival, '2026-10-20T13:25:00.000Z');
  assert.equal(
    plan([pantry], {
      transport: 'transit',
      endTime: '09:50',
      travelOverrides: { 'test-pantry': 25 },
    }).options.length,
    0,
  );
});

test('accessibility excludes known barriers but asks about missing information', () => {
  assert.equal(
    plan([{ ...pantry, accessibility: 'Wheelchair access: no' }], {
      stepFree: true,
    }).options.length,
    0,
  );
  const result = plan(
    [{ ...pantry, accessibility: 'Ask about access needs.' }],
    { stepFree: true },
  );
  assert.equal(result.options[0].fit, 'confirm');
  assert.match(result.options[0].cautions.join(' '), /Step-free/);
});

test('matching multiple needs outranks the nearest single-service option', () => {
  const result = plan(
    [
      { ...pantry, id: 'nearest' },
      {
        ...pantry,
        id: 'combined',
        categories: ['food', 'hygiene'],
        coordinates: { lat: 40.894, lng: -74.042 },
      },
    ],
    { needs: ['food', 'hygiene'] },
  );
  assert.equal(result.options[0].resourceId, 'combined');
  assert.deepEqual(result.unmetNeeds, []);
});

test('appointments and restricted service groups are not silently treated as walk-in visits', () => {
  assert.equal(
    plan([{ ...pantry, serviceLabel: 'Senior meal program' }]).options.length,
    0,
  );
  assert.equal(
    plan([{ ...pantry, serviceLabel: 'Senior meal program' }], {
      includeSeniors: true,
    }).options.length,
    1,
  );
  assert.equal(
    plan([{ ...pantry, appointment: 'Appointment required' }]).options[0].fit,
    'confirm',
  );
});

test('bad time ranges, dates, travel limits and forged listing fields are rejected or discarded', () => {
  for (const changes of [
    { endTime: '08:00' },
    { date: '2026-02-30' },
    { maxTravelMinutes: -1 },
    { timeZone: 'Fake/Zone' },
    { needs: [] },
  ])
    assert.throws(() => validatePlannerProfile({ ...profile, ...changes }));
  assert.equal(
    validatePlannerProfile({ ...profile, fakeListing: pantry }).fakeListing,
    undefined,
  );
});

test('past visit windows explain why no suitable visit remains', () => {
  const result = buildVisitPlan(
    { ...profile, date: '2026-10-19', startTime: '06:00', endTime: '07:00' },
    [pantry],
    origin,
    { now },
  );
  assert.equal(result.status, 'none');
  assert.match(result.message, /already passed/);
});

test('time zones and daylight saving do not depend on the server locale', () => {
  assert.equal(
    localTimestamp('2026-10-20', 540, 'America/Los_Angeles'),
    Date.parse('2026-10-20T16:00:00Z'),
  );
  assert.equal(
    dateInZone(Date.parse('2026-10-20T01:00:00Z'), 'America/Los_Angeles'),
    '2026-10-19',
  );
  assert.equal(localTimestamp('2026-03-08', 150, 'America/New_York'), null);
  assert.equal(localTimestamp('2026-11-01', 90, 'America/New_York'), null);
});

test('online referrals get no invented map visit or travel time', () => {
  const result = plan([
    { ...pantry, id: 'online', coverage: 'US', coordinates: null },
  ]);
  assert.equal(result.options.length, 0);
  assert.equal(result.referrals.length, 1);
  assert.match(result.message, /online directories/);
});

test('a manually entered ride time never implies that transport is arranged', () => {
  const result = plan([pantry], {
    transport: 'ride',
    travelOverrides: { 'test-pantry': 15 },
  });
  assert.equal(result.options[0].fit, 'confirm');
  assert.match(result.options[0].cautions.join(' '), /does not book/);
});

test('administrative office hours are not assumed to be supply distribution hours', () => {
  const result = plan([{ ...pantry, eligibility: 'Main office location' }]);
  assert.equal(result.options[0].fit, 'confirm');
  assert.equal(result.options[0].arrival, null);
  assert.match(result.options[0].cautions.join(' '), /office hours/);
});
