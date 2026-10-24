import { useEffect, useState } from "react";
import {
  DONATION_STORAGE_KEY,
  emptyDonations,
  readDonations,
  changeDonations,
} from "../utils/donations.js";

export default function useDonations() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState(emptyDonations);
  useEffect(() => {
    function refresh() {
      try {
        setState(readDonations(localStorage));
        setError("");
      } catch {
        setError(
          "Saved donations could not be loaded. Your existing data has not been changed.",
        );
      }
    }
    refresh();
    function onStorage(event) {
      if (event.key === DONATION_STORAGE_KEY || event.key === null) refresh();
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function commit(action) {
    setBusy(true);
    setError("");
    try {
      function write() {
        // Read the latest saved state before each change, including changes in another tab.
        const next = changeDonations(readDonations(localStorage), action);
        localStorage.setItem(DONATION_STORAGE_KEY, JSON.stringify(next));
        setState(next); // Show success only after storage succeeds.
      }
      if (navigator.locks)
        await navigator.locks.request(DONATION_STORAGE_KEY, write);
      else write();
      return true;
    } catch (failure) {
      setError(
        failure instanceof SyntaxError
          ? "Saved donations could not be read. Your data has not been changed."
          : failure.message,
      );
      return false;
    } finally {
      setBusy(false);
    }
  }
  return { state, commit, error, busy };
}
