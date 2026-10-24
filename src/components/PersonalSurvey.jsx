import LegalLinks from "./LegalLinks.jsx";
import { useState, useRef, useLayoutEffect } from "react";
import { AccountLayout } from "./AccountScreen.jsx";
import {
  purposes,
  personalNeeds,
  circumstances,
  householdSizes,
  travelModes,
} from "../data/profileOptions.js";

export default function PersonalSurvey({ account }) {
  const saved = account.state.profile;
  const [step, setStep] = useState(0),
    [error, setError] = useState("");
  const [draft, setDraft] = useState(() => ({
    purpose: "help",
    preferredName: "",
    needs: [],
    location: "",
    circumstances: [],
    householdSize: "unknown",
    transport: "unknown",
    maxTravelMinutes: 30,
    startTime: "09:00",
    endTime: "17:00",
    stepFree: false,
    notes: "",
    aiConsent: false,
    ...saved,
  }));
  const form = useRef(null);
  useLayoutEffect(() => {
    form.current
      ?.closest(".app-scroll")
      ?.scrollTo({ top: 0, behavior: "auto" });
  }, [step]);
  function change(key, value) {
    setDraft((previous) => ({ ...previous, [key]: value }));
    setError("");
  }
  function toggle(key, value) {
    change(
      key,
      draft[key].includes(value)
        ? draft[key].filter((item) => item !== value)
        : [...draft[key], value],
    );
  }
  const isHelp = draft.purpose === "help",
    last = !isHelp || step === 2;
  async function next(event) {
    event.preventDefault();
    if (step === 0 && isHelp && !draft.needs.length) {
      setError("Choose at least one type of help.");
      return;
    }
    if (step === 2 && draft.endTime <= draft.startTime) {
      setError("Choose an end time later than the start time.");
      return;
    }
    if (last) await account.saveProfile(draft);
    else setStep((value) => value + 1);
  }
  return (
    <AccountLayout>
      <div className="survey-heading">
        <h1>{saved ? "Your preferences" : "Set up your account"}</h1>
        {isHelp && (
          <>
            <span>Step {step + 1} of 3</span>
            <div className="survey-progress" aria-hidden="true">
              {[0, 1, 2].map((index) => (
                <span key={index} data-complete={index <= step} />
              ))}
            </div>
          </>
        )}
      </div>
      <form
        key={`${step}-${draft.purpose}`}
        ref={form}
        className="dashboard-form survey-form"
        onSubmit={next}
      >
        {(error || account.error) && (
          <p className="form-error" role="alert">
            {error || account.error}
          </p>
        )}
        {step === 0 && (
          <>
            <fieldset>
              <legend>How will you use Kinlume?</legend>
              <div className="survey-options">
                {purposes.map(([value, label]) => (
                  <label
                    className={draft.purpose === value ? "chosen" : ""}
                    key={value}
                  >
                    <input
                      type="radio"
                      name="purpose"
                      value={value}
                      checked={draft.purpose === value}
                      onChange={() => change("purpose", value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <label>
              Preferred name <span className="optional-label">Optional</span>
              <input
                autoComplete="given-name"
                value={draft.preferredName}
                maxLength={60}
                onChange={(event) =>
                  change("preferredName", event.target.value)
                }
              />
            </label>
            {isHelp && (
              <fieldset>
                <legend>What do you need help with?</legend>
                <div className="survey-options">
                  {personalNeeds.map(([value, label]) => (
                    <label
                      className={draft.needs.includes(value) ? "chosen" : ""}
                      key={value}
                    >
                      <input
                        type="checkbox"
                        checked={draft.needs.includes(value)}
                        onChange={() => toggle("needs", value)}
                      />
                      {label}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        )}
        {step === 1 && (
          <>
            <label>
              City or postal code
              <input
                required
                autoComplete="address-level2"
                placeholder="City, state or country"
                value={draft.location}
                maxLength={100}
                onChange={(event) => change("location", event.target.value)}
              />
            </label>
            <label>
              Who are you finding help for?
              <select
                value={draft.householdSize}
                onChange={(event) =>
                  change("householdSize", event.target.value)
                }
              >
                {householdSizes.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>
                What is making things difficult?{" "}
                <span className="optional-label">Optional</span>
              </legend>
              <div className="survey-options">
                {circumstances.map(([value, label]) => (
                  <label
                    className={
                      draft.circumstances.includes(value) ? "chosen" : ""
                    }
                    key={value}
                  >
                    <input
                      type="checkbox"
                      checked={draft.circumstances.includes(value)}
                      onChange={() => toggle("circumstances", value)}
                    />
                    {label}
                  </label>
                ))}
              </div>
            </fieldset>
            <details className="editor-details">
              <summary>Anything else to remember?</summary>
              <label>
                Private notes
                <textarea
                  spellCheck={true}
                  autoCorrect="on"
                  autoCapitalize="sentences"
                  value={draft.notes}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => change("notes", event.target.value)}
                />
              </label>
              <p className="field-hint">
                Optional. Leave out identity, banking and medical details. These
                notes are not sent to AI.
              </p>
            </details>
          </>
        )}
        {step === 2 && (
          <>
            <label>
              How do you travel?
              <select
                value={draft.transport}
                onChange={(event) => change("transport", event.target.value)}
              >
                {travelModes.map(([value, label]) => (
                  <option value={value} key={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Travel limit each way
              <select
                value={draft.maxTravelMinutes}
                onChange={(event) =>
                  change("maxTravelMinutes", Number(event.target.value))
                }
              >
                {[15, 30, 45, 60, 90, 120, 180].map((value) => (
                  <option key={value} value={value}>
                    {value} minutes
                  </option>
                ))}
              </select>
            </label>
            <div className="supply-form-row">
              <label>
                Usually available from
                <input
                  type="time"
                  required
                  value={draft.startTime}
                  onInput={(event) => change("startTime", event.target.value)}
                />
              </label>
              <label>
                Usually back by
                <input
                  type="time"
                  required
                  value={draft.endTime}
                  onInput={(event) => change("endTime", event.target.value)}
                />
              </label>
            </div>
            <label className="dashboard-check">
              <input
                type="checkbox"
                checked={draft.stepFree}
                onChange={(event) => change("stepFree", event.target.checked)}
              />
              I need step-free access
            </label>
            <div className="survey-ai">
              <label className="dashboard-check">
                <input
                  type="checkbox"
                  checked={draft.aiConsent}
                  onChange={(event) =>
                    change("aiConsent", event.target.checked)
                  }
                />
                Personalize AI replies with my saved preferences
              </label>
              <p>
                Shares your needs, area, travel and access preferences,
                household range and selected challenges with Groq. Your name,
                email and private notes are excluded.
              </p>
            </div>
          </>
        )}
        <div className="survey-actions">
          {step > 0 && (
            <button
              type="button"
              className="secondary-button"
              disabled={account.busy}
              onClick={() => setStep((value) => value - 1)}
            >
              Back
            </button>
          )}
          <button
            className="primary-button"
            disabled={account.busy}
            aria-busy={account.busy}
          >
            {account.busy ? "Saving…" : last ? "Save and continue" : "Continue"}
          </button>
        </div>
        <p className="survey-privacy">
          Saved privately to your account. Organizations cannot see these
          answers.
        </p>
      </form>
      {saved ? (
        <button
          className="text-button"
          onClick={account.cancelProfileEdit}
          disabled={account.busy}
        >
          Cancel changes
        </button>
      ) : (
        <button
          className="text-button"
          onClick={account.logout}
          disabled={account.busy}
        >
          Sign out
        </button>
      )}
      <LegalLinks />
    </AccountLayout>
  );
}
