import LegalLinks from "./LegalLinks.jsx";
import { useState } from "react";
export default function AccountForm({ authenticate, busy, onDone }) {
  const [register, setRegister] = useState(false);
  return (
    <section className="account-panel">
      <h2>{register ? "Create an account" : "Sign in"}</h2>
      <form
        className="dashboard-form"
        onSubmit={async (event) => {
          event.preventDefault();
          const form = event.currentTarget;
          if (
            await authenticate(Object.fromEntries(new FormData(form)), register)
          ) {
            form.reset();
            onDone?.();
          }
        }}
      >
        <label>
          Email
          <input
            name="email"
            type="email"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            required
            maxLength={254}
          />
        </label>
        <label>
          Password
          <input
            name="password"
            type="password"
            spellCheck={false}
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete={register ? "new-password" : "current-password"}
            aria-describedby={register ? "password-hint" : undefined}
            minLength={12}
            maxLength={128}
            required
          />
        </label>
        {register && (
          <p id="password-hint" className="field-hint">
            At least 12 characters
          </p>
        )}
        <button className="primary-button" disabled={busy} aria-busy={busy}>
          {busy ? "Please wait…" : register ? "Create account" : "Sign in"}
        </button>
      </form>
      <button
        className="text-button"
        disabled={busy}
        onClick={() => setRegister(!register)}
      >
        {register ? "Already have an account? Sign in" : "Create an account"}
      </button>
      <LegalLinks />
    </section>
  );
}
