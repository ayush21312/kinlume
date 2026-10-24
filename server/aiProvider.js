import {
  buildModelRequest,
  getReply,
  getLocalReply,
  readModelReply,
} from "./assistant.js";

export function aiConfiguration(env = process.env) {
  const provider = env.AI_PROVIDER || (env.GROQ_API_KEY ? "groq" : "openai");
  const choices = {
    groq: {
      key: env.GROQ_API_KEY,
      model: env.GROQ_MODEL || "openai/gpt-oss-20b",
    },
    openai: { key: env.OPENAI_API_KEY, model: env.OPENAI_MODEL },
    ollama: { model: env.OLLAMA_MODEL },
  };
  const selected = choices[provider] || {};
  return {
    provider,
    apiKey: selected.key?.trim(),
    model: selected.model,
    configured: Boolean(
      selected.model && (provider === "ollama" || selected.key?.trim()),
    ),
  };
}

let statusCache;
export async function aiStatus(config, fetchImpl = fetch) {
  if (!config.configured)
    return {
      configured: false,
      ready: false,
      provider: config.provider,
      reason: "missing_key",
      directoryChat: true,
    };
  if (
    statusCache &&
    statusCache.model === config.model &&
    statusCache.provider === config.provider &&
    statusCache.expires > Date.now()
  )
    return statusCache.result;
  let ready = false;
  let reason = "connection";
  try {
    const endpoint =
      config.provider === "groq"
        ? "https://api.groq.com/openai/v1/models"
        : config.provider === "ollama"
          ? "http://127.0.0.1:11434/api/tags"
          : "https://api.openai.com/v1/models";
    const response = await fetchImpl(endpoint, {
      headers: config.apiKey
        ? { Authorization: `Bearer ${config.apiKey}` }
        : {},
      signal: AbortSignal.timeout(6000),
    });
    if (response.ok) {
      const data = await response.json();
      ready =
        config.provider === "ollama"
          ? data.models?.some((item) => item.name === config.model)
          : data.data?.some((item) => item.id === config.model);
      reason = ready ? "" : "model";
    } else
      reason =
        response.status === 401 || response.status === 403
          ? "key"
          : response.status === 429
            ? "quota"
            : "connection";
  } catch {
    /* Only a short public status is returned, never account details. */
  }
  const result = {
    configured: true,
    ready: Boolean(ready),
    provider: config.provider,
    reason,
    directoryChat: true,
  };
  statusCache = {
    model: config.model,
    provider: config.provider,
    expires: Date.now() + 30000,
    result,
  };
  return result;
}

async function requestGroqReply(
  input,
  { apiKey, model, catalogResources, fetchImpl = fetch, jsonObject = false },
) {
  const request = buildModelRequest(input, model, catalogResources);
  const format = request.text.format;
  const response = await fetchImpl(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(30000),
      body: JSON.stringify({
        model,
        tool_choice: "none",
        messages: [
          {
            role: "system",
            content:
              request.instructions +
              `
Return exactly one JSON object matching this schema: ${JSON.stringify(format.schema)}`,
          },
          request.input[0],
          ...request.input.slice(1).slice(-6),
        ],
        reasoning_effort: model.startsWith("openai/gpt-oss")
          ? "low"
          : undefined,
        max_completion_tokens: 1800,
        response_format: jsonObject
          ? { type: "json_object" }
          : {
              type: "json_schema",
              json_schema: {
                name: format.name,
                strict: true,
                schema: format.schema,
              },
            },
      }),
    },
  );
  if (!response.ok) {
    // Read only a safe error code. Never expose provider payloads or account details.
    let rejectedFormat = false;
    let providerCode = "";
    if (response.status === 400) {
      try {
        const detail = (await response.json()).error || {};
        providerCode =
          typeof detail.code === "string" && /^[a-z_]{1,60}$/.test(detail.code)
            ? detail.code
            : "";
        rejectedFormat =
          [
            "json_validate_failed",
            "output_parse_failed",
            "tool_use_failed",
          ].includes(providerCode) ||
          /(?:failed|unable) to generate (?:valid )?json|json.*(?:schema|validation).*fail/i.test(
            detail.message || "",
          );
      } catch {
        /* Keep the generic configuration error. */
      }
    }
    const error = new Error(
      response.status === 429
        ? "AI free-tier limit reached. Resource search and visit planning still work."
        : "AI is temporarily unavailable. Resource search and visit planning still work.",
    );
    error.code =
      response.status === 429
        ? "quota"
        : response.status === 401 || response.status === 403
          ? "key"
          : rejectedFormat
            ? "response_format"
            : response.status === 400 || response.status === 404
              ? "configuration"
              : "connection";
    error.status = response.status;
    error.providerCode = providerCode;
    error.status = response.status;
    error.providerCode = providerCode;
    throw error;
  }
  const data = await response.json();
  const choice = data.choices?.[0];
  if (
    choice?.finish_reason !== "stop" ||
    typeof choice.message?.content !== "string"
  )
    throw Object.assign(
      new Error("AI could not finish its reply. Try a shorter question."),
      { code: "response_incomplete" },
    );
  try {
    return readModelReply(
      {
        status: "completed",
        output: [
          { content: [{ type: "output_text", text: choice.message.content }] },
        ],
      },
      catalogResources,
    );
  } catch {
    throw Object.assign(new Error("AI returned an invalid reply."), {
      code: "response_format",
    });
  }
}

export async function getGroqReply(input, options) {
  // Retry one temporary network/output failure using the same provider and model.
  // Invalid credentials, configuration and free-tier limits are never retried.
  let jsonObject = false;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await requestGroqReply(input, { ...options, jsonObject });
    } catch (failure) {
      const code = failure.code || "connection";
      if (
        attempt === 0 &&
        ["connection", "response_format", "response_incomplete"].includes(code)
      ) {
        // Recover provider formatting failures without accepting unvalidated output.
        jsonObject =
          code === "response_format" || code === "response_incomplete";
        continue;
      }
      throw Object.assign(new Error(failure.message), {
        code,
        status: failure.status,
        providerCode: failure.providerCode,
      });
    }
  }
}

export function validatePlanLanguage(reply) {
  const text = [reply.answer, ...reply.steps].join(" ").replace(/[‐‑–—]/g, "-");
  // These are claims the directory and estimated planner cannot substantiate.
  // Rejecting them produces an explicitly labeled rules reply, not fake AI.
  const certainty =
    /\b(?:is|are|will be|definitely|currently)\s+(?:all\s+)?open\b|\ball\s+(?:are\s+)?open\b|\b(?:offer|offers|accept|accepts)\s+walk-?in|\byou\s+(?:will|definitely|do)\s+qualify\b|\b(?:this|that|it|calling|checking)\s+(?:will|can)\s+(?:ensure|guarantee)\b|\b(?:EST|EDT|CST|CDT|PST|PDT|MST|MDT)\b/i;
  if (certainty.test(text))
    throw Object.assign(
      new Error(
        "AI explanation needs a safer description of uncertain visit details.",
      ),
      { code: "grounding" },
    );
  return reply;
}

export async function generateAIReply(input, config, catalogResources) {
  const adapter =
    config.provider === "groq"
      ? getGroqReply
      : config.provider === "ollama"
        ? getLocalReply
        : getReply;
  const reply = await adapter(input, {
    apiKey: config.apiKey,
    model: config.model,
    catalogResources,
  });
  return input.planContext ? validatePlanLanguage(reply) : reply;
}
