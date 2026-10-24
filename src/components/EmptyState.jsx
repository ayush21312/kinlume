import Icon from "./Icon.jsx";

export default function EmptyState({
  icon = "search",
  title,
  action,
  onAction,
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">
        <Icon name={icon} size={26} />
      </div>
      <h2>{title}</h2>
      {action && (
        <button className="secondary-button" onClick={onAction}>
          {action}
        </button>
      )}
    </div>
  );
}
