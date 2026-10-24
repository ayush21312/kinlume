import { useEffect, useRef, useState } from "react";

export default function ResourceImage({
  resource,
  className,
  decorative = false,
  onPhoto,
}) {
  const element = useRef(null);
  const [photo, setPhoto] = useState(resource.image);
  const [failed, setFailed] = useState(false);
  const [loadedSource, setLoadedSource] = useState("");
  const fallback = `/images/${resource.category === "opportunities" ? "programs" : resource.category}.jpg`;

  useEffect(() => {
    setPhoto(resource.image);
    setFailed(false);
    if (resource.image?.kind !== "stock" || resource.coverage === "US") return;
    const controller = new AbortController();
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      observer.disconnect();
      fetch(`/api/photos/${encodeURIComponent(resource.id)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => {
          if (data?.photo) {
            setPhoto(data.photo);
            onPhoto?.(data.photo);
          }
        })
        .catch(() => {}); // A failed photo lookup must not block access to help.
    });
    if (element.current) observer.observe(element.current);
    return () => {
      observer.disconnect();
      controller.abort();
    };
  }, [resource.id, resource.image, resource.coverage, onPhoto]);

  const source = (!failed && photo?.src) || fallback;
  return (
    <img
      ref={element}
      className={`${className || ""} resource-image${loadedSource === source ? " is-loaded" : ""}`}
      src={source}
      onLoad={() => setLoadedSource(source)}
      alt={
        decorative
          ? ""
          : (!failed && photo?.alt) || "Illustrative resource image"
      }
      style={{ objectPosition: photo?.position || "center" }}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
