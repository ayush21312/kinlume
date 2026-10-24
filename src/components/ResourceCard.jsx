import Icon from "./Icon.jsx";
import ResourceImage from "./ResourceImage.jsx";
import SaveButton from "./SaveButton.jsx";

export default function ResourceCard({
  resource,
  onSelect,
  saved = false,
  onToggleSave,
}) {
  return (
    <article className="resource-card">
      <div className="card-image-area">
        <button
          className="card-photo"
          aria-label={`View ${resource.name}`}
          onClick={() => onSelect(resource)}
        >
          <ResourceImage resource={resource} decorative />
        </button>
        {onToggleSave && (
          <SaveButton
            resource={resource}
            saved={saved}
            onToggle={onToggleSave}
          />
        )}
      </div>
      <div className="resource-body">
        <p className="resource-service">{resource.serviceLabel}</p>
        <h2>
          <button
            className="resource-title"
            title={resource.name}
            onClick={() => onSelect(resource)}
          >
            {resource.name}
          </button>
        </h2>
        <div className="card-bottom">
          <span>
            <Icon name="location" size={14} />
            {resource.city}
          </span>
          <button
            type="button"
            className="card-open"
            aria-label={`Details for ${resource.name}`}
            onClick={() => onSelect(resource)}
          >
            <Icon name="arrow" size={19} />
          </button>
        </div>
      </div>
    </article>
  );
}
