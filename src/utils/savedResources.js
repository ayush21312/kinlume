// Store IDs only. Listing details always come from the current resource file.
export function cleanSavedIds(value, resources) {
  if (!Array.isArray(value)) return [];
  const knownIds = new Set(resources.map((resource) => resource.id));
  return [...new Set(value.filter((id) => knownIds.has(id)))];
}

export function toggleSavedId(ids, id) {
  return ids.includes(id)
    ? ids.filter((savedId) => savedId !== id)
    : [...ids, id];
}
