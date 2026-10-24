export function directionsUrl(resource) {
  // Pass the published address, so directions can resolve the actual entrance.
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(resource.address)}`;
}

export function phoneUrl(phone) {
  return `tel:${phone.replace(/[^\d+]/g, '')}`;
}

export function hasCoordinates(resource) {
  const coordinates = resource.coordinates;
  return Boolean(
    coordinates &&
    Number.isFinite(coordinates.lat) &&
    Number.isFinite(coordinates.lng) &&
    coordinates.lat >= -90 &&
    coordinates.lat <= 90 &&
    coordinates.lng >= -180 &&
    coordinates.lng <= 180 &&
    (coordinates.lat !== 0 || coordinates.lng !== 0),
  );
}
