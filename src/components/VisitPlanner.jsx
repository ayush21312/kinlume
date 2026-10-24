import { useEffect, useRef, useState } from "react";
import SaveButton from "./SaveButton.jsx";
import Icon from "./Icon.jsx";

function startingPreferences(location) {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return {
    needs: ["food"],
    location,
    transport: "walk",
    date: `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, "0")}-${String(tomorrow.getDate()).padStart(2, "0")}`,
    startTime: "09:00",
    endTime: "17:00",
    maxTravelMinutes: 30,
    visitMinutes: 20,
    stepFree: false,
    includeSeniors: false,
    includeVeterans: false,
    timeZone: "",
    travelOverrides: {},
  };
}

function planDirections(resource, profile) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.search = new URLSearchParams({
    api: "1",
    origin: profile.location,
    destination: resource.address,
    travelmode:
      profile.transport === "walk"
        ? "walking"
        : profile.transport === "transit"
          ? "transit"
          : "driving",
  });
  return url.href;
}

export default function VisitPlanner({
  location,
  profile,
  onProfileChange,
  plan,
  onPlanChange,
  onResources,
  onSelect,
  savedIds,
  onToggleSave,
  onDiscuss,
}) {
  const [draft, setDraft] = useState(
    () => profile || startingPreferences(location),
  );
  const [editing, setEditing] = useState(!plan);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [travelTimes, setTravelTimes] = useState({});
  const pending = useRef(null);
  const top = useRef(null);
  useEffect(() => () => pending.current?.abort(), []);

  function change(key, value) {
    const resetTravel = ["location", "transport", "date"].includes(key);
    setDraft((previous) => ({
      ...previous,
      [key]: value,
      ...(resetTravel ? { travelOverrides: {} } : {}),
    }));
    if (resetTravel) setTravelTimes({});
  }
  function toggleNeed(need) {
    change(
      "needs",
      draft.needs.includes(need)
        ? draft.needs.filter((value) => value !== need)
        : [...draft.needs, need],
    );
  }

  async function makePlan(event, updated = draft) {
    event?.preventDefault();
    if (busy) return;
    const controller = new AbortController();
    pending.current = controller;
    const timeout = setTimeout(() => controller.abort(), 65000);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile: updated }),
        signal: controller.signal,
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(
          data.error || "Could not build a plan. Please try again.",
        );
      if (controller.signal.aborted) return;
      onResources([...data.resources, ...data.referrals]);
      onProfileChange(updated);
      onPlanChange(data);
      setDraft(updated);
      setEditing(false);
      top.current?.scrollTo({ top: 0, behavior: "auto" });
    } catch (failure) {
      if (pending.current === controller)
        setError(
          failure.name === "AbortError"
            ? "Planning took too long. Please try again."
            : failure.message,
        );
    } finally {
      clearTimeout(timeout);
      if (pending.current === controller) setBusy(false);
    }
  }

  function recheckTravel(resourceId) {
    const value = travelTimes[resourceId];
    if (value === undefined || value === "") return;
    makePlan(null, {
      ...draft,
      travelOverrides: {
        ...draft.travelOverrides,
        [resourceId]: Number(value),
      },
    });
  }

  return (
    <div className="visit-planner" ref={top}>
      {editing ? (
        <form className="visit-form" onSubmit={makePlan}>
          <fieldset>
            <legend>What do you need?</legend>
            <div className="need-choices">
              {[
                ["food", "Food"],
                ["clothing", "Clothing"],
                ["hygiene", "Hygiene"],
                ["programs", "Programs"],
              ].map(([need, label]) => (
                <label
                  key={need}
                  className={draft.needs.includes(need) ? "chosen" : ""}
                >
                  <input
                    type="checkbox"
                    checked={draft.needs.includes(need)}
                    onChange={() => toggleNeed(need)}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label>
            Starting area
            <input
              required
              maxLength={100}
              value={draft.location}
              onChange={(event) => change("location", event.target.value)}
              placeholder="City and state or country"
            />
          </label>
          <label>
            How will you travel?
            <select
              value={draft.transport}
              onChange={(event) => change("transport", event.target.value)}
            >
              <option value="walk">Walking</option>
              <option value="transit">Public transportation</option>
              <option value="car">Car</option>
              <option value="ride">Need a ride</option>
              <option value="unknown">Not sure yet</option>
            </select>
          </label>
          <label>
            Visit date
            <input
              type="date"
              required
              value={draft.date}
              onInput={(event) => change("date", event.target.value)}
            />
          </label>
          <div className="visit-time-row">
            <label>
              Available from
              <input
                type="time"
                required
                value={draft.startTime}
                onInput={(event) => change("startTime", event.target.value)}
              />
            </label>
            <label>
              Back by
              <input
                type="time"
                required
                value={draft.endTime}
                onInput={(event) => change("endTime", event.target.value)}
              />
            </label>
          </div>
          <label>
            Travel limit each way
            <select
              value={draft.maxTravelMinutes}
              onChange={(event) =>
                change("maxTravelMinutes", Number(event.target.value))
              }
            >
              {[15, 30, 45, 60, 90, 120, 180].map((minutes) => (
                <option value={minutes} key={minutes}>
                  {minutes} minutes
                </option>
              ))}
            </select>
          </label>
          <label className="visit-check">
            <input
              type="checkbox"
              checked={draft.stepFree}
              onChange={(event) => change("stepFree", event.target.checked)}
            />
            I need step-free access
          </label>
          <details className="visit-extra">
            <summary>More preferences</summary>
            <label>
              Time on site
              <select
                value={draft.visitMinutes}
                onChange={(event) =>
                  change("visitMinutes", Number(event.target.value))
                }
              >
                {[15, 20, 30, 45, 60].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes} minutes
                  </option>
                ))}
              </select>
            </label>
            <label className="visit-check">
              <input
                type="checkbox"
                checked={draft.includeSeniors}
                onChange={(event) =>
                  change("includeSeniors", event.target.checked)
                }
              />
              Include senior services
            </label>
            <label className="visit-check">
              <input
                type="checkbox"
                checked={draft.includeVeterans}
                onChange={(event) =>
                  change("includeVeterans", event.target.checked)
                }
              />
              Include veteran services
            </label>
            <label>
              Resource-area time zone
              <input
                list="planner-time-zones"
                value={draft.timeZone}
                onChange={(event) => change("timeZone", event.target.value)}
                placeholder="Automatic from the search area"
              />
            </label>
            <datalist id="planner-time-zones">
              {Intl.supportedValuesOf("timeZone").map((zone) => (
                <option key={zone} value={zone} />
              ))}
            </datalist>
          </details>
          <p className="planner-note">
            Travel estimates start at the search area centre. Public transport
            and rides need a route and travel time.
          </p>
          <button
            className="primary-button"
            disabled={busy || !draft.needs.length}
            aria-busy={busy}
            type="submit"
          >
            {busy ? "Planning…" : "Find a plan"}
          </button>
        </form>
      ) : (
        plan && (
          <div className="visit-results">
            <div className="visit-results-heading">
              <h2>Visit options</h2>
              <button
                className="text-button"
                disabled={busy}
                onClick={() => {
                  setEditing(true);
                  setError("");
                }}
              >
                Edit preferences
              </button>
            </div>
            <p>{plan.message}</p>
            <p className="planner-note">
              {plan.location}
              <br />
              {plan.profile.date} · {plan.profile.startTime}–
              {plan.profile.endTime} · {plan.timeZone}
              {plan.timeZoneEstimated ? " (estimated)" : ""}
            </p>
            {plan.options.map((option) => {
              const resource = plan.resources.find(
                (item) => item.id === option.resourceId,
              );
              if (!resource) return null;
              return (
                <article className="visit-option" key={resource.id}>
                  <div className="visit-option-heading">
                    <button
                      className="text-button"
                      onClick={() => onSelect(resource)}
                    >
                      <h3>{resource.name}</h3>
                    </button>
                    <SaveButton
                      resource={resource}
                      saved={savedIds.includes(resource.id)}
                      onToggle={onToggleSave}
                    />
                  </div>
                  <p className="visit-fit">
                    {option.fit === "confirm"
                      ? "Confirm before planning this visit"
                      : "Fits using the times shown"}
                  </p>
                  <ul className="visit-reasons">
                    {option.reasons.map((reason) => (
                      <li key={reason}>{reason}</li>
                    ))}
                  </ul>
                  <ol>
                    {option.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ol>
                  <div className="visit-links">
                    <a
                      className="text-button"
                      href={planDirections(resource, draft)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Directions
                    </a>
                    <button
                      className="text-button"
                      onClick={() => onSelect(resource)}
                    >
                      Resource details
                    </button>
                  </div>
                  <details>
                    <summary>
                      {option.cautions.length
                        ? "What to confirm"
                        : "Confirm details and travel"}
                    </summary>
                    {option.cautions.map((caution) => (
                      <p key={caution} className="planner-note">
                        {caution}
                      </p>
                    ))}
                    <div className="travel-override">
                      <label>
                        Longer one-way time (out or back)
                        <input
                          type="number"
                          min="0"
                          max="360"
                          step="1"
                          value={
                            travelTimes[resource.id] ??
                            draft.travelOverrides[resource.id] ??
                            ""
                          }
                          onChange={(event) =>
                            setTravelTimes((previous) => ({
                              ...previous,
                              [resource.id]: event.target.value,
                            }))
                          }
                        />
                      </label>
                      <button
                        className="secondary-button"
                        disabled={
                          busy ||
                          travelTimes[resource.id] === undefined ||
                          travelTimes[resource.id] === ""
                        }
                        onClick={() => recheckTravel(resource.id)}
                      >
                        Recheck
                      </button>
                    </div>
                  </details>
                </article>
              );
            })}
            {plan.referrals.length > 0 && (
              <div className="visit-referrals">
                <h3>Online directories</h3>
                {plan.referrals.map((resource) => (
                  <button
                    className="chat-listing"
                    key={resource.id}
                    onClick={() => onSelect(resource)}
                  >
                    <span className="chat-listing-copy">
                      <strong>{resource.name}</strong>
                      <span>{resource.serviceLabel}</span>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                ))}
              </div>
            )}
            {plan.unmetNeeds.length > 0 && (
              <p className="planner-note">
                No matching option for: {plan.unmetNeeds.join(", ")}. Try
                another time, travel method, or nearby area.
              </p>
            )}
            {plan.excluded.length > 0 && (
              <details className="visit-excluded">
                <summary>
                  Why other visits were left out ({plan.excludedCount})
                </summary>
                {plan.excluded.map((item) => (
                  <p key={item.id}>
                    <strong>{item.name}</strong>
                    <br />
                    {item.reason}
                  </p>
                ))}
              </details>
            )}
            {plan.directoryWarning && (
              <details className="visit-excluded">
                <summary>Directory coverage</summary>
                <p>{plan.directoryWarning}</p>
              </details>
            )}
            <p className="planner-note">{plan.note}</p>
            <button
              className="secondary-button"
              disabled={busy}
              onClick={onDiscuss}
            >
              Discuss this plan
            </button>
          </div>
        )
      )}
      {error && (
        <p className="notice" role="alert">
          {error}
        </p>
      )}
      {busy && !editing && <p role="status">Rechecking your visit…</p>}
    </div>
  );
}
