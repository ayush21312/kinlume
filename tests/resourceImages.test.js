import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { resources } from '../src/data/resources.js';

test('every listing has an existing photo and every real location photo has a source', () => {
  for (const resource of resources) {
    assert.ok(
      ['stock', 'location', 'organization'].includes(resource.image.kind),
    );
    assert.ok(
      existsSync(new URL('../public' + resource.image.src, import.meta.url)),
      resource.id,
    );
    assert.ok(
      existsSync(
        new URL(
          '../public/images/' +
            (resource.category === 'opportunities'
              ? 'programs'
              : resource.category) +
            '.jpg',
          import.meta.url,
        ),
      ),
      'Missing fallback',
    );
    if (resource.image.kind !== 'stock')
      assert.ok(resource.image.sourceUrl.startsWith('https://'));
  }
});
