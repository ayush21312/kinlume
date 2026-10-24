import LegalLinks from "./LegalLinks.jsx";
import PageHeading from "./PageHeading.jsx";
import Icon from "./Icon.jsx";

export default function SettingsView({
  account,
  appInstall,
  largeText,
  onLargeTextChange,
}) {
  return (
    <section className="settings-view">
      <PageHeading title="Settings" />
      <section className="settings-section">
        <h2>Account</h2>
        <div className="settings-account">
          <div className="settings-avatar">
            <Icon name="user" size={24} />
          </div>
          <div className="settings-identity">
            <h3>{account.state.profile?.preferredName || "Your account"}</h3>
            {account.state.user && <p>{account.state.user.email}</p>}
          </div>
        </div>
        {account.state.user ? (
          <div className="settings-actions">
            <button className="settings-link" onClick={account.editProfile}>
              <span>Edit preferences</span>
              <Icon name="chevron" size={18} />
            </button>
            <button
              className="settings-link"
              onClick={account.logout}
              disabled={account.busy}
            >
              <span>Sign out</span>
              <Icon name="arrow" size={18} />
            </button>
          </div>
        ) : (
          <button className="primary-button" onClick={account.startSignIn}>
            Sign in or create an account
          </button>
        )}
      </section>
      <section className="settings-section">
        <h2>Appearance</h2>
        <label className="setting-row">
          <span>Larger text</span>
          <input
            type="checkbox"
            className="toggle-input"
            checked={largeText}
            onChange={(event) => onLargeTextChange(event.target.checked)}
          />
        </label>
      </section>
      {appInstall?.canInstall && (
        <section className="settings-section">
          <button className="secondary-button" onClick={appInstall.install}>
            Install Kinlume
          </button>
        </section>
      )}
      <details className="about">
        <summary>About the listings</summary>
        <p>
          Listings combine Feed America search results with sourced local
          records and official program directories. Each detail page links to
          its source and review date. Organizations have not been verified as
          app partners.
        </p>
        <p>
          The map uses OpenStreetMap. Resource photo credits and location notes
          are in the details. Some listings still use stock photos.
        </p>
        <p>
          Saved resources stay on this device. Organization profiles, resources,
          donation requests, and pledges are saved on the app server. Chats stay
          in this browser session. Searches use connected directory providers.
          Your survey is private to your account. Saved preferences are
          automatically sent to Groq only when you opt in; your name, email, and
          private notes are excluded. Chat messages and visit preferences you
          explicitly discuss are sent to Groq. Each account can manage only its
          own organization. Organization verification and email recovery are not
          connected yet.
        </p>
      </details>
      <LegalLinks />
    </section>
  );
}
