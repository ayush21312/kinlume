// One shared loading treatment, with a readable label for screen readers.
export default function LoadingIndicator({ label = "Loading…", dots = false }) {
  return (
    <div
      className={`loading-indicator${dots ? " loading-dots" : ""}`}
      role="status"
    >
      <span className="loading-symbol" aria-hidden="true">
        {dots && (
          <>
            <i />
            <i />
            <i />
          </>
        )}
      </span>
      <span>{label}</span>
    </div>
  );
}
