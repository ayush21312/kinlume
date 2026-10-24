import { useEffect, useState } from "react";

// The browser decides when installation is available. Never show a fake prompt.
export default function useAppInstall() {
  const [prompt, setPrompt] = useState(null);
  useEffect(() => {
    function available(event) {
      event.preventDefault();
      setPrompt(event);
    }
    function installed() {
      setPrompt(null);
    }
    window.addEventListener("beforeinstallprompt", available);
    window.addEventListener("appinstalled", installed);
    return () => {
      window.removeEventListener("beforeinstallprompt", available);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  async function install() {
    if (!prompt) return;
    // Installation requires a direct user click and remains the user's choice.
    setPrompt(null);
    try {
      await prompt.prompt();
    } catch {
      /* Browser installation is optional. */
    }
  }
  return { canInstall: Boolean(prompt), install };
}
