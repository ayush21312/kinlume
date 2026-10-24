import test from "node:test";
import assert from "node:assert/strict";
import { chatIntent, searchForChat, directoryReply } from "../server/chat.js";
import { validateRequest } from "../server/assistant.js";
import { getGroqReply } from "../server/aiProvider.js";

const question = (text) =>
  validateRequest({
    profile: { city: "Hackensack, NJ" },
    messages: [{ role: "user", text }],
  });
test("paid work stays separate from volunteer opportunities and career clothing", () => {
  for (const text of [
    "job opportunities near me",
    "job opporutnities near me",
    "I need paid work",
    "Who is hiring near me?",
  ]) {
    assert.deepEqual(chatIntent(question(text)), {
      location: "Hackensack, NJ",
      category: "programs",
      program: "employment",
    });
  }
  assert.equal(
    chatIntent(question("volunteer opportunities near me")).category,
    "opportunities",
  );
  assert.equal(
    chatIntent(question("I need clothing for a job interview")).category,
    "clothing",
  );
});

test("employment search offers official job sources without pretending they are vacancies", async () => {
  const result = await searchForChat(
    question("I need job opportunities near me"),
    {
      fetchImpl: async () => ({
        ok: true,
        json: async () => ({
          success: true,
          location: { lat: 40.89, lng: -74.04, state: "NJ" },
          resources: [],
        }),
      }),
    },
  );
  const ids = result.candidates.map((item) => item.id);
  assert.ok(ids.includes("bergen-job-center"));
  assert.ok(ids.includes("nj-job-source"));
  assert.ok(!ids.includes("wric-career-closet"));
  assert.ok(
    !result.candidates.some((item) => item.category === "opportunities"),
  );
  assert.match(
    directoryReply(result).answer,
    /don’t have verified live job vacancies/,
  );
});

const success = () => ({
  ok: true,
  json: async () => ({
    choices: [
      {
        finish_reason: "stop",
        message: {
          content: JSON.stringify({
            answer: "What kind of work are you looking for?",
            steps: [],
            resourceIds: [],
          }),
        },
      },
    ],
  }),
});
test("temporary connection and unusable output recover with only one retry", async () => {
  for (const failure of [
    () => {
      throw new TypeError("fetch failed");
    },
    () => ({ ok: false, status: 503 }),
    () => ({
      ok: false,
      status: 400,
      json: async () => ({ error: { code: "json_validate_failed" } }),
    }),
    () => ({
      ok: true,
      json: async () => ({
        choices: [{ finish_reason: "length", message: { content: "{}" } }],
      }),
    }),
  ]) {
    let calls = 0;
    const reply = await getGroqReply(question("hello"), {
      apiKey: "test-key",
      model: "test-model",
      catalogResources: [],
      fetchImpl: async () => (++calls === 1 ? failure() : success()),
    });
    assert.equal(calls, 2);
    assert.equal(reply.answer, "What kind of work are you looking for?");
  }
});
test("credentials, quota and configuration errors are never retried", async () => {
  for (const [status, code] of [
    [401, "key"],
    [403, "key"],
    [429, "quota"],
    [400, "configuration"],
    [404, "configuration"],
  ]) {
    let calls = 0;
    await assert.rejects(
      () =>
        getGroqReply(question("hello"), {
          apiKey: "test-key",
          model: "test-model",
          catalogResources: [],
          fetchImpl: async () => {
            calls++;
            return { ok: false, status, json: async () => ({}) };
          },
        }),
      (error) => error.code === code,
    );
    assert.equal(calls, 1);
  }
});
test("persistent incomplete output stops after two attempts with a useful error code", async () => {
  let calls = 0;
  await assert.rejects(
    () =>
      getGroqReply(question("hello"), {
        apiKey: "test-key",
        model: "test-model",
        catalogResources: [],
        fetchImpl: async () => {
          calls++;
          return {
            ok: true,
            json: async () => ({
              choices: [
                { finish_reason: "stop", message: { content: "invalid json" } },
              ],
            }),
          };
        },
      }),
    (error) => error.code === "response_format",
  );
  assert.equal(calls, 2);
});
