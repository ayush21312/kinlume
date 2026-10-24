import test from 'node:test';
import assert from 'node:assert/strict';
import {
  aiConfiguration,
  aiStatus,
  getGroqReply,
  validatePlanLanguage,
} from '../server/aiProvider.js';
import { validateRequest } from '../server/assistant.js';

const input = validateRequest({
  messages: [{ role: 'user', text: 'Where can I get food?' }],
});
test('Groq configuration never uses a browser key and reports missing credentials honestly', async () => {
  const config = aiConfiguration({ AI_PROVIDER: 'groq' });
  assert.equal(config.configured, false);
  assert.equal((await aiStatus(config)).ready, false);
});

test('Groq requests keep keys in headers and accept only known resource IDs', async () => {
  const result = await getGroqReply(input, {
    apiKey: 'private-test-key',
    model: 'openai/gpt-oss-20b',
    catalogResources: [{ id: 'real', name: 'Real pantry' }],
    fetchImpl: async (url, options) => {
      assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
      assert.equal(options.headers.Authorization, 'Bearer private-test-key');
      assert.equal(options.body.includes('private-test-key'), false);
      assert.equal(
        JSON.parse(options.body).response_format.json_schema.strict,
        true,
      );
      return {
        ok: true,
        json: async () => ({
          choices: [
            {
              finish_reason: 'stop',
              message: {
                content: JSON.stringify({
                  answer: 'Call the pantry.',
                  steps: ['Confirm hours'],
                  resourceIds: ['real', 'fake'],
                }),
              },
            },
          ],
        }),
      };
    },
  });
  assert.deepEqual(result.resourceIds, ['real']);
});

test('free-tier limits and incomplete model replies are handled without leaking account responses', async () => {
  await assert.rejects(
    () =>
      getGroqReply(input, {
        apiKey: 'private',
        model: 'model',
        catalogResources: [],
        fetchImpl: async () => ({ ok: false, status: 429 }),
      }),
    (error) => error.code === 'quota',
  );
  await assert.rejects(
    () =>
      getGroqReply(input, {
        apiKey: 'private',
        model: 'model',
        catalogResources: [],
        fetchImpl: async () => ({
          ok: true,
          json: async () => ({
            choices: [{ finish_reason: 'length', message: { content: '{}' } }],
          }),
        }),
      }),
    /finish/,
  );
});

test('AI cannot turn published hours into live opening or walk-in guarantees', () => {
  for (const answer of [
    'All are open during your window.',
    'They offer walk-in service.',
    'Open 9–17 EST.',
    'This will ensure supplies are available.',
  ]) {
    assert.throws(
      () => validatePlanLanguage({ answer, steps: [] }),
      (error) => error.code === 'grounding',
    );
  }
});
test('cautious AI guidance can explain a plan without making guarantees', () => {
  const reply = {
    answer:
      'These options may fit. Contact an organization to confirm its distribution hours and eligibility.',
    steps: ['Check the route before leaving.'],
  };
  assert.deepEqual(validatePlanLanguage(reply), reply);
});
