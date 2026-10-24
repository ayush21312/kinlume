import { safeWebsite, distanceMiles } from '../src/utils/resourceData.js';

// These public services suit a small demonstration. Cache searches and switch
// to hosted/self-hosted services before supporting a large audience.
const cache = new Map();
let lastRequest = Promise.resolve();
let mapRetryAt = 0;

async function cached(key, task, minutes = 60) {
  const found = cache.get(key);
  if (found && found.expires > Date.now()) return found.promise;
  const promise = task();
  cache.set(key, { promise, expires: Date.now() + minutes * 60000 });
  if (cache.size > 200) cache.delete(cache.keys().next().value);
  try {
    return await promise;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

async function readJSON(url, fetchImpl, options = {}) {
  const response = await fetchImpl(url, {
    ...options,
    headers: {
      Accept: 'application/json',
      'User-Agent': 'HelpingHand-StudentProject/1.0',
      ...options.headers,
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!response.ok)
    throw new Error(
      'The international directory is unavailable. Please retry.',
    );
  return response.json();
}

// Recognize country names without maintaining a giant hand-written list.
const countryNames = new Map([
  ['uk', 'GB'],
  ['usa', 'US'],
  ['united states of america', 'US'],
  ['south korea', 'KR'],
]);
const displayNames = new Intl.DisplayNames(['en'], { type: 'region' });
for (let first = 65; first <= 90; first++) {
  for (let second = 65; second <= 90; second++) {
    const code = String.fromCharCode(first, second);
    const name = displayNames.of(code);
    if (
      name &&
      name !== code &&
      new Intl.Locale(`und-${code}`).region === code
    ) {
      countryNames.set(name.toLowerCase(), code);
      countryNames.set(code.toLowerCase(), code);
    }
  }
}

export async function locateCity(location, fetchImpl = fetch) {
  return cached(`city:${location.toLowerCase()}`, async () => {
    const parts = location.split(',').map((part) => part.trim());
    const country =
      parts.length > 1 ? countryNames.get(parts.at(-1).toLowerCase()) : null;
    const query = country ? parts.slice(0, -1).join(', ') : location;
    const url = new URL(
      process.env.PHOTON_URL || 'https://photon.komoot.io/api/',
    );
    url.search = new URLSearchParams({ q: query, limit: '1', lang: 'en' });
    if (country) url.searchParams.set('countrycode', country);
    // City searches must not land on a business whose name happens to match.
    if (!/\d/u.test(query)) {
      url.searchParams.append('layer', 'city');
      url.searchParams.append('layer', 'district');
      url.searchParams.append('layer', 'county');
    }
    // Serialize location requests, with no keystroke autocomplete.
    const job = lastRequest.then(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1100));
      return readJSON(url, fetchImpl);
    });
    lastRequest = job.catch(() => {});
    const data = await job;
    const place = data.features?.[0];
    const [lng, lat] = place?.geometry?.coordinates || [];
    const details = place?.properties;
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !details?.countrycode)
      throw Object.assign(
        new Error(
          'Location not found. Enter a city and country, such as Paris, France.',
        ),
        { status: 400 },
      );
    return {
      lat,
      lng,
      countryCode: details.countrycode.toUpperCase(),
      city: details.name || details.city || query,
      state: details.state || '',
      postalCode: details.postcode || '',
      label: [
        details.name || details.city || query,
        details.state,
        details.country,
      ]
        .filter(Boolean)
        .join(', '),
    };
  });
}

function baseResource({
  id,
  name,
  category,
  place,
  coordinates,
  sourceUrl,
  sourceName,
}) {
  return {
    id,
    providerId: id,
    name,
    organization: name,
    category,
    categories: [category],
    city: place.city,
    country: place.countryCode,
    state: '',
    address: 'Check the source for the entrance and address.',
    coordinates,
    serviceLabel: category === 'food' ? 'Food assistance' : 'Community support',
    description:
      'Community service listing. Confirm services, availability, and any costs with the organization.',
    hours: 'Contact the organization for hours.',
    eligibility:
      'Ask about eligibility, referrals, and any fees before visiting.',
    appointment: 'Confirm appointment or walk-in arrangements.',
    accessibility: 'Ask the organization about access needs.',
    phone: null,
    email: null,
    website: null,
    sourceUrl,
    sourceName,
    sourceCheckedAt: new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
    }).format(new Date()),
    notes: [],
    image: {
      src: `/images/${category}.jpg`,
      kind: 'stock',
      alt: 'Illustrative resource image',
      credit: 'Unsplash; see ASSETS.md',
    },
  };
}

export function normalizeGiveFood(row, place) {
  if (!row?.id || !row.name || row.closed) return null;
  const [lat, lng] = String(row.lat_lng).split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  const resource = baseResource({
    id: `givefood-${row.id}`,
    name: row.name,
    category: 'food',
    place,
    coordinates: { lat, lng },
    sourceUrl: safeWebsite(row.urls?.html),
    sourceName: 'Give Food',
  });
  return {
    ...resource,
    organization: row.foodbank?.name || row.name,
    city: row.politics?.district || place.city,
    address: String(row.address || resource.address).replace(/\r?\n/g, ', '),
    phone: row.phone || null,
    email: row.email || null,
    website: safeWebsite(row.urls?.homepage),
    donationUrl: safeWebsite(row.foodbank?.urls?.html || row.urls?.html),
    donationNeeds:
      typeof row.needs?.needs === 'string' &&
      !/^(unknown|nothing|facebook)$/i.test(row.needs.needs)
        ? row.needs.needs.slice(0, 3000)
        : null,
    donationNeedsUpdatedAt: row.needs?.found || null,
  };
}

export function normalizeOSM(element, place) {
  const tags = element?.tags || {};
  if (
    !['node', 'way', 'relation'].includes(element?.type) ||
    !Number.isInteger(element.id) ||
    !tags.name
  )
    return null;
  const kind = tags.social_facility;
  const food =
    ['food_bank', 'soup_kitchen'].includes(kind) ||
    tags.amenity === 'food_sharing';
  const clothing = kind === 'clothing_bank';
  const program =
    ['outreach', 'day_care', 'shelter'].includes(kind) &&
    tags.amenity === 'social_facility';
  // Do not turn arbitrary shops, restaurants, churches or clinics into free aid.
  if (!food && !clothing && !program) return null;
  const coordinates = element.center || element;
  const lat = coordinates.lat,
    lng = coordinates.lon;
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return null;
  const category = food ? 'food' : clothing ? 'clothing' : 'programs';
  const resource = baseResource({
    id: `osm-${element.type}-${element.id}`,
    name: tags.name,
    category,
    place,
    coordinates: { lat, lng },
    sourceUrl: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    sourceName: 'OpenStreetMap contributors (ODbL)',
  });
  return {
    ...resource,
    city: tags['addr:city'] || place.city,
    address:
      [
        tags['addr:housenumber'],
        tags['addr:street'],
        tags['addr:city'],
        tags['addr:postcode'],
      ]
        .filter(Boolean)
        .join(' ') || resource.address,
    streetAddress: [tags['addr:housenumber'], tags['addr:street']]
      .filter(Boolean)
      .join(' '),
    serviceLabel: (kind || 'food_sharing').replaceAll('_', ' '),
    programType: program ? 'community' : null,
    phone: tags['contact:phone'] || tags.phone || null,
    website: safeWebsite(tags['contact:website'] || tags.website),
    hours: tags.opening_hours || resource.hours,
    accessibility: tags.wheelchair
      ? `Wheelchair access: ${tags.wheelchair}. Confirm details.`
      : resource.accessibility,
  };
}

async function searchOSM(place, fetchImpl) {
  if (Date.now() < mapRetryAt)
    throw new Error('Detailed map service is temporarily unavailable.');
  return cached(
    `osm:${place.lat.toFixed(3)},${place.lng.toFixed(3)}`,
    async () => {
      const around = `around:20000,${place.lat},${place.lng}`;
      const query = `[out:json][timeout:8];(nwr(${around})["amenity"="social_facility"]["social_facility"~"^(food_bank|soup_kitchen|clothing_bank|outreach|day_care|shelter)$"];nwr(${around})["amenity"="food_sharing"];);out center tags 120;`;
      const endpoint = new URL(
        process.env.OVERPASS_URL ||
          'https://overpass.private.coffee/api/interpreter',
      );
      endpoint.searchParams.set('data', query);
      const data = await readJSON(endpoint, fetchImpl);
      if (!Array.isArray(data.elements) || data.remark)
        throw new Error('Map directory search incomplete. Please retry.');
      return data.elements
        .map((element) => normalizeOSM(element, place))
        .filter(Boolean);
    },
    30,
  );
}

// If detailed map queries are down, the place index can still locate named
// community facilities. Their exact services are unknown, so they are NOT
// represented as food pantries, benefit offices or free supply providers.
export async function searchCommunityFacilities(place, fetchImpl = fetch) {
  return cached(
    `facilities:${place.lat.toFixed(3)},${place.lng.toFixed(3)}`,
    async () => {
      const latitudeRange = 20 / 111;
      const longitudeRange = Math.min(
        180,
        20 / (111 * Math.max(0.05, Math.cos((place.lat * Math.PI) / 180))),
      );
      const url = new URL(
        process.env.PHOTON_URL || 'https://photon.komoot.io/api/',
      );
      url.search = new URLSearchParams({
        include: 'osm.amenity.social_facility',
        lat: String(place.lat),
        lon: String(place.lng),
        location_bias_scale: '0',
        limit: '40',
        bbox: [
          Math.max(-180, place.lng - longitudeRange),
          Math.max(-90, place.lat - latitudeRange),
          Math.min(180, place.lng + longitudeRange),
          Math.min(90, place.lat + latitudeRange),
        ].join(','),
      });
      const data = await readJSON(url, fetchImpl);
      if (!Array.isArray(data.features))
        throw new Error('Community facility search unavailable.');
      return data.features
        .map((feature) => {
          const details = feature.properties;
          const type = { N: 'node', W: 'way', R: 'relation' }[
            details?.osm_type
          ];
          const [lng, lat] = feature.geometry?.coordinates || [];
          if (
            !type ||
            !Number.isInteger(details.osm_id) ||
            !details.name ||
            details.osm_key !== 'amenity' ||
            details.osm_value !== 'social_facility' ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng)
          )
            return null;
          const resource = baseResource({
            id: `osm-${type}-${details.osm_id}`,
            name: details.name,
            category: 'programs',
            place,
            coordinates: { lat, lng },
            sourceName: 'OpenStreetMap contributors via Photon (ODbL)',
            sourceUrl: `https://www.openstreetmap.org/${type}/${details.osm_id}`,
          });
          return {
            ...resource,
            city: details.city || place.city,
            address:
              [
                details.housenumber,
                details.street,
                details.city,
                details.postcode,
                details.country,
              ]
                .filter(Boolean)
                .join(', ') || resource.address,
            programType: 'community',
            serviceLabel: 'Community facility',
            description:
              'Mapped community facility. Assistance type, eligibility, and fees have not been confirmed.',
            notes: [
              'This facility is not a verified food pantry or benefits program. Check the source and organization before visiting.',
            ],
          };
        })
        .filter(Boolean)
        .filter(
          (resource) => distanceMiles(place, resource.coordinates) <= 12.5,
        );
    },
    30,
  );
}

export async function searchInternational(place, fetchImpl = fetch) {
  const jobs = [];
  if (place.countryCode === 'GB') {
    jobs.push(
      cached(
        `givefood:${place.lat.toFixed(3)},${place.lng.toFixed(3)}`,
        async () => {
          const url = new URL(
            'https://www.givefood.org.uk/api/2/locations/search/',
          );
          url.searchParams.set('lat_lng', `${place.lat},${place.lng}`);
          const rows = await readJSON(url, fetchImpl);
          if (!Array.isArray(rows))
            throw new Error('Food directory unavailable.');
          return rows
            .map((row) => normalizeGiveFood(row, place))
            .filter(Boolean);
        },
        30,
      ),
    );
  }
  let usedFallback = false;
  jobs.push(
    searchOSM(place, fetchImpl).catch(async () => {
      usedFallback = true;
      // Avoid hammering an unavailable shared server on each category change.
      mapRetryAt = Date.now() + 60000;
      return searchCommunityFacilities(place, fetchImpl);
    }),
  );
  const results = await Promise.allSettled(jobs);
  if (results.every((result) => result.status === 'rejected'))
    throw new Error('International directories are unavailable. Please retry.');
  const resources = results
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    .filter((resource) => distanceMiles(place, resource.coordinates) <= 12.5)
    .sort(
      (a, b) =>
        distanceMiles(place, a.coordinates) -
        distanceMiles(place, b.coordinates),
    );
  return {
    resources,
    warning: usedFallback
      ? 'Detailed map service data is unavailable. Community facilities have unconfirmed services. Coverage is incomplete.'
      : results.some((result) => result.status === 'rejected')
        ? 'Some international listings could not be loaded. Coverage is incomplete.'
        : 'Directory coverage varies. Confirm services with the organization.',
    retryable:
      usedFallback || results.some((result) => result.status === 'rejected'),
    provider:
      place.countryCode === 'GB'
        ? 'Give Food + OpenStreetMap'
        : 'OpenStreetMap',
  };
}
