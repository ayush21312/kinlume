// One filled, rounded K is shared by the header and opening animation.
export default function BrandLogo() {
  return (
    <span className="brand-lockup">
      <svg className="brand-mark" viewBox="0 0 48 48" aria-hidden="true">
        <path
          d="M13 7Q9 7 9 11V37Q9 41 13 41H15Q19 41 19 37V30L23 26L31 38Q34 42 38 39Q41 37 38 33L29 20L37 13Q41 10 38 7Q35 4 32 7L19 20V11Q19 7 15 7Z"
          fill="currentColor"
          stroke="#10100f"
          strokeWidth="2"
          strokeLinejoin="round"
        />
      </svg>
      <span>Kinlume</span>
    </span>
  );
}
