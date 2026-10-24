import { useEffect, useRef, useState } from "react";

function storedSavedResources() {
  try {
    const records = JSON.parse(
      localStorage.getItem("helping-hand-saved-records"),
    );
    return Array.isArray(records)
      ? records
          .filter(
            (record) =>
              typeof record?.id === "string" &&
              typeof record.name === "string" &&
              Array.isArray(record.categories),
          )
          .slice(0, 100)
      : [];
  } catch {
    return [];
  }
}

export default function useResourceSearch(initialResources, category) {
  const [location, updateLocation] = useState(() => {
    try {
      return localStorage.getItem("helping-hand-location") || "Hackensack, NJ";
    } catch {
      return "Hackensack, NJ";
    }
  });
  const [center, setCenter] = useState(null);
  const [countryCode, setCountryCode] = useState(null);
  const [resolvedLocation, setResolvedLocation] = useState("");
  const [program, setProgram] = useState("all");
  const [results, setResults] = useState([]);
  const [catalog, setCatalog] = useState(() => [
    ...initialResources,
    ...storedSavedResources(),
  ]);
  const [status, setStatus] = useState("");
  const [failed, setFailed] = useState(false);
  const [canRetry, setCanRetry] = useState(false);
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  // Exact search keys prevent cached results from one city appearing in another.
  const successfulSearches = useRef(new Map());

  useEffect(() => {
    function refreshOrganizations() {
      successfulSearches.current.clear();
      setRetry((value) => value + 1);
    }
    window.addEventListener("community-updated", refreshOrganizations);
    return () =>
      window.removeEventListener("community-updated", refreshOrganizations);
  }, []);

  function setLocation(value) {
    updateLocation(value);
    try {
      localStorage.setItem("helping-hand-location", value);
    } catch {
      /* Search still works without storage. */
    }
  }

  function addToCatalog(records) {
    setCatalog((previous) => [
      ...new Map(
        [...previous, ...records].map((resource) => [resource.id, resource]),
      ).values(),
    ]);
  }

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ location, category, program });
    const key = params.toString();
    const previous = successfulSearches.current.get(key);
    function show(data) {
      setResults(data?.resources || []);
      setCenter(data?.center || null);
      setCountryCode(data?.countryCode || null);
      setResolvedLocation(data?.resolvedLocation || "");
    }
    setLoading(true);
    setFailed(false);
    setCanRetry(false);
    setStatus("");
    show(previous);
    fetch(`/api/resources?${params}`, { signal: controller.signal })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) {
          const error = new Error(
            data.error || "Resource search is temporarily unavailable.",
          );
          error.retryable = response.status >= 500 || response.status === 429;
          throw error;
        }
        if (!Array.isArray(data.resources))
          throw new Error("The directory returned an incomplete response.");
        return data;
      })
      .then((data) => {
        // Aborted requests may already have finished reading their response.
        // Check again before letting an older city replace the new search.
        if (controller.signal.aborted) return;
        successfulSearches.current.set(key, data);
        if (successfulSearches.current.size > 20)
          successfulSearches.current.delete(
            successfulSearches.current.keys().next().value,
          );
        show(data);
        addToCatalog(data.resources);
        setStatus(data.warning || "");
        setFailed(data.unavailable === true && !data.resources.length);
        setCanRetry(data.retryable === true);
      })
      .catch((error) => {
        if (controller.signal.aborted) return;
        setCanRetry(error.retryable !== false);
        if (previous) {
          show(previous);
          setStatus(
            "Could not refresh. Showing results from earlier in this session.",
          );
        } else {
          show(null);
          setFailed(true);
          setStatus(
            error.message || "Resource search is temporarily unavailable.",
          );
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [location, category, program, retry, initialResources]);

  return {
    location,
    center,
    countryCode,
    resolvedLocation,
    setLocation,
    program,
    setProgram,
    results,
    catalog,
    addToCatalog,
    status,
    failed,
    canRetry,
    loading,
    retrySearch: () => setRetry((value) => value + 1),
  };
}
