// A rounded lowercase k with straight, balanced diagonal arms.
export default function BrandLogo() {
  return (
    <span className="brand-lockup">
      <svg className="brand-mark" viewBox="0 0 48 50" aria-hidden="true">
        <path
          d="M9 10C9 7.239 11.239 5 14 5C16.761 5 19 7.239 19 10V25L30.8 16.15C33.009 14.493 36.143 14.941 37.8 17.15C39.457 19.359 39.009 22.493 36.8 24.15L29 30L36.8 35.85C39.009 37.507 39.457 40.641 37.8 42.85C36.143 45.059 33.009 45.507 30.8 43.85L19 35V40C19 42.761 16.761 45 14 45C11.239 45 9 42.761 9 40Z"
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
