import { distanceMiles } from '../src/utils/resourceData.js';

const cache = new Map();
const waiting = [];
let active = 0;

// At most two external photo lookups run together, even when several cards appear.
async function limited(task) {
  if (active >= 2) await new Promise((resolve) => waiting.push(resolve));
  active++;
  try {
    return await task();
  } finally {
    active--;
    waiting.shift()?.();
  }
}

function plainText(value = '') {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[^;]+;/g, ' ')
    .trim();
}

export function chooseCommonsPhoto(pages, resource) {
  const ignored = new Set([
    'church',
    'the',
    'of',
    'for',
    'community',
    'food',
    'pantry',
    'center',
    'inc',
    'new',
    'jersey',
    'corporation',
    'services',
  ]);
  const words = resource.name
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 3 && !ignored.has(word));
  if (!resource.coordinates || !words.length) return null;
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const metadata = info?.extmetadata;
    const title = page.title.toLowerCase();
    if (
      !info ||
      !metadata ||
      !words.slice(0, 3).every((word) => title.includes(word))
    )
      continue;
    if (/census|portrait|newspaper|map\b|logo|diagram|document/.test(title))
      continue;
    if (
      !page.coordinates?.some(
        (point) => distanceMiles(resource.coordinates, point) < 0.4,
      )
    )
      continue;
    const license = plainText(metadata.LicenseShortName?.value);
    if (!/^(CC BY(?:-SA)? [\d.]+|CC0|Public domain)$/i.test(license)) continue;
    const src = info.thumburl || info.url;
    const url = new URL(src);
    if (
      url.protocol !== 'https:' ||
      !/(^|\.)wikimedia\.org$/.test(url.hostname)
    )
      continue;
    return {
      src,
      kind: 'location',
      alt: `${resource.name} location photo`,
      credit:
        plainText(metadata.Artist?.value) || 'Wikimedia Commons contributor',
      sourceUrl: info.descriptionurl,
      license,
      licenseUrl: metadata.LicenseUrl?.value || null,
      caption: 'Wikimedia Commons photo matched by name and location.',
    };
  }
  return null;
}

export async function lookupPhoto(resource, { fetchImpl = fetch } = {}) {
  if (resource.image?.kind && resource.image.kind !== 'stock')
    return resource.image;
  const saved = cache.get(resource.id);
  if (saved && saved.expires > Date.now()) return saved.promise;
  const promise = limited(async () => {
    if (!resource.coordinates) return null;
    const stop =
      /^(church|the|of|for|community|food|pantry|center|inc|new|jersey|corporation|services)$/i;
    const words = resource.name
      .replace(/[^\p{L}\p{N} ]/gu, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 3 && !stop.test(word))
      .slice(0, 3);
    const city = resource.city.split(/\s+/).find((word) => word.length > 3);
    if (!words.length || !city) return null;
    const url = new URL('https://commons.wikimedia.org/w/api.php');
    url.search = new URLSearchParams({
      action: 'query',
      format: 'json',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '5',
      gsrsearch:
        [...words, city].map((word) => `intitle:${word}`).join(' ') +
        ' filetype:bitmap',
      prop: 'imageinfo|coordinates',
      iiprop: 'url|extmetadata',
      iiurlwidth: '640',
      colimit: 'max',
    });
    try {
      const response = await fetchImpl(url, {
        headers: {
          'User-Agent':
            'HelpingHandStudentPrototype/0.2 (local educational app; Wikimedia Commons photo lookup)',
        },
        signal: AbortSignal.timeout(6500),
      });
      if (!response.ok) return null;
      const data = await response.json();
      return chooseCommonsPhoto(
        Object.values(data.query?.pages || {}),
        resource,
      );
    } catch {
      return null;
    }
  });
  cache.set(resource.id, { expires: Date.now() + 24 * 3600000, promise });
  if (cache.size > 400) cache.delete(cache.keys().next().value);
  return promise;
}
