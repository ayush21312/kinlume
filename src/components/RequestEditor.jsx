export default function RequestEditor({ request, busy, onSave, onCancel }) {
  const r = request || {},
    locked =
      (r.totals?.pledged || 0) + (r.totals?.received || 0) > 0 || r.hasHistory;
  return (
    <form
      className="dashboard-form editor-panel"
      onSubmit={(event) => {
        event.preventDefault();
        const data = Object.fromEntries(new FormData(event.currentTarget));
        onSave({
          ...data,
          item: locked ? r.item : data.item,
          unit: locked ? r.unit : data.unit,
          category: locked ? r.category : data.category,
          type: r.id ? "edit-request" : "request",
          id: r.id,
        });
      }}
    >
      <h2>{r.id ? "Edit request" : "New request"}</h2>
      <label>
        Item
        <input
          name="item"
          defaultValue={r.item || ""}
          maxLength={120}
          required
          readOnly={locked}
        />
      </label>
      <label>
        Category
        <select
          name="category"
          defaultValue={r.category || "food"}
          disabled={locked}
        >
          <option value="food">Food</option>
          <option value="clothing">Clothing</option>
          <option value="hygiene">Hygiene</option>
          <option value="other">Other</option>
        </select>
      </label>
      <div className="supply-form-row">
        <label>
          Quantity needed
          <input
            name="quantity"
            type="number"
            min={Math.max(
              1,
              (r.totals?.pledged || 0) + (r.totals?.received || 0),
            )}
            max={1000000}
            step={1}
            defaultValue={r.quantity || ""}
            required
          />
        </label>
        <label>
          Unit
          <input
            name="unit"
            defaultValue={r.unit || ""}
            maxLength={40}
            required
            readOnly={locked}
            placeholder="e.g. cans"
          />
        </label>
      </div>
      {locked && (
        <p className="field-hint">
          The item stays fixed once it has pledge history.
        </p>
      )}
      <div className="editor-actions">
        <button className="primary-button" disabled={busy}>
          Save request
        </button>
        <button
          type="button"
          className="text-button"
          disabled={busy}
          onClick={onCancel}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
