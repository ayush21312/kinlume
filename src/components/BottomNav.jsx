import Icon from "./Icon.jsx";

const destinations = [
  { id: "home", label: "Home" },
  { id: "map", label: "Map" },
  { id: "donate", label: "Donate" },
  { id: "assistant", label: "Assistant" },
  { id: "saved", label: "Saved" },
];

export default function BottomNav({ page, onNavigate }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {destinations.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          aria-label={label}
          title={label}
          aria-current={page === id ? "page" : undefined}
          onClick={() => onNavigate(id)}
        >
          <Icon name={id === "saved" ? "bookmark" : id} />
          <span className="nav-label">{label}</span>
        </button>
      ))}
    </nav>
  );
}
