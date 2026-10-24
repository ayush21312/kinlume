// Small, consistent outline icons keep the interface quiet and dependency-free.
const paths = {
  location:
    "M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Zm-5.5 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0",
  back: "m14 5-7 7 7 7",
  chevron: "m9 5 7 7-7 7",
  "chevron-down": "m6 9 6 6 6-6",
  user: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2",
  programs: "M4 5h16v16H4V5Zm4-3v6m8-6v6M4 11h16m-12 4h3m2 0h3",
  gear: "M9 2h6l.5 2.5 1 .5L19 4l3 5-2 1.5v3L22 15l-3 5-2.5-1-1 .5L15 22H9l-.5-2.5-1-.5L5 20l-3-5 2-1.5v-3L2 9l3-5 2.5 1 1-.5L9 2ZM16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0",
  bookmark: "M6 3h12v19l-6-4-6 4V3Z",
  home: "m3 10 9-7 9 7M5 9v12h5v-7h4v7h5V9",
  search: "m21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0",
  map: "m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5Zm6-2v16m6-14v16",
  donate: "M12 21S2 15 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 7-10 13-10 13Z",
  assistant: "M4 4h16v12H9l-5 4V4Zm4 5h8m-8 3h5",
  settings: "M4 6h16M4 12h16M4 18h16M8 3v6m8 0v6M9 15v6",
  food: "M5 3v7m3-7v7m-6 0h9M6 10v11M18 3c-4 4-4 9 0 9V3Zm0 9v9",
  clothing: "m8 3-6 4 3 5 3-2v11h8V10l3 2 3-5-6-4a4 4 0 0 1-8 0Z",
  hygiene: "M8 7h8v14H8V7Zm0 5h8M12 7V3h6m-8 13h4",
  arrow: "M5 12h14m-5-5 5 5-5 5",
  pin: "M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 1 1 16 0ZM12 7v6m-3-3h6",
};

export default function Icon({ name, size = 22 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.home} />
    </svg>
  );
}
