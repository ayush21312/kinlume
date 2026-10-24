import { categories } from "../data/categories.js";

export default function CategoryFilters({
  category,
  onCategoryChange,
  showFilters,
  onClear,
}) {
  return (
    <>
      {showFilters && (
        <div id="extra-filters" className="filter-panel">
          <label>
            Resource type
            <select
              value={category}
              onChange={(event) => onCategoryChange(event.target.value)}
            >
              {categories.map(({ id, label }) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button className="text-button" onClick={onClear}>
            Reset filters
          </button>
        </div>
      )}
      <div
        className="category-tabs"
        role="group"
        aria-label="Resource categories"
      >
        {categories.map(({ id, label }) => (
          <button
            type="button"
            key={id}
            aria-pressed={category === id}
            onClick={() => onCategoryChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}
