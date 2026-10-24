import ResourceCard from "./ResourceCard.jsx";
import PageHeading from "./PageHeading.jsx";
import EmptyState from "./EmptyState.jsx";

export default function SavedView({
  resources,
  onSelect,
  onToggleSave,
  onBrowse,
}) {
  return (
    <section>
      <PageHeading title="Saved">
        {resources.length > 0 &&
          `${resources.length} ${resources.length === 1 ? "place" : "places"}`}
      </PageHeading>
      {resources.length ? (
        <div className="resource-grid saved-grid">
          {resources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onSelect={onSelect}
              saved
              onToggleSave={onToggleSave}
            />
          ))}
        </div>
      ) : (
        <EmptyState
          icon="bookmark"
          title="No saved places yet"
          action="Browse resources"
          onAction={onBrowse}
        />
      )}
    </section>
  );
}
