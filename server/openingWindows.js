import { addDays } from './plannerTime.js';

const dayNumbers = {
  su: 0,
  sun: 0,
  sunday: 0,
  mo: 1,
  mon: 1,
  monday: 1,
  tu: 2,
  tue: 2,
  tues: 2,
  tuesday: 2,
  we: 3,
  wed: 3,
  wednesday: 3,
  th: 4,
  thu: 4,
  thur: 4,
  thurs: 4,
  thursday: 4,
  fr: 5,
  fri: 5,
  friday: 5,
  sa: 6,
  sat: 6,
  saturday: 6,
};

function daySet(value) {
  const days = new Set();
  for (const part of value.toLowerCase().replace(/\./g, '').split(',')) {
    const bounds = part.trim().split(/\s*-\s*/);
    const start = dayNumbers[bounds[0]?.trim()],
      end = bounds.length === 1 ? start : dayNumbers[bounds[1]?.trim()];
    if (start == null || end == null || bounds.length > 2) return null;
    let day = start;
    for (let index = 0; index < 7; index++) {
      days.add(day);
      if (day === end) break;
      day = (day + 1) % 7;
    }
  }
  return days;
}

function clock(value) {
  const match = value.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) return null;
  let hour = Number(match[1]);
  const minute = Number(match[2] || 0),
    meridian = match[3]?.toLowerCase();
  if (minute > 59 || hour > 24 || (hour === 24 && minute !== 0)) return null;
  if (meridian) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (meridian === 'pm' ? 12 : 0);
  } else if (!match[2]) return null; // "9 - 5" is ambiguous.
  return hour * 60 + minute;
}

// Intentionally conservative. Monthly, appointment-only, seasonal and unusual
// schedules stay unknown instead of being guessed into an opening time.
export function openingWindows(hours, date) {
  const text = String(hours || '')
    .trim()
    .replace(/[–—]/g, '-')
    .replace(/\u00a0/g, ' ');
  if (
    !text ||
    /month|first|second|third|fourth|forth|last|appointment|season|lunch|until food|as needed|varies|call|contact|holiday|\bPH\b/i.test(
      text,
    )
  )
    return { known: false, windows: [] };
  if (/^(24\/7|24 hours(?: daily)?|always open)$/i.test(text))
    return { known: true, windows: [[0, 1440]] };
  if (/^(closed|off|not open)$/i.test(text))
    return { known: true, windows: [] };
  const day = new Date(`${date}T12:00:00Z`).getUTCDay();
  const previousDay = new Date(`${addDays(date, -1)}T12:00:00Z`).getUTCDay();
  const windows = [];
  let matched = false;
  for (const line of text.split(/[;\n]+/)) {
    const entry = line
      .trim()
      .match(/^([A-Za-z.,\s-]+?)\s*:?\s*(\d.*|closed|off)$/i);
    if (!entry) return { known: false, windows: [] };
    const dayText = entry[1].trim().replace(/:$/, '').trim();
    const days = /^(daily|every day|everyday)$/i.test(dayText)
      ? new Set([0, 1, 2, 3, 4, 5, 6])
      : daySet(dayText);
    if (!days) return { known: false, windows: [] };
    if (/^(closed|off)$/i.test(entry[2])) {
      if (days.has(day)) matched = true;
      continue;
    }
    for (const range of entry[2].split(',')) {
      const pair = range.trim().split(/\s*-\s*/);
      if (
        pair.length !== 2 ||
        Boolean(/am|pm/i.test(pair[0])) !== Boolean(/am|pm/i.test(pair[1]))
      )
        return { known: false, windows: [] };
      const open = clock(pair[0]),
        close = clock(pair[1]);
      if (open == null || close == null || open >= 1440 || close === open)
        return { known: false, windows: [] };
      if (days.has(day)) {
        matched = true;
        windows.push([open, close < open ? 1440 : close]);
      }
      if (close < open && days.has(previousDay)) {
        matched = true;
        windows.push([0, close]);
      }
    }
  }
  // An omitted day is not proof of closure in a partial directory record.
  return { known: matched, windows: windows.sort((a, b) => a[0] - b[0]) };
}
