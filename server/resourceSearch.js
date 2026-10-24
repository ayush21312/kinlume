import {
  organizationResults,
  getOrganizationResource,
} from "./communityDirectory.js";
import { usDirectoryLocation } from "./usLocations.js";
import { locateCity, searchInternational } from "./internationalResources.js";
import { resources as localResources } from "../src/data/resources.js";
import {
  normalizeFeedResource,
  mergeResources,
  distanceMiles,
} from "../src/utils/resourceData.js";

const cache = new Map();
const catalog = new Map(
  localResources.map((resource) => [resource.id, resource]),
);
const modes = new Set(["free", "wic", "health", "school", "summer"]);

export function rememberResources(resources) {
  for (const resource of resources) catalog.set(resource.id, resource);
  // This is a development cache, not the permanent user database.
  while (catalog.size > 2500) {
    const id = [...catalog.keys()].find(
      (id) => !localResources.some((resource) => resource.id === id),
    );
    if (!id) break;
    catalog.delete(id);
  }
}

export function getKnownResource(id) {
  return catalog.get(id);
}

async function feedSearch(location, mode, fetchImpl) {
  const key = `${location.toLowerCase()}|${mode}`;
  const cached = cache.get(key);
  if (cached && cached.expires > Date.now()) return cached.promise;
  const promise = (async () => {
    const url = new URL("https://feedam.org/api/resources/search");
    url.search = new URLSearchParams({
      zip: location,
      mode,
      radius: "15",
      limit: mode === "free" ? "60" : "30",
    });
    const response = await fetchImpl(url, {
      signal: AbortSignal.timeout(12000),
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("The directory could not be reached.");
    const data = await response.json();
    if (
      data.success !== true ||
      !Array.isArray(data.resources) ||
      !data.location
    )
      throw new Error(
        "Enter a city and country, or a postal code with its country.",
      );
    return data;
  })();
  cache.set(key, { promise, expires: Date.now() + 5 * 60000 });
  if (cache.size > 150) cache.delete(cache.keys().next().value);
  try {
    return await promise;
  } catch (error) {
    cache.delete(key);
    throw error;
  }
}

async function searchDirectory(
  { location = "Hackensack, NJ", category = "all", program = "all" },
  { fetchImpl = fetch } = {},
) {
  location = location.trim();
  if (
    !location ||
    location.length > 100 ||
    !/^[\p{L}\p{N}\s,.'-]+$/u.test(location)
  )
    throw Object.assign(
      new Error("Enter a city and country, or a postal code with its country."),
      { status: 400 },
    );
  // Explicit US state/ZIP searches keep the existing national directory path.
  // Everything else resolves a country first, preventing Bergen, Norway from
  // accidentally receiving Bergen County, New Jersey's saved listings.
  const usState =
    /,\s*(?:AL|AK|AZ|AR|CA|CO|CT|DE|DC|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)$/i;
  const explicitUS = usState.test(location) || /^\d{5}$/.test(location);
  const requestedLocation = location;
  let directoryLocation = location;
  let place = null;
  if (!explicitUS) {
    place = await locateCity(location, fetchImpl);
    if (place.countryCode !== "US") {
      const international = await searchInternational(place, fetchImpl);
      let records = mergeResources([], international.resources);
      if (category !== "all")
        records = records.filter((resource) =>
          resource.categories.includes(category),
        );
      if (category === "programs" && program !== "all")
        records = records.filter(
          (resource) => resource.programType === program,
        );
      rememberResources(records);
      return {
        ...international,
        resources: records,
        location,
        resolvedLocation: place.label,
        center: place,
        countryCode: place.countryCode,
        fetchedAt: new Date().toISOString(),
      };
    }
    directoryLocation = usDirectoryLocation(place);
  }
  let requestedModes = ["free"];
  if (category === "programs")
    requestedModes = modes.has(program)
      ? [program]
      : program === "all"
        ? ["wic", "health", "school", "summer"]
        : [];
  if (category === "all") requestedModes = ["free", "wic", "health"];
  // Even local-only categories need a location lookup, so Bergen results do not leak into another city.
  const lookups = requestedModes.length ? requestedModes : ["free"];
  const responses = await Promise.allSettled(
    lookups.map((mode) =>
      directoryLocation
        ? feedSearch(directoryLocation, mode, fetchImpl)
        : Promise.reject(new Error("The US directory needs a state or ZIP.")),
    ),
  );
  const successful = responses
    .filter((result) => result.status === "fulfilled")
    .map((result) => result.value);
  let center = successful[0]?.location || place;
  let fallback = null;
  if (!successful.length) {
    // Finding an area and loading its services are separate operations. A US
    // directory outage should not discard an already resolved map location.
    if (!place) {
      try {
        place = await locateCity(requestedLocation, fetchImpl);
      } catch {
        /* Local, sourced Bergen records can still be used below. */
      }
    }
    if (place?.countryCode === "US") {
      center = place;
      try {
        fallback = await searchInternational(place, fetchImpl);
      } catch {
        /* Keep known local records and the map center if other providers fail. */
      }
    }
  }
  const warning = responses.some((result) => result.status === "rejected")
    ? "Some live listings could not be loaded."
    : "";
  const fallbackRegion =
    /^(?:(?:hackensack|bergen county|rutherford|englewood),\s*(?:nj|new jersey)|076\d\d|070(?:10|20|70))$/i.test(
      location,
    );
  if (!center && !fallbackRegion)
    throw new Error(
      "Location search is temporarily unavailable. Enter a city and state or country, then retry.",
    );
  const local = localResources.filter((resource) => {
    if (resource.coverage === "US") return true;
    if (resource.coverage === "NJ")
      return (
        /(?:,\s*NJ|New Jersey)$/i.test(location) ||
        place?.state === "New Jersey" ||
        center?.state === "NJ"
      );
    if (center && resource.coordinates)
      return distanceMiles(center, resource.coordinates) <= 25;
    return fallbackRegion;
  });
  const remote = requestedModes.length
    ? successful
        .flatMap((data) => data.resources)
        .map(normalizeFeedResource)
        .filter(Boolean)
    : [];
  let merged = mergeResources(local, [
    ...remote,
    ...(fallback?.resources || []),
  ]);
  if (category !== "all")
    merged = merged.filter((resource) =>
      resource.categories.includes(category),
    );
  if (category === "programs" && program !== "all")
    merged = merged.filter((resource) => resource.programType === program);
  rememberResources(merged);
  return {
    resources: merged,
    location,
    center: center || null,
    countryCode: "US",
    resolvedLocation: place?.label || location,
    retryable: responses.some((result) => result.status === "rejected"),
    unavailable: !successful.length && !merged.length,
    warning: !successful.length
      ? fallback
        ? "US directory unavailable. Showing other sources with limited service details."
        : "Live directory unavailable. Showing any available sourced listings."
      : !center
        ? "Live search unavailable. Showing saved Bergen County listings."
        : warning,
    provider: fallback
      ? `${fallback.provider} + Kinlume`
      : requestedModes.length
        ? "Feed America + Kinlume"
        : "Kinlume source directory",
    fetchedAt: new Date().toISOString(),
  };
}

export async function searchResources(options, services = {}) {
  let result;
  try {
    result = await searchDirectory(options, services);
  } catch (error) {
    const owned = organizationResults(options);
    if (!owned.length) throw error;
    result = {
      resources: [],
      center:
        owned.find((resource) => resource.coordinates)?.coordinates || null,
      location: options.location,
      resolvedLocation: options.location,
      countryCode: null,
      warning:
        "Other directory sources are unavailable. Showing organization listings.",
      retryable: true,
    };
  }
  const records = organizationResults(options, result);
  const resources = [
    ...records,
    ...result.resources.filter(
      (resource) => !records.some((record) => record.id === resource.id),
    ),
  ];
  rememberResources(resources);
  return { ...result, resources };
}

export async function findResource(id) {
  if (id.startsWith("org-")) return getOrganizationResource(id);
  if (catalog.has(id)) return catalog.get(id);
  if (!/^feedam-\d{1,10}$/.test(id)) return null;
  const response = await fetch(
    `https://feedam.org/api/resources/${id.slice(7)}`,
    { signal: AbortSignal.timeout(10000) },
  );
  if (!response.ok) return null;
  const data = await response.json();
  const resource = normalizeFeedResource(data.resource || data);
  if (resource) rememberResources([resource]);
  return resource;
}
