import Icon from './Icon.jsx';

export default function SaveButton({
  resource,
  saved,
  onToggle,
  className = '',
}) {
  return (
    <button
      type="button"
      className={`save-button ${className}`}
      aria-label={`${saved ? 'Unsave' : 'Save'} ${resource.name}`}
      aria-pressed={saved}
      onClick={() => onToggle(resource.id)}
    >
      <Icon name="bookmark" size={19} />
      <span className="sr-only">{saved ? 'Saved' : 'Save'}</span>
    </button>
  );
}
