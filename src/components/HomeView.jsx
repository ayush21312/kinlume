import ResourceSkeleton from "./ResourceSkeleton.jsx";
import ResourceCard from "./ResourceCard.jsx";
import CategoryFilters from "./CategoryFilters.jsx";
import PageHeading from "./PageHeading.jsx";
import EmptyState from "./EmptyState.jsx";

export default function HomeView({
  resources,
  sourceCredit,
  spellingSuggestion,
  onApplySpelling,
  searchControls,
  loading,
  searchFailed,
  category,
  onCategoryChange,
  showFilters,
  onSelect,
  onAssistant,
  onClear,
  savedIds,
  onToggleSave,
}) {
  return (
    <section aria-label="Home">
      <PageHeading title="Resources">
        {!loading &&
          !searchFailed &&
          `${resources.length} ${resources.length === 1 ? "result" : "results"}`}
      </PageHeading>
      <CategoryFilters
        category={category}
        onCategoryChange={onCategoryChange}
        showFilters={showFilters}
        onClear={onClear}
      />
      {searchControls}
      {spellingSuggestion && (
        <button
          className="spelling-suggestion"
          onClick={() => onApplySpelling(spellingSuggestion)}
        >
          Search for “{spellingSuggestion}”
        </button>
      )}
      <p className="sr-only" role="status">
        {loading ? "" : `${resources.length} matching resources`}
      </p>
      {loading && resources.length === 0 ? (
        <ResourceSkeleton />
      ) : (
        <div className="resource-grid">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onSelect={onSelect}
              saved={savedIds.includes(resource.id)}
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      )}
      {resources.length === 0 && !loading && !searchFailed && (
        <EmptyState
          title="No resources found"
          action="Clear filters"
          onAction={onClear}
        />
      )}
      {sourceCredit && (
        <footer className="directory-credit">{sourceCredit}</footer>
      )}
    </section>
  );
}
