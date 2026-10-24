import test from 'node:test';
import assert from 'node:assert/strict';
import { resources } from '../src/data/resources.js';
import { filterResources } from '../src/utils/filterResources.js';
import { hasCoordinates, directionsUrl } from '../src/utils/resourceLinks.js';

test('blank query returns every listing without modifying the dataset', () => {
  const original = structuredClone(resources);
  assert.equal(filterResources(resources, '', 'all').length, resources.length);
  assert.deepEqual(resources, original);
});

test('need and city combine, ignoring case and surrounding whitespace', () => {
  const matches = filterResources(resources, ' FOOD HACKENSACK ', 'all');
  assert.ok(matches.length > 0);
  assert.ok(
    matches.every(
      (resource) =>
        resource.city === 'Hackensack' && resource.categories.includes('food'),
    ),
  );
});

test('multi-service locations match both categories', () => {
  assert.ok(filterResources(resources, 'Epiphany', 'food').length === 1);
  assert.ok(filterResources(resources, 'Epiphany', 'hygiene').length === 1);
  assert.equal(filterResources(resources, 'Epiphany', 'clothing').length, 0);
});

test('ZIP search and programs category find benefit offices', () => {
  assert.ok(
    filterResources(resources, '07662', 'programs').some(
      (resource) => resource.id === 'bergen-snap',
    ),
  );
  assert.equal(filterResources(resources, 'No such city', 'all').length, 0);
});

test('dataset has unique IDs, public sources, source dates, and no fictional listings', () => {
  assert.equal(
    new Set(resources.map((resource) => resource.id)).size,
    resources.length,
  );
  assert.ok(resources.length >= 15);
  for (const resource of resources) {
    for (const field of [
      'name',
      'city',
      'address',
      'hours',
      'eligibility',
      'appointment',
      'sourceUrl',
      'sourceName',
      'sourceCheckedAt',
    ])
      assert.ok(resource[field], `${resource.id}: missing ${field}`);
    assert.ok(resource.sourceUrl.startsWith('https://'));
    assert.match(resource.sourceCheckedAt, /^\d{4}-\d{2}-\d{2}$/);
    assert.doesNotMatch(resource.city, /Sample Town|Example City/);
    assert.ok(resource.categories.length > 0);
    assert.ok(
      resource.coordinates === null || hasCoordinates(resource),
      `${resource.id}: invalid coordinates`,
    );
  }
});

test('map guards reject absent and implausible coordinates; directions encode addresses', () => {
  assert.equal(hasCoordinates({ coordinates: null }), false);
  assert.equal(hasCoordinates({ coordinates: { lat: 0, lng: 0 } }), false);
  assert.equal(
    hasCoordinates({ coordinates: { lat: 40.88, lng: -74.04 } }),
    true,
  );
  const record = resources[0];
  assert.equal(
    new URL(directionsUrl(record)).searchParams.get('destination'),
    record.address,
  );
});
