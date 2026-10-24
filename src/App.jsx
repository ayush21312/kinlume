import useAppInstall from "./hooks/useAppInstall.js";
import ConnectionStatus from "./components/ConnectionStatus.jsx";
import { suggestSearchQuery } from "./utils/searchSpelling.js";
import BrandLogo from "./components/BrandLogo.jsx";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useAccount } from "./components/AccountProvider.jsx";
import AccountScreen from "./components/AccountScreen.jsx";
import PersonalSurvey from "./components/PersonalSurvey.jsx";
import LoadingIndicator from "./components/LoadingIndicator.jsx";
import BottomNav from "./components/BottomNav.jsx";
import HomeView from "./components/HomeView.jsx";
import ResourceDetail from "./components/ResourceDetail.jsx";
import MapView from "./components/MapView.jsx";
import AssistantView from "./components/AssistantView.jsx";
import DonateView from "./components/DonateView.jsx";
import SettingsView from "./components/SettingsView.jsx";
import SavedView from "./components/SavedView.jsx";
import Icon from "./components/Icon.jsx";
import { resources as initialResources } from "./data/resources.js";
import useResourceSearch from "./hooks/useResourceSearch.js";
import LocationSearch from "./components/LocationSearch.jsx";
import ProgramFilters from "./components/ProgramFilters.jsx";
import { filterResources } from "./utils/filterResources.js";

import { cleanSavedIds, toggleSavedId } from "./utils/savedResources.js";

function readSavedValue(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const account = useAccount();
  const appInstall = useAppInstall();
  const person = account.state.profile;
  const [page, setPage] = useState(
    person && person.purpose !== "help" ? "donate" : "home",
  );
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [selectedResource, setSelectedResource] = useState(null);
  const directory = useResourceSearch(initialResources, category);
  const resources = directory.catalog;
  const [savedIds, setSavedIds] = useState(() =>
    cleanSavedIds(readSavedValue("helping-hand-saved", []), resources),
  );
  const [messages, setMessages] = useState([]);
  // The saved survey seeds the visit plan; individual visit dates remain in this session.
  const [assistantMode, setAssistantMode] = useState("chat");
  const [plannerProfile, setPlannerProfile] = useState(null);
  const [visitPlan, setVisitPlan] = useState(null);
  const [largeText, setLargeText] = useState(
    () => readSavedValue("helping-hand-large-text", false) === true,
  );
  const [storageMessage, setStorageMessage] = useState("");

  // Only the phone's content scrolls. Navigation stays at the bottom of it.
  const scrollArea = useRef(null);
  // Reset the page after React changes it, before the browser paints.
  // Navigation itself never scrolls or changes height between screens.
  useLayoutEffect(() => {
    scrollArea.current?.scrollTo({ top: 0, behavior: "auto" });
  }, [page, selectedResource]);
  // City names are part of the same search as resource names.
  const matchingResources = useMemo(
    () => filterResources(directory.results, search, category),
    [directory.results, search, category],
  );

  useEffect(() => {
    if (!person) return;
    if (person.purpose === "help") {
      directory.setLocation(person.location);
      setCategory(person.needs.length === 1 ? person.needs[0] : "all");
      const nextDay = new Date();
      nextDay.setDate(nextDay.getDate() + 1);
      const date = [
        nextDay.getFullYear(),
        String(nextDay.getMonth() + 1).padStart(2, "0"),
        String(nextDay.getDate()).padStart(2, "0"),
      ].join("-");
      setPlannerProfile({
        needs: person.needs,
        location: person.location,
        transport: person.transport,
        maxTravelMinutes: person.maxTravelMinutes,
        startTime: person.startTime,
        endTime: person.endTime,
        stepFree: person.stepFree,
        date,
        visitMinutes: 20,
        includeSeniors: false,
        includeVeterans: false,
        timeZone: "",
        travelOverrides: {},
      });
      setVisitPlan(null);
    } else {
      setPlannerProfile(null);
      setVisitPlan(null);
      setPage("donate");
    }
  }, [person?.updatedAt]);

  function saveValue(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      setStorageMessage("Changes cannot be saved in this browser.");
    }
  }

  function navigate(destination) {
    setPage(destination);
    setSelectedResource(null);
    setShowFilters(false);
    scrollArea.current?.scrollTo({ top: 0 });
  }

  function selectResource(resource) {
    setSelectedResource(resource);
    scrollArea.current?.scrollTo({ top: 0 });
  }

  function toggleSave(id) {
    const next = toggleSavedId(savedIds, id);
    setSavedIds(next);
    saveValue("helping-hand-saved", next);
    saveValue(
      "helping-hand-saved-records",
      resources.filter((resource) => next.includes(resource.id)),
    );
  }

  const searchControls = (
    <>
      {category === "programs" && (
        <ProgramFilters
          program={directory.program}
          onChange={directory.setProgram}
        />
      )}
      {(directory.loading || directory.status) && (
        <div
          className="directory-status"
          role={directory.loading ? undefined : "status"}
        >
          {directory.loading ? (
            <LoadingIndicator label="Finding resources…" />
          ) : directory.status.length > 100 ? (
            <details>
              <summary>Some listing details are unavailable</summary>
              <p>{directory.status}</p>
            </details>
          ) : (
            directory.status
          )}
          {!directory.loading && directory.canRetry && (
            <>
              {" "}
              <button className="text-button" onClick={directory.retrySearch}>
                Retry
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  if (account.loading || (!account.state.user && account.showSignIn))
    return <AccountScreen account={account} />;
  if (account.state.user && (!person || account.editingProfile))
    return <PersonalSurvey account={account} />;

  return (
    <div
      className={`app-shell${largeText ? " large-text" : ""}${page === "map" && !selectedResource ? " map-screen" : ""}${page === "assistant" && !selectedResource ? " chat-screen" : ""}`}
    >
      <div className="app-scroll" ref={scrollArea}>
        {!selectedResource && (
          <header
            className={`app-header ${page === "home" ? "" : "compact-header"}`}
          >
            <div className="header-top">
              <button className="brand" onClick={() => navigate("home")}>
                <span className="brand-name">
                  <BrandLogo />
                </span>
              </button>
              <button
                type="button"
                className="header-settings"
                aria-label="Settings"
                title="Settings"
                aria-current={page === "settings" ? "page" : undefined}
                onClick={() => navigate("settings")}
              >
                <Icon name="gear" size={22} />
              </button>
            </div>
            {(page === "home" || page === "map") && (
              <>
                <div className="search-row">
                  <form
                    className="search-form"
                    role="search"
                    onSubmit={(event) => event.preventDefault()}
                  >
                    <Icon name="search" size={20} />
                    <input
                      aria-label="Search resources or programs"
                      type="search"
                      spellCheck={true}
                      autoCorrect="on"
                      enterKeyHint="search"
                      placeholder="Search resources or programs"
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                    />
                    {search && (
                      <button
                        type="button"
                        aria-label="Clear search"
                        onClick={() => setSearch("")}
                      >
                        ×
                      </button>
                    )}
                  </form>
                  <button
                    className="filter-button"
                    aria-label="Filter resources"
                    aria-expanded={showFilters}
                    aria-controls="extra-filters"
                    onClick={() => setShowFilters(!showFilters)}
                  >
                    <Icon name="settings" />
                  </button>
                </div>
                <LocationSearch
                  location={directory.location}
                  resolvedLocation={directory.resolvedLocation}
                  onChange={directory.setLocation}
                />
              </>
            )}
          </header>
        )}
        <main
          key={selectedResource ? `resource-${selectedResource.id}` : page}
          className={
            page === "home" && !selectedResource
              ? "home-content"
              : "page-content"
          }
        >
          <ConnectionStatus />
          {storageMessage && (
            <p role="status" className="notice">
              {storageMessage}
            </p>
          )}
          {!selectedResource && page === "map" && searchControls}
          {selectedResource ? (
            <ResourceDetail
              resource={selectedResource}
              onSettings={() => navigate("settings")}
              saved={savedIds.includes(selectedResource.id)}
              onToggleSave={toggleSave}
              onBack={() => {
                setSelectedResource(null);
                scrollArea.current?.scrollTo({ top: 0 });
              }}
            />
          ) : (
            <>
              {page === "home" && (
                <HomeView
                  sourceCredit={
                    directory.countryCode && directory.countryCode !== "US" ? (
                      <>
                        Data:{" "}
                        <a
                          href="https://www.openstreetmap.org/copyright"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          © OpenStreetMap contributors
                        </a>
                        {directory.countryCode === "GB" && (
                          <>
                            {" "}
                            ·{" "}
                            <a
                              href="https://www.givefood.org.uk/"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              Give Food
                            </a>
                          </>
                        )}
                      </>
                    ) : null
                  }
                  searchControls={searchControls}
                  spellingSuggestion={suggestSearchQuery(search)}
                  onApplySpelling={setSearch}
                  loading={directory.loading}
                  searchFailed={directory.failed}
                  resources={matchingResources}
                  category={category}
                  onCategoryChange={setCategory}
                  showFilters={showFilters}
                  onSelect={selectResource}
                  savedIds={savedIds}
                  onToggleSave={toggleSave}
                  onAssistant={() => navigate("assistant")}
                  onClear={() => {
                    setSearch("");
                    setCategory("all");
                    directory.setProgram("all");
                  }}
                />
              )}
              {page === "map" && (
                <MapView
                  loading={directory.loading}
                  searchFailed={directory.failed}
                  center={directory.center}
                  resources={matchingResources}
                  category={category}
                  onCategoryChange={setCategory}
                  showFilters={showFilters}
                  onClear={() => {
                    setSearch("");
                    setCategory("all");
                    directory.setProgram("all");
                  }}
                  onSelect={selectResource}
                  savedIds={savedIds}
                  onToggleSave={toggleSave}
                />
              )}
              {page === "donate" && <DonateView />}
              {page === "assistant" && (
                <AssistantView
                  mode={assistantMode}
                  onModeChange={setAssistantMode}
                  plannerProfile={plannerProfile}
                  onPlannerProfileChange={setPlannerProfile}
                  visitPlan={visitPlan}
                  onVisitPlanChange={setVisitPlan}
                  resources={resources}
                  location={directory.location}
                  onResources={directory.addToCatalog}
                  messages={messages}
                  onMessagesChange={setMessages}
                  onSelect={selectResource}
                  savedIds={savedIds}
                  onToggleSave={toggleSave}
                />
              )}
              {page === "saved" && (
                <SavedView
                  resources={resources.filter((resource) =>
                    savedIds.includes(resource.id),
                  )}
                  onSelect={selectResource}
                  onToggleSave={toggleSave}
                  onBrowse={() => navigate("home")}
                />
              )}
              {page === "settings" && (
                <SettingsView
                  appInstall={appInstall}
                  account={account}
                  largeText={largeText}
                  onLargeTextChange={(value) => {
                    setLargeText(value);
                    saveValue("helping-hand-large-text", value);
                  }}
                />
              )}
            </>
          )}
        </main>
      </div>
      <BottomNav page={page} onNavigate={navigate} />
    </div>
  );
}
