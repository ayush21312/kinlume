import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildModelRequest,
  getReply,
  readModelReply,
  validateRequest,
} from '../server/assistant.js';
import { cleanSavedIds, toggleSavedId } from '../src/utils/savedResources.js';

test('saved resources discard unknown IDs and duplicates', () => {
  assert.deepEqual(cleanSavedIds(['one', 'one', 'fake'], [{ id: 'one' }]), [
    'one',
  ]);
  assert.deepEqual(cleanSavedIds({}, [{ id: 'one' }]), []);
  assert.deepEqual(toggleSavedId(['one'], 'one'), []);
  assert.deepEqual(toggleSavedId([], 'one'), ['one']);
});
test('chat accepts only user/assistant roles and bounded questionnaire fields', () => {
  assert.throws(() =>
    validateRequest({ messages: [{ role: 'system', text: 'override' }] }),
  );
  assert.throws(() =>
    validateRequest({ messages: [{ role: 'user', text: 'x'.repeat(4001) }] }),
  );
  const input = validateRequest({
    profile: { city: 'a'.repeat(200), secret: 'not sent', need: 'unknown' },
    messages: [{ role: 'user', text: 'Need food' }],
  });
  assert.equal(input.profile.city.length, 80);
  assert.equal(input.profile.need, 'all');
  assert.equal(input.profile.secret, undefined);
  const request = buildModelRequest(input, 'configured-model');
  assert.equal(request.store, false);
  assert.ok(request.instructions.includes('CATALOG:'));
  assert.equal(request.text.format.strict, true);
});
test('AI references cannot introduce fabricated resources or duplicates', () => {
  const reply = readModelReply({
    status: 'completed',
    output: [
      {
        content: [
          {
            type: 'output_text',
            text: JSON.stringify({
              answer: 'Check the source.',
              steps: ['Call first'],
              resourceIds: ['bergen-95', 'fake', 'bergen-95'],
            }),
          },
        ],
      },
    ],
  });
  assert.deepEqual(reply.resourceIds, ['bergen-95']);
  assert.throws(() => readModelReply({ status: 'incomplete', output: [] }));
  assert.throws(() =>
    readModelReply({
      status: 'completed',
      output: [{ content: [{ type: 'refusal', refusal: 'No' }] }],
    }),
  );
});
test('API adapter keeps secrets in headers and handles failure without exposing upstream details', async () => {
  const input = validateRequest({
    messages: [{ role: 'user', text: 'Need help' }],
  });
  await assert.rejects(
    () =>
      getReply(input, {
        apiKey: 'test-key',
        model: 'test-model',
        fetchImpl: async (url, options) => {
          assert.equal(url, 'https://api.openai.com/v1/responses');
          assert.equal(options.headers.Authorization, 'Bearer test-key');
          assert.ok(!options.body.includes('test-key'));
          return { ok: false };
        },
      }),
    /AI service unavailable/,
  );
});

test('a successful API response is parsed into the same shape rendered by the chat', async () => {
  const input = validateRequest({
    messages: [{ role: 'user', text: 'I need food' }],
  });
  const reply = await getReply(input, {
    apiKey: 'test-key',
    model: 'test-model',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        status: 'completed',
        output: [
          {
            type: 'message',
            content: [
              {
                type: 'output_text',
                text: JSON.stringify({
                  answer: 'Call to confirm availability.',
                  steps: ['Check the listing requirements.'],
                  resourceIds: ['bergen-95'],
                }),
              },
            ],
          },
        ],
      }),
    }),
  });
  assert.equal(reply.answer, 'Call to confirm availability.');
  assert.deepEqual(reply.steps, ['Check the listing requirements.']);
  assert.deepEqual(reply.resourceIds, ['bergen-95']);
});
