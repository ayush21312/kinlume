import test from "node:test";
import assert from "node:assert/strict";
import { searchForChat, isConversationOnly } from "../server/chat.js";
import { buildModelRequest, validateRequest } from "../server/assistant.js";

test("a greeting stays conversational even when a saved visit profile is attached", async () => {
  const input = validateRequest({
    messages: [{ role: "user", text: "Hello!" }],
    planProfile: {
      needs: ["food"],
      location: "Hackensack, NJ",
      transport: "walk",
      date: "2026-10-22",
      startTime: "09:00",
      endTime: "17:00",
      maxTravelMinutes: 30,
    },
  });
  const result = await searchForChat(input, {
    fetchImpl: () => {
      throw new Error("Greetings must not require a directory connection.");
    },
  });
  assert.equal(result.conversationOnly, true);
  assert.deepEqual(result.resources, []);
  assert.deepEqual(result.candidates, []);
});

test("a greeting followed by a real request still searches for help", () => {
  for (const text of [
    "Hello, I need food",
    "Hi, find programs in London",
    "Thanks, can you explain my visit plan?",
  ]) {
    assert.equal(
      isConversationOnly(
        validateRequest({ messages: [{ role: "user", text }] }),
      ),
      false,
    );
  }
  for (const text of ["hello", "Hi there!", "How are you?", "Thank you"]) {
    assert.equal(
      isConversationOnly(
        validateRequest({ messages: [{ role: "user", text }] }),
      ),
      true,
    );
  }
});

test("saved preferences are background context rather than a forced planning instruction", () => {
  const input = validateRequest({
    messages: [{ role: "user", text: "hello" }],
  });
  input.personalContext = { needs: ["food"], transport: "transit" };
  const request = buildModelRequest(input, "test-model", []);
  assert.match(request.instructions, /Respond to the latest message first/);
  assert.match(request.instructions, /return empty steps and resourceIds/);
  assert.equal(request.input.at(-1).content, "hello");
});
