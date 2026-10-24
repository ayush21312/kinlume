import { useEffect, useState } from "react";
const empty = {
  user: null,
  profile: null,
  organization: null,
  resources: [],
  requests: [],
  pledges: [],
};
export default function useCommunity() {
  const [state, setState] = useState(empty),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/community", {
      signal: controller.signal,
      credentials: "same-origin",
    })
      .then(async (response) => {
        if (!response.ok) throw new Error("Could not load your dashboard.");
        return response.json();
      })
      .then(setState)
      .catch((failure) => {
        if (failure.name !== "AbortError")
          setError("Could not load donations. Refresh to try again.");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, []);
  async function send(route, body) {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/community/" + route, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Could not save this change.");
      setState(data);
      if (
        route === "action" &&
        ["resource", "organization", "import-device"].includes(body.action.type)
      )
        window.dispatchEvent(new Event("community-updated"));
      return true;
    } catch (failure) {
      setError(
        failure.name === "TypeError"
          ? "Connection lost. Your changes have not been saved."
          : failure.message,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return {
    state,
    error,
    busy,
    loading,
    commit: (action) => send("action", { action }),
    authenticate: (details, register) =>
      send(register ? "register" : "login", details),
    logout: () => send("logout", {}),
    saveProfile: (profile) => send("profile", { profile }),
  };
}
