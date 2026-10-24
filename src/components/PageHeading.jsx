// Page headings share an alignment and type scale, not an extra panel.
export default function PageHeading({ title, children }) {
  return (
    <div className="page-heading">
      <h1>{title}</h1>
      {children && <div className="page-heading-aside">{children}</div>}
    </div>
  );
}
