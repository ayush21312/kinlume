import EmptyState from "./EmptyState.jsx";
import LoadingIndicator from "./LoadingIndicator.jsx";
import { useEffect, useState } from "react";
import { readDonations } from "../utils/donations.js";
import { useAccount } from "./AccountProvider.jsx";
import AccountForm from "./AccountForm.jsx";
import OrganizationDashboard from "./OrganizationDashboard.jsx";
import SupplyRequestCard from "./SupplyRequestCard.jsx";

export default function DonateView() {
  const [hasDeviceRecords] = useState(() => {
    try {
      return Boolean(readDonations(localStorage).organization);
    } catch {
      return false;
    }
  });
  const community = useAccount();
  const { state, busy, error, loading } = community;
  const [mode, setMode] = useState(
      community.state.profile?.purpose === "organization"
        ? "organization"
        : "items",
    ),
    [category, setCategory] = useState("all"),
    [signingIn, setSigningIn] = useState(false),
    [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(""), 3500);
    return () => clearTimeout(timer);
  }, [message]);
  async function act(action, success) {
    setMessage("");
    const saved = await community.commit(action);
    if (saved) setMessage(success);
    return saved;
  }
  function switchMode(value) {
    setMode(value);
    setSigningIn(false);
    setMessage("");
  }
  function visibleRequest(request) {
    const hasMyPledge = state.pledges.some(
      (pledge) => pledge.requestId === request.id && pledge.mine,
    );
    return (
      (!request.closed || hasMyPledge) &&
      (category === "all" || request.category === category)
    );
  }
  return (
    <section className="donate-view">
      <div className="donate-heading">
        <h1>Donate</h1>
        {state.user && (
          <details className="account-menu">
            <summary>Account</summary>
            <div>
              <p>{state.user.email}</p>
              <button
                className="text-button"
                disabled={busy}
                onClick={async () => {
                  if (await community.logout()) {
                    setMessage("");
                    setSigningIn(false);
                  }
                }}
              >
                Sign out
              </button>
            </div>
          </details>
        )}
      </div>
      <div
        className="segmented-control"
        role="group"
        aria-label="Donation view"
      >
        <button
          aria-pressed={mode === "items"}
          onClick={() => switchMode("items")}
        >
          Donate items
        </button>
        <button
          aria-pressed={mode === "organization"}
          onClick={() => switchMode("organization")}
        >
          Organization
        </button>
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="form-success" role="status">
          {message}
        </p>
      )}
      {loading ? (
        <LoadingIndicator label="Loading requests…" />
      ) : signingIn || (mode === "organization" && !state.user) ? (
        <AccountForm
          authenticate={community.authenticate}
          busy={busy}
          onDone={() => setSigningIn(false)}
        />
      ) : mode === "organization" ? (
        <OrganizationDashboard state={state} busy={busy} onAction={act} />
      ) : (
        <>
          {state.requests.length > 0 && (
            <label className="supply-filter">
              <span className="sr-only">Filter requests</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
              >
                <option value="all">All items</option>
                <option value="food">Food</option>
                <option value="clothing">Clothing</option>
                <option value="hygiene">Hygiene</option>
                <option value="other">Other</option>
              </select>
            </label>
          )}
          <div className="supply-list">
            {state.requests.filter(visibleRequest).map((request) => (
              <SupplyRequestCard
                key={request.id}
                request={request}
                user={state.user}
                busy={busy}
                onAction={act}
                onSignIn={() => setSigningIn(true)}
                pledges={state.pledges.filter(
                  (pledge) => pledge.requestId === request.id && pledge.mine,
                )}
              />
            ))}
          </div>
          {!state.requests.some(visibleRequest) && (
            <EmptyState
              icon="donate"
              title="No requests right now"
              action="Add a supply request"
              onAction={() => switchMode("organization")}
            />
          )}
          <details className="giving-links">
            <summary>Other ways to give</summary>
            <a
              href="https://cfanj.org/donate-food/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Center for Food Action ↗
            </a>
            <a
              href="https://www.womensrights.org/wish-lists"
              target="_blank"
              rel="noopener noreferrer"
            >
              Women’s Rights Information Center ↗
            </a>
          </details>
        </>
      )}
      {hasDeviceRecords && state.user && !state.organization && (
        <section
          className="dashboard-about"
          aria-label="Import earlier records"
        >
          <p>
            Move your earlier device records into this account. The originals
            stay on this device.
          </p>
          <button
            className="secondary-button"
            disabled={busy}
            onClick={async () => {
              try {
                await act(
                  {
                    type: "import-device",
                    legacy: readDonations(localStorage),
                  },
                  "Device records imported.",
                );
              } catch {
                setMessage("Device records could not be read.");
              }
            }}
          >
            Import device records
          </button>
        </section>
      )}
    </section>
  );
}
