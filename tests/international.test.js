import test from 'node:test';
import assert from 'node:assert/strict';
import {
  locateCity,
  normalizeGiveFood,
  normalizeOSM,
  searchCommunityFacilities,
} from '../server/internationalResources.js';
import { searchResources } from '../server/resourceSearch.js';
import { chatIntent } from '../server/chat.js';
import { getLocalReply, validateRequest } from '../server/assistant.js';

test('country aliases resolve to current country codes and city searches exclude businesses', async () => {
  const seen = [];
  for (const [query, code] of [
    ['London, UK', 'GB'],
    ['Paris, France', 'FR'],
  ]) {
    const place = await locateCity(query, async (url) => {
      seen.push(new URL(url));
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: [2, 48] },
              properties: { name: query, countrycode: code },
            },
          ],
        }),
      };
    });
    assert.equal(place.countryCode, code);
    assert.equal(seen.at(-1).searchParams.get('countrycode'), code);
    assert.ok(seen.at(-1).searchParams.getAll('layer').includes('city'));
  }
});

const place = { lat: 60.39, lng: 5.32, city: 'Bergen', countryCode: 'NO' };

test('worldwide listings need actual assistance tags and do not promise free services', () => {
  const element = {
    id: 451,
    type: 'node',
    lat: 60.39,
    lon: 5.32,
    tags: {
      name: 'Example service',
      amenity: 'social_facility',
      social_facility: 'food_bank',
      website: 'javascript:bad',
    },
  };
  const record = normalizeOSM(element, place);
  assert.equal(record.id, 'osm-node-451');
  assert.equal(record.website, null);
  assert.match(record.eligibility, /fees/);
  assert.equal(
    normalizeOSM(
      { ...element, tags: { name: 'Restaurant', amenity: 'restaurant' } },
      place,
    ),
    null,
  );
  assert.equal(normalizeOSM({ ...element, lat: 200 }, place), null);
});

test('UK donation requests do not become claims about supplies available to collect', () => {
  const record = normalizeGiveFood(
    {
      id: 'example',
      name: 'Food Bank',
      lat_lng: '51.5,-0.1',
      address: 'One Street\nLondon',
      needs: { needs: 'Rice\nSoap', found: '2026-01-01' },
      urls: { html: 'https://www.givefood.org.uk/needs/' },
    },
    { ...place, city: 'London', countryCode: 'GB' },
  );
  assert.equal(record.donationNeeds, 'Rice\nSoap');
  assert.deepEqual(record.categories, ['food']);
  assert.doesNotMatch(record.description, /Rice|Soap/);
});

test('Bergen, Norway never falls back to New Jersey and a failed provider is an error', async () => {
  const fetchImpl = async (url) => {
    if (String(url).includes('photon'))
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              geometry: { coordinates: [5.32, 60.39] },
              properties: { name: 'Bergen', countrycode: 'NO' },
            },
          ],
        }),
      };
    return {
      ok: true,
      json: async () => ({
        elements: [
          {
            id: 451,
            type: 'node',
            lat: 60.39,
            lon: 5.32,
            tags: {
              name: 'Bergen Food Support',
              amenity: 'social_facility',
              social_facility: 'food_bank',
            },
          },
        ],
      }),
    };
  };
  const result = await searchResources(
    { location: 'Bergen, Norway', category: 'all' },
    { fetchImpl },
  );
  assert.equal(result.countryCode, 'NO');
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].country, 'NO');
  assert.ok(result.resources.every((resource) => resource.coverage !== 'US'));
  await assert.rejects(
    () =>
      searchResources(
        { location: 'Melbourne, Australia' },
        { fetchImpl: async () => ({ ok: false }) },
      ),
    /unavailable/,
  );
});

test('chat understands international country names and non-English city names', () => {
  for (const city of ['Paris, France', 'São Paulo, Brazil']) {
    assert.equal(
      chatIntent({
        profile: {},
        messages: [{ role: 'user', content: `Find food near ${city}` }],
      }).location,
      city,
    );
  }
});

test('local AI uses the local server and rejects invented resource references', async () => {
  const input = validateRequest({
    messages: [{ role: 'user', text: 'Find food' }],
  });
  const reply = await getLocalReply(input, {
    model: 'installed-test-model',
    catalogResources: [{ id: 'real', name: 'Real Pantry' }],
    fetchImpl: async (url, options) => {
      assert.equal(url, 'http://127.0.0.1:11434/api/chat');
      const request = JSON.parse(options.body);
      assert.equal(request.stream, false);
      assert.equal(request.format.type, 'object');
      assert.equal(options.headers.Authorization, undefined);
      return {
        ok: true,
        json: async () => ({
          done: true,
          message: {
            content: JSON.stringify({
              answer: 'Check these options.',
              steps: [],
              resourceIds: ['real', 'invented'],
            }),
          },
        }),
      };
    },
  });
  assert.deepEqual(reply.resourceIds, ['real']);
});

test('place-index fallback keeps unknown services out of food results', async () => {
  const records = await searchCommunityFacilities(
    { lat: 35.1, lng: 139.1, city: 'Test city', countryCode: 'JP' },
    async (url) => {
      assert.equal(
        new URL(url).searchParams.get('include'),
        'osm.amenity.social_facility',
      );
      return {
        ok: true,
        json: async () => ({
          features: [
            {
              properties: {
                osm_type: 'N',
                osm_id: 987,
                osm_key: 'amenity',
                osm_value: 'social_facility',
                name: 'Community Centre',
              },
              geometry: { coordinates: [139.1, 35.1] },
            },
          ],
        }),
      };
    },
  );
  assert.equal(records.length, 1);
  assert.deepEqual(records[0].categories, ['programs']);
  assert.match(records[0].description, /not been confirmed/);
  assert.equal(records[0].country, 'JP');
});
