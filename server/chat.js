import { searchResources } from "./resourceSearch.js";

// Only short social messages skip directory search. "Hello, I need food" still searches.
export function isConversationOnly(input) {
  const last =
    input.messages
      .at(-1)
      ?.content?.trim()
      .toLowerCase()
      .replace(/[!.,?]+/g, "")
      .replace(/\s+/g, " ") || "";
  return /^(?:(?:hi|hello|hey)(?: there)?(?: how are you)?|good (?:morning|afternoon|evening)|how are you|thanks(?: a lot)?|thank you(?: very much)?|bye|goodbye|what can you do|who are you)$/.test(
    last,
  );
}

export function chatIntent(input) {
  let location = input.profile.city || "Hackensack, NJ";
  let category = input.profile.need || "all",
    program = "all";
  for (const message of input.messages.filter(
    (message) => message.role === "user",
  )) {
    const text = message.content;
    const zip = text.match(/\b\d{5}\b/);
    // Keep a follow-up question out of the place name (e.g. "NJ. What...").
    const locationText = text.split(
      /[!?;\n]|\.\s+(?=(?:what|how|can|could|should|please|do|does|is|are|when|where|i)\b)/i,
    )[0];
    const named = locationText.match(
      /\b(?:in|near|around)\s+([\p{L}\p{N}][\p{L}\p{N} .'-]{1,45}(?:,\s*[\p{L} .'-]{2,40})?)/iu,
    );
    const cityOnly = text.match(
      /^([\p{L}][\p{L}\p{N} .'-]{1,40},\s*[\p{L} .'-]{2,40})[.!]?$/u,
    );
    if (named && !/^(need|my|the|me)\b/i.test(named[1]))
      location = named[1]
        .split(/\s+(?:and|but|with|please)\b/i)[0]
        .trim()
        .replace(/[.!?]+$/, "");
    else if (zip) location = zip[0];
    else if (cityOnly) location = cityOnly[1];
    // Paid work takes priority over the generic word "opportunities".
    if (
      /\b(?:jobs?|employment|hiring|vacancies|career|apprenticeship)\b|paid work|looking for work|find work/i.test(
        text,
      ) &&
      !/volunteer|clothes|clothing|coat/i.test(text)
    ) {
      category = "programs";
      program = "employment";
    } else if (/volunteer|opportunit|give time/i.test(text))
      category = "opportunities";
    else if (/clothes|clothing|coat/i.test(text)) category = "clothing";
    else if (/hygiene|toiletr|soap|diaper/i.test(text)) category = "hygiene";
    else if (
      /program|benefit|wic|snap|utility|energy|health|school|summer|job|training/i.test(
        text,
      )
    ) {
      category = "programs";
      program = /\bwic\b/i.test(text)
        ? "wic"
        : /\bsnap\b|benefit/i.test(text)
          ? "benefits"
          : /utility|energy|heating/i.test(text)
            ? "energy"
            : /health|clinic/i.test(text)
              ? "health"
              : /summer/i.test(text)
                ? "summer"
                : /school|student meal/i.test(text)
                  ? "school"
                  : /job|training/i.test(text)
                    ? "employment"
                    : "all";
    } else if (/food|pantr|grocer|hungry|meal/i.test(text)) category = "food";
  }
  return { location, category, program };
}

export async function searchForChat(input, options = {}) {
  const intent = chatIntent(input);
  if (isConversationOnly(input))
    return {
      intent,
      conversationOnly: true,
      candidates: [],
      resources: [],
      center: null,
      location: intent.location,
    };
  const result = await searchResources(intent, options);
  const askedAboutSeniors = /senior|elder|retir|older|60|65/i.test(
    input.messages.map((message) => message.content).join(" "),
  );
  const candidates = result.resources
    .filter(
      (resource) =>
        intent.program !== "employment" || resource.category !== "clothing",
    )
    .filter(
      (resource) =>
        askedAboutSeniors ||
        !/senior meal|senior congregate/i.test(resource.serviceLabel),
    )
    .slice(0, 10);
  return { ...result, candidates, intent };
}

export function directoryReply(result) {
  const { candidates, intent } = result;
  if (result.conversationOnly)
    return {
      answer: "Hi! How can I help you today?",
      steps: [],
      resourceIds: [],
      resources: [],
      engine: "directory",
      location: intent.location,
    };
  if (result.plan)
    return {
      answer: result.plan.message,
      steps: result.plan.options[0]?.steps || [
        "Change the time, travel method or access preferences, or contact an organization for missing information.",
      ],
      resourceIds: result.plan.options.map((option) => option.resourceId),
      resources: result.plan.resources,
      engine: "directory",
      location: intent.location,
    };
  const resourceIds = candidates.slice(0, 3).map((resource) => resource.id);
  if (intent.program === "employment")
    return {
      answer: resourceIds.length
        ? `I don’t have verified live job vacancies. These job-search services can help you look for paid work in ${intent.location}. What kind of work and schedule would suit you?`
        : `I couldn’t find employment services for ${intent.location} in the connected directory. What city and country are you looking in?`,
      steps: [],
      resourceIds,
      engine: "directory",
      resources: candidates,
      location: intent.location,
    };
  const kind =
    intent.category === "opportunities"
      ? "volunteer opportunities"
      : intent.category === "programs"
        ? "programs"
        : intent.category === "all"
          ? "resources"
          : `${intent.category} resources`;
  return {
    answer: resourceIds.length
      ? `Here are ${kind} to check near ${intent.location}. ${intent.category === "opportunities" ? "Open an organization’s opportunity page for current roles and sign-up details." : "Open a listing to check hours, eligibility, and contact details."}`
      : `I couldn’t find ${kind} for ${intent.location} in the connected directory. Try a nearby city and country, or a different type of help.`,
    steps: [],
    resourceIds,
    engine: "directory",
    resources: candidates,
    location: intent.location,
  };
}
