export default function ResourceEditor({
  resource,
  organization,
  busy,
  onSave,
  onCancel,
}) {
  const r = resource || {};
  return (
    <form
      className="dashboard-form editor-panel"
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        data.categories = new FormData(event.currentTarget).getAll(
          "categories",
        );
        data.published = data.published === "on";
        onSave({ ...data, type: "resource", id: r.id });
      }}
    >
      <h2>{r.id ? "Edit resource" : "New resource"}</h2>
      <label>
        Name
        <input
          name="name"
          defaultValue={r.name || organization.name}
          maxLength={120}
          required
        />
      </label>
      <fieldset>
        <legend>Services</legend>
        <div className="need-choices">
          {[
            ["food", "Food"],
            ["clothing", "Clothing"],
            ["hygiene", "Hygiene"],
            ["programs", "Programs"],
            ["opportunities", "Volunteering"],
          ].map(([value, label]) => (
            <label key={value}>
              <input
                type="checkbox"
                name="categories"
                value={value}
                defaultChecked={(r.categories || ["food"]).includes(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <label>
        Service name
        <input
          name="serviceLabel"
          defaultValue={r.serviceLabel || ""}
          placeholder="e.g. Food pantry"
          required
          maxLength={120}
        />
      </label>
      <label>
        Address
        <input
          name="address"
          defaultValue={r.address || ""}
          required
          maxLength={300}
        />
      </label>
      <div className="supply-form-row">
        <label>
          City
          <input
            name="city"
            defaultValue={r.city || organization.city}
            required
            maxLength={120}
          />
        </label>
        <label>
          Country
          <input
            name="country"
            defaultValue={r.country || "United States"}
            required
            maxLength={80}
          />
        </label>
      </div>
      <label>
        Service hours
        <textarea
          spellCheck={true}
          autoCorrect="on"
          autoCapitalize="sentences"
          name="hours"
          defaultValue={r.hours || ""}
          rows={3}
          maxLength={1000}
          placeholder="e.g. Mon–Fri 9:00 AM–5:00 PM"
        />
      </label>
      <label>
        Eligibility
        <textarea
          spellCheck={true}
          autoCorrect="on"
          autoCapitalize="sentences"
          name="eligibility"
          defaultValue={r.eligibility || ""}
          rows={2}
          maxLength={1000}
        />
      </label>
      <details className="editor-details">
        <summary>Contact and access</summary>
        <label>
          Phone
          <input
            name="phone"
            type="tel"
            defaultValue={r.phone || organization.phone || ""}
            maxLength={80}
          />
        </label>
        <label>
          Website
          <input
            name="website"
            type="url"
            defaultValue={r.website || organization.website || ""}
            maxLength={400}
          />
        </label>
        <label>
          Appointments
          <input
            name="appointment"
            defaultValue={r.appointment || ""}
            maxLength={500}
          />
        </label>
        <label>
          Accessibility
          <input
            name="accessibility"
            defaultValue={r.accessibility || ""}
            maxLength={500}
          />
        </label>
        <label>
          Description
          <textarea
            spellCheck={true}
            autoCorrect="on"
            autoCapitalize="sentences"
            name="description"
            defaultValue={r.description || ""}
            rows={3}
            maxLength={1000}
          />
        </label>
      </details>
      <details className="editor-details">
        <summary>Map position</summary>
        <p className="field-hint">
          Optional. Add exact coordinates to show a map pin.
        </p>
        <div className="supply-form-row">
          <label>
            Latitude
            <input
              name="latitude"
              type="number"
              step="any"
              min={-90}
              max={90}
              defaultValue={r.coordinates?.lat ?? ""}
            />
          </label>
          <label>
            Longitude
            <input
              name="longitude"
              type="number"
              step="any"
              min={-180}
              max={180}
              defaultValue={r.coordinates?.lng ?? ""}
            />
          </label>
        </div>
      </details>
      <label className="dashboard-check">
        <input
          name="published"
          type="checkbox"
          defaultChecked={r.published === true}
        />
        Show in resource searches
      </label>
      <div className="editor-actions">
        <button className="primary-button" disabled={busy}>
          Save resource
        </button>
        <button
          type="button"
          className="text-button"
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
