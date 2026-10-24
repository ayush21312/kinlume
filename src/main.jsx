import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import AppLaunch from "./components/AppLaunch.jsx";
import { AccountProvider, useAccount } from "./components/AccountProvider.jsx";
import "./design-system.css";
import "./motion.css";
import "./launch.css";

function AccountApp() {
  const account = useAccount();
  // Changing account discards the previous person's in-memory chat and visit plan.
  return (
    <AppLaunch ready={!account.loading}>
      <App key={account.state.user?.email || "guest"} />
    </AppLaunch>
  );
}
// Confirmation links may contain tokens. This app uses server cookies instead,
// so discard unused link tokens before they can linger in history/screenshots.
const linkTokens = new URLSearchParams(window.location.hash.slice(1));
if (linkTokens.has("access_token") || linkTokens.has("refresh_token")) {
  window.history.replaceState(
    null,
    "",
    window.location.pathname + window.location.search,
  );
}
// Mount the React component tree inside index.html's root element.
createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AccountProvider>
      <AccountApp />
    </AccountProvider>
  </StrictMode>,
);
