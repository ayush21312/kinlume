// The parent owns the state. These callbacks tell it when a filter changes.
export default function ResourceFilters({
  search,
  category,
  onSearchChange,
  onCategoryChange,
  onClear,
}) {
  return (
    <form role="search" onSubmit={(event) => event.preventDefault()}>
      <label htmlFor="resource-search">
        Search by name or city
        <input
          id="resource-search"
          type="search"
          placeholder="Try Example City"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
        />
      </label>
      <label htmlFor="resource-category">
        Resource type
        <select
          id="resource-category"
          value={category}
          onChange={(event) => onCategoryChange(event.target.value)}
        >
          <option value="all">All essentials</option>
          <option value="food">Food</option>
          <option value="clothing">Clothing</option>
          <option value="hygiene">Hygiene</option>
        </select>
      </label>
      <button type="button" onClick={onClear}>
        Clear filters
      </button>
    </form>
  );
}
