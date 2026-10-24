// All providers become the same simple object before they reach a React component.
export function safeWebsite(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function parseList(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    return Array.isArray(parsed)
      ? parsed.filter((entry) => typeof entry === 'string')
      : [];
  } catch {
    return [];
  }
}

function hoursText(value) {
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
      return 'Contact the organization for hours.';
    return (
      Object.entries(parsed)
        .filter(([, hours]) => typeof hours === 'string')
        .map(([day, hours]) => `${day}: ${hours}`)
        .join('\n') || 'Contact the organization for hours.'
    );
  } catch {
    return 'Contact the organization for hours.';
  }
}

export function normalizeFeedResource(row) {
  if (
    !row ||
    !Number.isInteger(row.id) ||
    !row.name ||
    !row.address ||
    row.is_active === 0
  )
    return null;
  const type = row.resource_type || 'food_pantry';
  if (['snap_retailer', 'rmp_restaurant'].includes(type)) return null; // A store accepting SNAP is not a free pantry.
  const programTypes = {
    wic_office: 'wic',
    health_center: 'health',
    fqhc: 'health',
    school_meal: 'school',
    summer_meal: 'summer',
    head_start: 'school',
  };
  const programType = programTypes[type];
  const category = programType
    ? 'programs'
    : type === 'diaper_bank'
      ? 'hygiene'
      : 'food';
  const labels = {
    wic: 'WIC program',
    health: 'Community health program',
    school: 'School meal program',
    summer: 'Summer meal program',
  };
  const categories =
    programType && programType !== 'health' ? ['programs', 'food'] : [category];
  const lat = Number(row.lat),
    lng = Number(row.lng);
  const coordinates =
    row.lat != null &&
    row.lng != null &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    (lat !== 0 || lng !== 0)
      ? { lat, lng }
      : null;
  const fetchedAt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York',
  }).format(new Date());
  return {
    id: `feedam-${row.id}`,
    providerId: row.id,
    name: String(row.name).slice(0, 180),
    organization: String(row.organization || row.name),
    city: String(row.city || ''),
    state: String(row.state || ''),
    zip: String(row.zip || ''),
    address: [row.address, row.city, row.state, row.zip]
      .filter(Boolean)
      .join(', '),
    streetAddress: String(row.address),
    category,
    categories,
    programType: programType || null,
    serviceLabel: labels[programType] || type.replaceAll('_', ' '),
    description:
      programType === 'health'
        ? 'Community health services. Ask about fees, insurance, and financial assistance.'
        : programType === 'school' || programType === 'summer'
          ? 'Meal program listing. Ask about enrollment, eligibility, season dates, and availability.'
          : 'Food assistance listing from Feed America. Contact the organization for current services.',
    hours: hoursText(row.hours_json),
    eligibility:
      row.requirements_text ||
      'Ask the organization about eligibility and required documents.',
    appointment:
      'Confirm appointment or walk-in arrangements with the organization.',
    accessibility:
      parseList(row.accessibility_features).join(', ') ||
      'Ask the organization about access needs.',
    phone: typeof row.phone === 'string' ? row.phone : null,
    email: null,
    website: safeWebsite(row.website),
    coordinates,
    sourceUrl: `https://feedam.org/resource/${row.id}`,
    sourceName: 'Feed America',
    upstreamSource: row.data_source || null,
    sourceCheckedAt: fetchedAt,
    providerVerifiedAt: row.last_verified_date || null,
    services: parseList(row.services_offered_json),
    notes: [],
    image: {
      src: `/images/${category}.jpg`,
      kind: 'stock',
      alt: 'Illustrative resource image',
      credit: 'Unsplash; see ASSETS.md',
    },
  };
}

export function distanceMiles(a, b) {
  const lat1 = a.lat,
    lat2 = b.lat,
    lng1 = a.lng ?? a.lon,
    lng2 = b.lng ?? b.lon;
  const radians = (degrees) => (degrees * Math.PI) / 180;
  const value =
    Math.sin(radians(lat2 - lat1) / 2) ** 2 +
    Math.cos(radians(lat1)) *
      Math.cos(radians(lat2)) *
      Math.sin(radians(lng2 - lng1) / 2) ** 2;
  return (
    3958.8 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(Math.max(0, 1 - value)))
  );
}

function addressKey(resource) {
  return (resource.streetAddress || resource.address.split(',')[0])
    .toLowerCase()
    .replace(/\bfirst\b/g, '1st')
    .replace(/\bstreet\b/g, 'st')
    .replace(/\bavenue\b/g, 'ave')
    .replace(/\broad\b/g, 'rd')
    .replace(/\bnorth\b/g, 'n')
    .replace(/[^a-z0-9]/g, '');
}

function samePlace(a, b) {
  if (a.id === b.id) return true;
  if (
    addressKey(a) !== addressKey(b) ||
    a.city.toLowerCase() !== b.city.toLowerCase() ||
    a.category !== b.category ||
    (a.programType !== b.programType && a.programType && b.programType)
  )
    return false;
  const words = (name) =>
    new Set(
      name
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length > 2),
    );
  const aw = words(a.name),
    bw = words(b.name);
  const overlap = [...aw].filter((word) => bw.has(word)).length;
  return overlap / Math.min(aw.size, bw.size) >= 0.5;
}

export function mergeResources(preferred, incoming) {
  const merged = preferred.map((resource) => ({ ...resource }));
  for (const resource of incoming) {
    const existing = merged.find((item) => samePlace(item, resource));
    if (existing) {
      existing.categories = [
        ...new Set([...existing.categories, ...resource.categories]),
      ];
      existing.providerIds = [
        ...new Set([
          ...(existing.providerIds || []),
          ...(resource.providerId ? [resource.providerId] : []),
        ]),
      ];
    } else merged.push(resource);
  }
  return merged;
}
