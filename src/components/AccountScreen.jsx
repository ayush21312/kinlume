import BrandLogo from "./BrandLogo.jsx";
import LoadingIndicator from "./LoadingIndicator.jsx";
import AccountForm from "./AccountForm.jsx";
export function AccountLayout({ children }) {
  return (
    <div className="app-shell account-shell">
      <div className="app-scroll">
        <header className="app-header compact-header">
          <div className="header-top">
            <div className="brand">
              <span className="brand-name">
                <BrandLogo />
              </span>
            </div>
          </div>
        </header>
        <main className="page-content account-content">{children}</main>
      </div>
    </div>
  );
}
export default function AccountScreen({ account }) {
  return (
    <AccountLayout>
      <h1 className="sr-only">Account</h1>
      {account.loading ? (
        <div className="account-loading">
          <LoadingIndicator label="Loading your account…" />
        </div>
      ) : (
        <>
          {account.error && (
            <p className="form-error" role="alert">
              {account.error}
            </p>
          )}
          <AccountForm
            authenticate={account.authenticate}
            busy={account.busy}
          />
          <button
            className="text-button guest-link"
            onClick={account.browseAsGuest}
          >
            Continue without an account
          </button>
        </>
      )}
    </AccountLayout>
  );
}
