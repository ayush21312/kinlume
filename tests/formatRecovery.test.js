import test from "node:test";
import assert from "node:assert/strict";
import { getGroqReply } from "../server/aiProvider.js";
import { validateRequest } from "../server/assistant.js";

test("Groq output_parse_failed retries JSON mode but still excludes unknown resources", async () => {
  const modes = [];
  const reply = await getGroqReply(
    validateRequest({
      messages: [{ role: "user", text: "Find paid jobs near Hackensack, NJ" }],
    }),
    {
      apiKey: "test-only",
      model: "test-model",
      catalogResources: [{ id: "known" }],
      fetchImpl: async (url, options) => {
        assert.equal(JSON.parse(options.body).tool_choice, "none");
        modes.push(JSON.parse(options.body).response_format.type);
        if (modes.length === 1)
          return {
            ok: false,
            status: 400,
            json: async () => ({ error: { code: "output_parse_failed" } }),
          };
        return {
          ok: true,
          json: async () => ({
            choices: [
              {
                finish_reason: "stop",
                message: {
                  content: JSON.stringify({
                    answer: "Try the job-search service.",
                    steps: [],
                    resourceIds: ["known", "invented"],
                  }),
                },
              },
            ],
          }),
        };
      },
    },
  );
  assert.deepEqual(modes, ["json_schema", "json_object"]);
  assert.deepEqual(reply.resourceIds, ["known"]);
});
