import { randomUUID } from "node:crypto";
import { changeOrganization } from "./organizationRules.js";
import { problem } from "./cloud-errors.js";

export function applyWorkspaceAction(rows, user, action) {
  if (!user) throw problem("Sign in to continue.", 401);
  if (
    !action ||
    typeof action.type !== "string" ||
    ![
      "organization",
      "import-device",
      "request",
      "edit-request",
      "close-request",
      "resource",
      "pledge",
      "receive",
      "cancel",
    ].includes(action.type)
  )
    throw problem("Choose a valid action.");
  let target = rows.find((row) => row.owner === user.id);
  if (
    ["pledge", "receive", "cancel", "edit-request", "close-request"].includes(
      action.type,
    )
  ) {
    target = rows.find((row) =>
      action.type === "pledge" || action.type.endsWith("request")
        ? row.state.requests.some(
            (item) => item.id === (action.requestId || action.id),
          )
        : row.state.pledges.some((item) => item.id === action.pledgeId),
    );
  }
  if (!target) throw problem("Record not found.", 404);
  const owner = target.owner === user.id;
  const pledge = target.state.pledges.find(
    (item) => item.id === action.pledgeId,
  );
  if (
    action.type === "cancel"
      ? !owner && pledge?.donorId !== user.id
      : action.type !== "pledge" && !owner
  )
    throw problem("You can only manage your own organization.", 403);
  const trusted = { ...action };
  if (action.type === "request") trusted.id = randomUUID();
  if (action.type === "resource") {
    if (
      action.id &&
      !(target.state.resources || []).some((item) => item.id === action.id)
    )
      throw problem("Resource not found.", 404);
    trusted.id = action.id || `org-${randomUUID()}`;
  }
  if (action.type === "pledge") trusted.id = randomUUID();
  const next = changeOrganization(target.state, trusted);
  if (action.type === "import-device")
    next.pledges.forEach((pledge) => {
      pledge.donorId = user.id;
    });
  if (action.type === "pledge")
    next.pledges.find((item) => item.id === trusted.id).donorId = user.id;

  return { owner: target.owner, next };
}
