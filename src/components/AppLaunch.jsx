import BrandLogo from "./BrandLogo.jsx";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

// Run once when the app opens. Account changes and tab navigation do not replay it.
export default function AppLaunch({ ready, children }) {
  const root = useRef(null);
  const [phase, setPhase] = useState(() =>
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
      ? "done"
      : "waiting",
  );
  const [minimumElapsed, setMinimumElapsed] = useState(false);
  const [maximumElapsed, setMaximumElapsed] = useState(false);
  const [geometry, setGeometry] = useState(null);

  useLayoutEffect(() => {
    if (phase === "done") return;
    function measureHeader() {
      const frame = root.current?.querySelector(".app-shell");
      const title = root.current?.querySelector(".brand-name");
      if (!frame || !title) return;
      const box = frame.getBoundingClientRect();
      const destination = title.getBoundingClientRect();
      const font = getComputedStyle(title);
      // Measure the actual header so the moving title lands exactly on its text.
      setGeometry({
        left: box.left,
        top: box.top,
        width: box.width,
        height: box.height,
        borderRadius: getComputedStyle(frame).borderRadius,
        "--title-x": `${destination.left + destination.width / 2 - box.left - box.width / 2}px`,
        "--title-y": `${destination.top + destination.height / 2 - box.top - box.height / 2}px`,
        "--title-size": font.fontSize,
        "--title-weight": font.fontWeight,
        "--title-spacing": font.letterSpacing,
      });
    }
    measureHeader();
    window.addEventListener("resize", measureHeader);
    return () => window.removeEventListener("resize", measureHeader);
  }, [phase, ready]);

  useEffect(() => {
    const minimum = setTimeout(() => setMinimumElapsed(true), 700);
    // A slow connection must not trap people behind the opening screen.
    const maximum = setTimeout(() => setMaximumElapsed(true), 4000);
    return () => {
      clearTimeout(minimum);
      clearTimeout(maximum);
    };
  }, []);

  useEffect(() => {
    if (phase === "waiting" && minimumElapsed && (ready || maximumElapsed)) {
      setPhase("moving");
    }
    if (phase !== "moving") return;
    const finish = setTimeout(() => setPhase("done"), 720);
    return () => clearTimeout(finish);
  }, [phase, ready, minimumElapsed, maximumElapsed]);

  const running = phase !== "done";
  return (
    <div className="launch-root" ref={root} data-launch-phase={phase}>
      <div
        className="launch-content"
        inert={running}
        aria-hidden={running || undefined}
      >
        {children}
      </div>
      {running && (
        <div
          className={`launch-overlay launch-${phase}`}
          style={geometry || undefined}
          role="status"
        >
          <span className="sr-only">Loading Kinlume</span>
          <div className="launch-backdrop" aria-hidden="true" />
          <div className="launch-title" aria-hidden="true">
            <BrandLogo />
          </div>
          <div className="launch-loader" aria-hidden="true">
            <span />
          </div>
        </div>
      )}
    </div>
  );
}
