import { useCallback, useState } from "react";
import Icon from "./Icon.jsx";
import ResourceImage from "./ResourceImage.jsx";
import SaveButton from "./SaveButton.jsx";
import { directionsUrl, phoneUrl } from "../utils/resourceLinks.js";

export default function ResourceDetail({
  resource,
  onBack,
  onSettings,
  saved,
  onToggleSave,
}) {
  const [photo, setPhoto] = useState(resource.image);
  const rememberPhoto = useCallback((image) => setPhoto(image), []);
  return (
    <section className="resource-detail">
      <div className="detail-header">
        <button className="back-button" aria-label="Back" onClick={onBack}>
          <Icon name="back" size={22} />
        </button>
        <span>Resource details</span>
        <button
          className="detail-settings"
          aria-label="Settings"
          onClick={onSettings}
        >
          <Icon name="gear" size={22} />
        </button>
      </div>
      <ResourceImage
        resource={resource}
        className="detail-photo"
        onPhoto={rememberPhoto}
      />
      <div className="detail-title">
        <p className="detail-service">
          {resource.serviceLabel} · {resource.city}
        </p>
        <h1>{resource.name}</h1>
      </div>
      <p className="muted">{resource.description}</p>
      <div className="resource-actions">
        <SaveButton resource={resource} saved={saved} onToggle={onToggleSave} />
        {resource.phone && (
          <a className="primary-button" href={phoneUrl(resource.phone)}>
            Call
          </a>
        )}
        <a
          className="secondary-button"
          href={directionsUrl(resource)}
          target="_blank"
          rel="noopener noreferrer"
        >
          Directions
        </a>
      </div>
      <dl>
        <dt>Address</dt>
        <dd>{resource.address}</dd>
        <dt>Service hours</dt>
        <dd>{resource.hours}</dd>
        <dt>Eligibility</dt>
        <dd>{resource.eligibility}</dd>
        <dt>Appointments</dt>
        <dd>{resource.appointment}</dd>
        <dt>Accessibility</dt>
        <dd>{resource.accessibility}</dd>
        <dt>Contact</dt>
        <dd>
          {resource.phone && (
            <a href={phoneUrl(resource.phone)}>{resource.phone}</a>
          )}
          {resource.email && (
            <>
              <br />
              <a href={`mailto:${resource.email}`}>{resource.email}</a>
            </>
          )}
          {resource.website && (
            <>
              <br />
              <a
                href={resource.website}
                target="_blank"
                rel="noopener noreferrer"
              >
                Organization website
              </a>
            </>
          )}
        </dd>
      </dl>
      {resource.applyUrl && (
        <a
          className="primary-button"
          href={resource.applyUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {resource.actionLabel || "Apply on the official website"}
        </a>
      )}
      {resource.notes?.length > 0 && (
        <ul className="source-notes">
          {resource.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      )}
      <details className="source-info">
        <summary>Sources & photo credits</summary>
        {photo?.kind && photo.kind !== "stock" && (
          <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer">
            Photo: {photo.credit}
          </a>
        )}
        {photo?.license && (
          <p>
            <a
              href={photo.licenseUrl || photo.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              {photo.license}
            </a>
          </p>
        )}
        {photo?.caption && <p>{photo.caption}</p>}
        {resource.providerVerifiedAt && (
          <p>Provider’s last verification: {resource.providerVerifiedAt}</p>
        )}
        <a href={resource.sourceUrl} target="_blank" rel="noopener noreferrer">
          Source: {resource.sourceName}
        </a>
        <p>
          {resource.providerId ? "Directory retrieved" : "Source reviewed"}{" "}
          {resource.sourceCheckedAt}. Confirm hours and supplies before
          visiting.
        </p>
      </details>
    </section>
  );
}
