import test from 'node:test';
import assert from 'node:assert/strict';
import { searchResources } from '../server/resourceSearch.js';
import { usDirectoryLocation } from '../server/usLocations.js';

function geocoded(city, state, lat = 39.1, lng = -94.6) {
  return {
    features: [
      {
        geometry: { coordinates: [lng, lat] },
        properties: {
          name: city,
          state,
          countrycode: 'US',
          country: 'United States',
        },
      },
    ],
  };
}
const ok = (data) => ({ ok: true, json: async () => data });

test('US directory queries use state codes or a ZIP, never the map display label', () => {
  assert.equal(
    usDirectoryLocation({ city: 'Hackensack', state: 'New Jersey' }),
    'Hackensack, NJ',
  );
  assert.equal(
    usDirectoryLocation({ city: 'Los Angeles', state: 'California' }),
    'Los Angeles, CA',
  );
  assert.equal(
    usDirectoryLocation({ city: 'New York', state: 'NY' }),
    'New York, NY',
  );
  assert.equal(usDirectoryLocation({ postalCode: '07601' }), '07601');
  assert.equal(
    usDirectoryLocation({ label: 'Somewhere, United States' }),
    null,
  );
});

test('bare cities and full state names are normalized before calling the US provider', async () => {
  for (const [location, city, state, code] of [
    ['Hackensack', 'Hackensack', 'New Jersey', 'NJ'],
    ['New York', 'New York', 'New York', 'NY'],
    ['Los Angeles, California', 'Los Angeles', 'California', 'CA'],
  ]) {
    const queries = [];
    const result = await searchResources(
      { location, category: 'food' },
      {
        fetchImpl: async (input) => {
          const url = new URL(input);
          if (url.hostname.includes('photon')) return ok(geocoded(city, state));
          queries.push(url.searchParams.get('zip'));
          return ok({
            success: true,
            location: { lat: 39.1, lng: -94.6 },
            resources: [],
          });
        },
      },
    );
    assert.deepEqual(queries, [`${city}, ${code}`]);
    assert.equal(result.countryCode, 'US');
    assert.ok(result.resolvedLocation.includes(state));
    assert.equal(result.warning, '');
  }
});

test('a US provider outage preserves the resolved map area and tries other real sources', async () => {
  const result = await searchResources(
    { location: 'Kansas City, KS', category: 'food' },
    {
      fetchImpl: async (input) => {
        const url = new URL(input);
        if (url.hostname.includes('feedam')) return { ok: false };
        if (url.hostname.includes('photon'))
          return ok(geocoded('Kansas City', 'Kansas'));
        return ok({
          elements: [
            {
              type: 'node',
              id: 981231,
              lat: 39.1,
              lon: -94.6,
              tags: {
                name: 'Mapped Food Pantry',
                amenity: 'social_facility',
                social_facility: 'food_bank',
              },
            },
          ],
        });
      },
    },
  );
  assert.equal(result.center.lat, 39.1);
  assert.equal(result.resources.length, 1);
  assert.equal(result.resources[0].id, 'osm-node-981231');
  assert.equal(result.retryable, true);
  assert.match(result.warning, /US directory unavailable/);
});

test('when every listing provider fails, a found city is not reported as an invalid location', async () => {
  const result = await searchResources(
    { location: 'Wichita, KS', category: 'food' },
    {
      fetchImpl: async (input) => {
        const url = new URL(input);
        if (url.hostname.includes('photon') && url.searchParams.has('q'))
          return ok(geocoded('Wichita', 'Kansas', 37.68, -97.34));
        return { ok: false };
      },
    },
  );
  assert.equal(result.center.lat, 37.68);
  assert.deepEqual(result.resources, []);
  assert.equal(result.unavailable, true);
  assert.equal(result.retryable, true);
  assert.match(result.resolvedLocation, /Wichita/);
});

test('invalid location text is an input error rather than a retryable directory outage', async () => {
  await assert.rejects(
    () =>
      searchResources(
        { location: '??' },
        {
          fetchImpl: () => {
            throw new Error('Invalid input should never reach a provider.');
          },
        },
      ),
    (error) => error.status === 400,
  );
});
