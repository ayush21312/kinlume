// Match the real two-column cards so results can arrive without a layout jump.
export default function ResourceSkeleton() {
  return (
    <div className="resource-grid resource-skeletons" aria-hidden="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="resource-skeleton" key={index}>
          <div className="skeleton-photo skeleton-surface" />
          <div className="skeleton-line skeleton-surface" />
          <div className="skeleton-line skeleton-short skeleton-surface" />
          <div className="skeleton-line skeleton-town skeleton-surface" />
        </div>
      ))}
    </div>
  );
}
