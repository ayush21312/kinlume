import http from "node:http";
import { existsSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { validateRequest } from "./assistant.js";
import { aiConfiguration, aiStatus, generateAIReply } from "./aiProvider.js";
import { searchResources, findResource } from "./resourceSearch.js";
import { lookupPhoto } from "./photos.js";
import { chatIntent, searchForChat, directoryReply } from "./chat.js";
import { buildVisitPlan, compactPlan } from "./visitPlanner.js";
import { validatePlannerProfile } from "./plannerValidation.js";

import { CloudStore } from "./cloudStore.js";
import { cloudCommunityApi } from "./cloudCommunityApi.js";
import { cloudUser } from "./cloudSession.js";
import { trustedOrigin, requestFingerprint } from "./cloud-security.js";
import { communityApi, accountFromRequest } from "./communityApi.js";
import { setCommunityResourceSource } from "./communityDirectory.js";
import { assistantProfile } from "./personalProfile.js";
const envFile = fileURLToPath(new URL("../.env.server", import.meta.url));
if (existsSync(envFile)) process.loadEnvFile(envFile);
const ai = aiConfiguration();
const hosted = Boolean(
  process.env.VERCEL || process.env.STORAGE_BACKEND === "supabase",
);
let communityStore;
let cloud;
let publishedResources = [];
if (hosted) {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    cloud = new CloudStore({
      url: process.env.SUPABASE_URL,
      serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    communityStore = cloud;
  }
} else {
  const { CommunityStore } = await import("./communityStore.js");
  const dataDirectory = fileURLToPath(new URL("../.data/", import.meta.url));
  mkdirSync(dataDirectory, { recursive: true });
  communityStore = new CommunityStore(dataDirectory + "community.sqlite");
}
const handleCommunity = cloud
  ? cloudCommunityApi(cloud, { json, requestBody })
  : communityStore
    ? communityApi(communityStore, { json, requestBody })
    : async (request, response, url) => {
        if (!url.pathname.startsWith("/api/community")) return false;
        json(response, 503, {
          error: "Account service setup is incomplete. Please try again later.",
        });
        return true;
      };
setCommunityResourceSource(() =>
  hosted ? publishedResources : communityStore.publicResources(),
);
let busy = false;
let aiRequests = [];
let planRequests = [];

function json(response, status, data) {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(JSON.stringify(data));
}

async function requestBody(request) {
  if (request.body !== undefined) {
    const raw =
      typeof request.body === "string"
        ? request.body
        : JSON.stringify(request.body);
    if (Buffer.byteLength(raw) > 24000)
      throw Object.assign(new Error("This request is too long."), {
        status: 413,
      });
    try {
      return JSON.parse(raw);
    } catch {
      throw Object.assign(new Error("Send a valid request."), { status: 400 });
    }
  }
  const chunks = [];
  let length = 0;
  for await (const chunk of request) {
    length += chunk.length;
    if (length > 24000)
      throw Object.assign(
        new Error("This request is too long. Use a shorter message."),
        { status: 413 },
      );
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw Object.assign(new Error("Send a valid request."), { status: 400 });
  }
}

async function handleRequest(request, response) {
  const url = new URL(request.url, "http://127.0.0.1:3001");
  if (await handleCommunity(request, response, url)) return;
  if (
    cloud &&
    ["/api/resources", "/api/assistant", "/api/plan"].includes(url.pathname)
  ) {
    await cloud.limit(`public:${requestFingerprint(request)}`, 90);
    if (url.pathname === "/api/assistant") {
      await cloud.limit(`chat:${requestFingerprint(request)}`, 12);
      await cloud.limit("chat:global", 60);
    }
    publishedResources = await cloud.publicResources();
  }
  if (request.method === "GET") {
    if (url.pathname === "/api/health") {
      if (cloud)
        await cloud.request(
          "/rest/v1/kinlume_workspaces?select=version&limit=1",
        );
      return json(response, communityStore ? 200 : 503, {
        ok: Boolean(communityStore),
        storage: hosted ? "supabase" : "sqlite",
      });
    }
    if (url.pathname === "/api/assistant/status")
      return json(response, 200, await aiStatus(ai));
    if (url.pathname === "/api/resources") {
      try {
        return json(
          response,
          200,
          await searchResources({
            location: url.searchParams.get("location") || "Hackensack, NJ",
            category: url.searchParams.get("category") || "all",
            program: url.searchParams.get("program") || "all",
          }),
        );
      } catch (error) {
        return json(response, error.status === 400 ? 400 : 502, {
          error: error.message,
        });
      }
    }
    const photoId = url.pathname.match(
      /^\/api\/photos\/([a-z0-9-]{1,80})$/,
    )?.[1];
    if (photoId) {
      try {
        const resource = await findResource(photoId);
        return json(response, resource ? 200 : 404, {
          photo: resource ? await lookupPhoto(resource) : null,
        });
      } catch {
        return json(response, 200, { photo: null });
      }
    }
    return json(response, 404, { error: "Not found." });
  }
  if (
    request.method !== "POST" ||
    !["/api/assistant", "/api/plan"].includes(url.pathname)
  )
    return json(response, 404, { error: "Not found." });
  // Public deployment needs authentication and per-account limits. This server
  // accepts writes only from the local development app.
  if (!trustedOrigin(request.headers.origin))
    return json(response, 403, {
      error: "Open the app from its approved address.",
    });
  if (!request.headers["content-type"]?.startsWith("application/json"))
    return json(response, 415, { error: "Send JSON." });
  let body;
  try {
    body = await requestBody(request);
  } catch (error) {
    return json(response, error.status || 400, { error: error.message });
  }

  if (url.pathname === "/api/plan") {
    planRequests = planRequests.filter((time) => Date.now() - time < 60000);
    if (planRequests.length >= 30)
      return json(response, 429, {
        error: "Please wait a moment before planning again.",
      });
    planRequests.push(Date.now());
    try {
      const profile = validatePlannerProfile(body.profile);
      const directory = await searchResources({
        location: profile.location,
        category: profile.needs.length === 1 ? profile.needs[0] : "all",
      });
      const plan = buildVisitPlan(
        profile,
        directory.resources,
        directory.center,
      );
      return json(response, 200, {
        ...plan,
        directoryWarning: directory.warning || "",
        location: directory.resolvedLocation || profile.location,
      });
    } catch (error) {
      return json(response, error.status === 400 ? 400 : 502, {
        error: error.message || "Could not build this plan. Please retry.",
      });
    }
  }

  let input;
  try {
    input = validateRequest(body);
    const user = cloud
      ? await cloudUser(request, response, cloud)
      : communityStore
        ? accountFromRequest(request, communityStore)
        : null;
    const personal = communityStore ? await communityStore.profile(user) : null;
    input.personalContext = assistantProfile(personal);
    if (input.personalContext) {
      input.profile.transport = personal.transport;
      if (!input.profile.city) input.profile.city = personal.location;
      if (input.profile.need === "all" && personal.needs.length === 1)
        input.profile.need = personal.needs[0];
    }
  } catch (error) {
    return json(response, 400, {
      error: error.message || "Invalid chat request.",
    });
  }
  aiRequests = aiRequests.filter((time) => Date.now() - time < 60000);
  if (busy || aiRequests.length >= 12)
    return json(response, 429, {
      error: "Please wait a moment before asking again.",
    });
  busy = true;
  aiRequests.push(Date.now());
  try {
    let result;
    try {
      result = await searchForChat(input);
    } catch {
      const intent = chatIntent(input);
      result = {
        candidates: [],
        resources: [],
        center: null,
        location: intent.location,
        intent,
        warning:
          "The directory is unavailable; no current listings could be loaded.",
      };
    }
    result.candidates = result.candidates.slice(0, 6);
    if (input.planProfile && !result.conversationOnly) {
      const profile = {
        ...input.planProfile,
        location: result.intent.location,
      };
      if (
        ["food", "clothing", "hygiene", "programs"].includes(
          result.intent.category,
        )
      )
        profile.needs = [result.intent.category];
      try {
        result.plan = buildVisitPlan(profile, result.resources, result.center);
        input.planContext = compactPlan(result.plan);
        // A plan's selected resources must be available to the AI's ID validator.
        result.candidates = [
          ...new Map(
            [...result.plan.resources, ...result.plan.referrals].map(
              (resource) => [resource.id, resource],
            ),
          ).values(),
        ].slice(0, 6);
      } catch (error) {
        input.planContext = { status: "none", message: error.message };
        result.plan = { message: error.message, options: [], resources: [] };
        result.candidates = [];
      }
    }
    if (!ai.configured)
      return json(response, 200, {
        ...directoryReply(result),
        answer:
          "AI is not configured on this server. " +
          directoryReply(result).answer,
        aiError: "configuration",
      });
    try {
      const reply = await generateAIReply(input, ai, result.candidates);
      return json(response, 200, {
        ...reply,
        engine: ai.provider,
        resources: result.candidates,
        location: result.location,
      });
    } catch (error) {
      console.warn("AI reply fallback", {
        provider: ai.provider,
        code: error.code || "connection",
        status: error.status,
        providerCode: error.providerCode,
      });
      const fallback = directoryReply(result);
      return json(response, 200, {
        ...fallback,
        answer:
          (error.code === "quota"
            ? "AI free-tier limit reached. "
            : error.code === "grounding"
              ? "Showing the visit planner’s checked explanation. "
              : error.code === "key"
                ? "AI authentication failed. Update the server API key. "
                : error.code === "response_format" ||
                    error.code === "response_incomplete"
                  ? "AI could not finish its reply. Showing directory results. "
                  : error.code === "configuration"
                    ? "AI rejected this request. Showing directory results. "
                    : "AI connection unavailable right now. Showing directory results. ") +
          fallback.answer,
        aiError: error.code || "connection",
      });
    }
  } catch {
    json(response, 502, {
      error: "Could not prepare this reply. Please try again.",
    });
  } finally {
    busy = false;
  }
}

// Export the handler for Vercel; start an HTTP listener only in local development.
export default async function handler(request, response) {
  try {
    await handleRequest(request, response);
  } catch (error) {
    if (!response.headersSent)
      json(response, error.status || 503, {
        error: error.status
          ? error.message
          : "The service is temporarily unavailable. Please try again.",
      });
  }
}
if (!process.env.VERCEL) {
  const server = http.createServer(handler);
  server.requestTimeout = 90000;
  server.listen(3001, "127.0.0.1", () =>
    console.log("Kinlume API: http://127.0.0.1:3001"),
  );
}
