function normalize(text) {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\bpantries\b/g, 'pantry');
}

export function filterResources(resources, search, category) {
  const words = normalize(search).trim().split(/\s+/).filter(Boolean);

  return resources.filter((resource) => {
    const services = resource.categories || [resource.category];
    const aliases = services.includes('clothing') ? 'clothes' : '';
    const searchableText = normalize(
      [
        resource.name,
        resource.organization,
        resource.city,
        resource.address,
        resource.description,
        resource.serviceLabel,
        ...services,
        aliases,
      ]
        .filter(Boolean)
        .join(' '),
    );

    // Every word must match, so "food Hackensack" combines need and city.
    const matchesSearch = words.every((word) => searchableText.includes(word));
    const matchesCategory = category === 'all' || services.includes(category);
    return matchesSearch && matchesCategory;
  });
}
