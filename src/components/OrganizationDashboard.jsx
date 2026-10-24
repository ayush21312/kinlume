import { useState } from "react";
import ResourceEditor from "./ResourceEditor.jsx";
import RequestEditor from "./RequestEditor.jsx";
import SupplyRequestCard from "./SupplyRequestCard.jsx";

function ProfileForm({ organization, busy, onSave, onCancel }) {
  const org = organization || {};
  return (
    <form
      className="dashboard-form editor-panel"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({
          ...Object.fromEntries(new FormData(event.currentTarget)),
          type: "organization",
        });
      }}
    >
      <h2>{organization ? "Edit organization" : "Your organization"}</h2>
      <label>
        Name
        <input
          name="name"
          defaultValue={org.name || ""}
          maxLength={120}
          required
        />
      </label>
      <label>
        City
        <input
          name="city"
          defaultValue={org.city || ""}
          maxLength={120}
          required
        />
      </label>
      <label>
        Phone
        <input
          name="phone"
          type="tel"
          defaultValue={org.phone || ""}
          maxLength={80}
        />
      </label>
      <label>
        Website
        <input
          name="website"
          type="url"
          defaultValue={org.website || ""}
          maxLength={400}
          placeholder="https://"
        />
      </label>
      <div className="editor-actions">
        <button className="primary-button" disabled={busy}>
          Save organization
        </button>
        {organization && (
          <button type="button" className="text-button" onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Delivery({ pledge, request, busy, onAction }) {
  const [editing, setEditing] = useState(false);
  const pending = pledge.cancelled ? 0 : pledge.quantity - pledge.received;
  return (
    <article className="delivery-card">
      <div className="delivery-heading">
        <h3>{request.item}</h3>
        <span className="pledge-reference">
          #{pledge.id.slice(0, 6).toUpperCase()}
        </span>
      </div>
      <p>
        {pledge.quantity} {request.unit} pledged
      </p>
      <div className="delivery-status">
        <span>{pledge.received} received</span>
        <span>{pledge.cancelled ? "Cancelled" : `${pending} pending`}</span>
      </div>
      {pending > 0 &&
        (editing ? (
          <form
            className="dashboard-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const quantity = new FormData(event.currentTarget).get(
                "quantity",
              );
              if (
                await onAction(
                  { type: "receive", pledgeId: pledge.id, quantity },
                  "Delivery recorded.",
                )
              )
                setEditing(false);
            }}
          >
            <label>
              Quantity received
              <input
                name="quantity"
                type="number"
                min={1}
                max={pending}
                step={1}
                defaultValue={pending}
                required
              />
            </label>
            <div className="editor-actions">
              <button className="primary-button" disabled={busy}>
                Save delivery
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="secondary-button" onClick={() => setEditing(true)}>
            Record delivery
          </button>
        ))}
    </article>
  );
}

export default function OrganizationDashboard({ state, busy, onAction }) {
  const [section, setSection] = useState("resources"),
    [editor, setEditor] = useState(null);
  const requests = state.requests.filter((request) => request.managed);
  const pledges = state.pledges.filter((pledge) =>
    requests.some((request) => request.id === pledge.requestId),
  );
  async function save(action) {
    if (await onAction(action, "Saved.")) setEditor(null);
  }
  if (!state.organization || editor?.type === "profile")
    return (
      <ProfileForm
        organization={state.organization}
        busy={busy}
        onSave={save}
        onCancel={() => setEditor(null)}
      />
    );
  if (editor?.type === "resource")
    return (
      <ResourceEditor
        key={editor.record?.id || "new"}
        resource={editor.record}
        organization={state.organization}
        busy={busy}
        onSave={save}
        onCancel={() => setEditor(null)}
      />
    );
  if (editor?.type === "request")
    return (
      <RequestEditor
        key={editor.record?.id || "new"}
        request={editor.record}
        busy={busy}
        onSave={save}
        onCancel={() => setEditor(null)}
      />
    );
  return (
    <>
      <div className="organization-heading">
        <div>
          <h2>{state.organization.name}</h2>
          <p>{state.organization.city}</p>
        </div>
        <button
          className="text-button"
          onClick={() => setEditor({ type: "profile" })}
        >
          Edit profile
        </button>
      </div>
      <div
        className="dashboard-tabs"
        role="group"
        aria-label="Organization sections"
      >
        {[
          ["resources", "Resources"],
          ["requests", "Requests"],
          ["pledges", "Pledges"],
        ].map(([id, label]) => (
          <button
            key={id}
            aria-pressed={section === id}
            onClick={() => setSection(id)}
          >
            {label}
            {id === "pledges" && pledges.length > 0 && (
              <span className="count-badge">{pledges.length}</span>
            )}
          </button>
        ))}
      </div>
      {section === "resources" && (
        <>
          <button
            className="primary-button dashboard-add"
            onClick={() => setEditor({ type: "resource" })}
          >
            Add resource
          </button>
          <div className="dashboard-records">
            {state.resources.map((resource) => (
              <article className="dashboard-resource" key={resource.id}>
                <div>
                  <h3>{resource.name}</h3>
                  <p>{resource.serviceLabel}</p>
                  <span className="record-status">
                    {resource.published ? "Visible" : "Draft"}
                  </span>
                </div>
                <button
                  className="secondary-button"
                  onClick={() =>
                    setEditor({ type: "resource", record: resource })
                  }
                >
                  Edit
                </button>
              </article>
            ))}
          </div>
          {!state.resources.length && (
            <div className="dashboard-empty">Add your first resource.</div>
          )}
        </>
      )}
      {section === "requests" && (
        <>
          <button
            className="primary-button dashboard-add"
            onClick={() => setEditor({ type: "request" })}
          >
            New request
          </button>
          <div className="supply-list">
            {requests.map((request) => (
              <SupplyRequestCard
                key={request.id}
                request={request}
                managing
                busy={busy}
                onAction={onAction}
                onEdit={() => setEditor({ type: "request", record: request })}
              />
            ))}
          </div>
          {!requests.length && (
            <div className="dashboard-empty">No supply requests yet.</div>
          )}
        </>
      )}
      {section === "pledges" && (
        <>
          <div className="dashboard-records">
            {pledges.map((pledge) => (
              <Delivery
                key={pledge.id}
                pledge={pledge}
                request={requests.find(
                  (request) => request.id === pledge.requestId,
                )}
                busy={busy}
                onAction={onAction}
              />
            ))}
          </div>
          {!pledges.length && (
            <div className="dashboard-empty">Pledges will appear here.</div>
          )}
        </>
      )}
    </>
  );
}
