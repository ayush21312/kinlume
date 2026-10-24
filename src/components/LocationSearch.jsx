import { useState } from "react";
import Icon from "./Icon.jsx";

export default function LocationSearch({
  location,
  resolvedLocation,
  onChange,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(location);
  if (!editing)
    return (
      <button
        className="location-button"
        aria-label="Change city or country"
        onClick={() => {
          setDraft(location);
          setEditing(true);
        }}
      >
        <Icon name="location" size={16} />
        <span>Near {resolvedLocation || location}</span>
        <Icon name="chevron-down" size={16} />
      </button>
    );
  return (
    <form
      className="location-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (draft.trim()) {
          onChange(draft.trim());
          setEditing(false);
        }
      }}
    >
      <input
        aria-label="City and country or postal code"
        maxLength={100}
        autoComplete="address-level2"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="City, country (e.g. London, UK)"
        autoFocus
        required
      />
      <button type="submit">Search</button>
      <button
        type="button"
        aria-label="Cancel location change"
        onClick={() => setEditing(false)}
      >
        ×
      </button>
    </form>
  );
}
