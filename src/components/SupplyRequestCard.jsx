import { useState } from "react";
export default function SupplyRequestCard({
  request,
  user,
  busy,
  onAction,
  onSignIn,
  onEdit,
  managing = false,
  pledges = [],
}) {
  const [pledging, setPledging] = useState(false),
    [confirming, setConfirming] = useState(null);
  const totals = request.totals;
  return (
    <article className="supply-card">
      <div className="supply-card-heading">
        <h2>{request.item}</h2>
        {managing && (
          <button className="text-button" onClick={onEdit}>
            Edit
          </button>
        )}
      </div>
      {!managing && (
        <p className="supply-organization">
          {request.organization.name} · {request.organization.city}
        </p>
      )}
      <dl className="supply-totals">
        {["requested", "pledged", "received"].map((key) => (
          <div key={key}>
            <dt>{key}</dt>
            <dd>{totals[key].toLocaleString()}</dd>
          </div>
        ))}
      </dl>
      <div
        className="supply-progress"
        role="progressbar"
        aria-label="Items received"
        aria-valuemin={0}
        aria-valuemax={totals.requested}
        aria-valuenow={totals.received}
      >
        <span
          style={{ width: `${(totals.received / totals.requested) * 100}%` }}
        />
      </div>
      <p className="supply-remaining">
        {request.closed
          ? "Closed to new pledges"
          : totals.received === totals.requested
            ? "Fulfilled"
            : totals.remaining
              ? `${totals.remaining} ${request.unit} needed`
              : "Fully pledged · awaiting delivery"}
      </p>
      {managing ? (
        <button
          className="secondary-button"
          disabled={busy}
          onClick={() =>
            onAction(
              {
                type: "close-request",
                id: request.id,
                closed: !request.closed,
              },
              request.closed ? "Request reopened." : "Request closed.",
            )
          }
        >
          {request.closed ? "Reopen request" : "Close request"}
        </button>
      ) : (
        !request.closed &&
        totals.remaining > 0 &&
        (!pledging ? (
          <button
            className="primary-button"
            onClick={() => {
              if (!user) onSignIn();
              else setPledging(true);
            }}
          >
            Pledge items
          </button>
        ) : (
          <form
            className="dashboard-form"
            onSubmit={async (event) => {
              event.preventDefault();
              const quantity = new FormData(event.currentTarget).get(
                "quantity",
              );
              if (
                await onAction(
                  { type: "pledge", requestId: request.id, quantity },
                  "Pledge saved.",
                )
              )
                setPledging(false);
            }}
          >
            <label>
              Quantity ({request.unit})
              <input
                name="quantity"
                type="number"
                min={1}
                max={totals.remaining}
                step={1}
                required
              />
            </label>
            <div className="editor-actions">
              <button className="primary-button" disabled={busy}>
                Confirm pledge
              </button>
              <button
                type="button"
                className="text-button"
                onClick={() => setPledging(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        ))
      )}
      {!managing && pledges.length > 0 && (
        <details className="pledge-history">
          <summary>Your pledges ({pledges.length})</summary>
          {pledges.map((pledge) => (
            <div className="pledge-row" key={pledge.id}>
              <span className="pledge-reference">
                #{pledge.id.slice(0, 6).toUpperCase()}
              </span>
              <p>
                <strong>
                  {pledge.quantity} {request.unit}
                </strong>
                <span>
                  {pledge.cancelled
                    ? "Cancelled"
                    : `${pledge.received} received · ${pledge.quantity - pledge.received} pending`}
                </span>
              </p>
              {!pledge.cancelled &&
                pledge.quantity > pledge.received &&
                (confirming === pledge.id ? (
                  <div className="editor-actions">
                    <button
                      className="secondary-button"
                      disabled={busy}
                      onClick={async () => {
                        await onAction(
                          { type: "cancel", pledgeId: pledge.id },
                          "Pledge cancelled.",
                        );
                        setConfirming(null);
                      }}
                    >
                      Confirm cancellation
                    </button>
                    <button
                      className="text-button"
                      onClick={() => setConfirming(null)}
                    >
                      Keep pledge
                    </button>
                  </div>
                ) : (
                  <button
                    className="text-button"
                    onClick={() => setConfirming(pledge.id)}
                  >
                    Cancel remaining pledge
                  </button>
                ))}
            </div>
          ))}
        </details>
      )}
    </article>
  );
}
