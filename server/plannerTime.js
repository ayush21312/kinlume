// Calendar helpers use explicit IANA time zones instead of the server's clock.
export function dateInZone(timestamp, timeZone) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(timestamp));
}

export function addDays(date, amount) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + amount);
  return value.toISOString().slice(0, 10);
}

export function minuteOfDay(value) {
  if (!/^\d{2}:\d{2}$/.test(value || '')) return null;
  const [hour, minute] = value.split(':').map(Number);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function localParts(timestamp, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(timestamp));
  const values = Object.fromEntries(
    parts.map(({ type, value }) => [type, value]),
  );
  return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
}

export function localTimestamp(date, minute, timeZone) {
  if (minute === 1440) return localTimestamp(addDays(date, 1), 0, timeZone);
  const target = `${date}T${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`;
  const wallClock = Date.parse(`${target}:00Z`);
  let candidate = wallClock;
  for (let attempt = 0; attempt < 4; attempt++) {
    const displayed = Date.parse(`${localParts(candidate, timeZone)}:00Z`);
    const difference = wallClock - displayed;
    if (!difference) break;
    candidate += difference;
  }
  if (localParts(candidate, timeZone) !== target) return null; // Skipped daylight-saving time.
  // A repeated clock time has two possible meanings. Ask for a different time.
  for (const shift of [-120, -60, -30, 30, 60, 120]) {
    if (localParts(candidate + shift * 60000, timeZone) === target) return null;
  }
  return candidate;
}

export function displayTime(timestamp, timeZone) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}
