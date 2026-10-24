export default function ProgramFilters({ program, onChange }) {
  return (
    <label className="program-filter">
      <span className="sr-only">Program type</span>
      <select
        aria-label="Program type"
        value={program}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="community">Community support</option>
        <option value="all">All programs</option>
        <option value="wic">WIC</option>
        <option value="health">Health centers</option>
        <option value="school">School meals</option>
        <option value="summer">Summer meals</option>
        <option value="benefits">SNAP & benefits</option>
        <option value="energy">Utility help</option>
        <option value="employment">Job training</option>
      </select>
    </label>
  );
}
