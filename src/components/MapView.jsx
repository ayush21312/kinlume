import { useEffect, useMemo, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import CategoryFilters from './CategoryFilters.jsx';
import SaveButton from './SaveButton.jsx';
import { hasCoordinates } from '../utils/resourceLinks.js';

const tileUrl =
  import.meta.env.VITE_MAP_TILE_URL ||
  'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
const attribution =
  import.meta.env.VITE_MAP_ATTRIBUTION ||
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export default function MapView({
  resources,
  loading,
  searchFailed,
  center,
  category,
  onCategoryChange,
  showFilters,
  onClear,
  onSelect,
  savedIds,
  onToggleSave,
}) {
  const container = useRef(null);
  const map = useRef(null);
  const markers = useRef(null);
  const userMarker = useRef(null);
  const [selectedId, setSelectedId] = useState(null);
  const [savedOnly, setSavedOnly] = useState(false);
  const [mapMessage, setMapMessage] = useState('');
  const visibleResources = useMemo(
    () =>
      resources.filter(
        (resource) =>
          hasCoordinates(resource) &&
          (!savedOnly || savedIds.includes(resource.id)),
      ),
    [resources, savedOnly, savedIds],
  );
  const selected = visibleResources.find(
    (resource) => resource.id === selectedId,
  );

  useEffect(() => {
    const instance = L.map(container.current, {
      scrollWheelZoom: false,
    }).setView([40.95, -74.05], 10);
    map.current = instance;
    const tiles = L.tileLayer(tileUrl, { attribution, maxZoom: 19 }).addTo(
      instance,
    );
    tiles.on('tileerror', () =>
      setMapMessage('Map background unavailable. Try again when connected.'),
    );
    tiles.on('load', () => setMapMessage(''));
    markers.current = L.layerGroup().addTo(instance);
    const resize = new ResizeObserver(() => instance.invalidateSize());
    resize.observe(container.current);
    return () => {
      resize.disconnect();
      instance.remove();
      map.current = null;
      markers.current = null;
      userMarker.current = null;
    };
  }, []);

  useEffect(() => {
    if (!map.current || !markers.current) return;
    markers.current.clearLayers();
    for (const resource of visibleResources) {
      const point = [resource.coordinates.lat, resource.coordinates.lng];
      const marker = L.marker(point, {
        title: resource.name,
        alt: resource.name,
        icon: L.divIcon({
          className: `resource-marker${savedIds.includes(resource.id) ? ' saved-marker' : ''}`,
          html: '<span></span>',
          iconSize: [26, 32],
          iconAnchor: [13, 30],
        }),
      });
      const label = document.createElement('span');
      label.textContent = resource.name;
      marker
        .bindTooltip(label)
        .on('click', () => setSelectedId(resource.id))
        .addTo(markers.current);
    }
  }, [visibleResources, savedIds]);

  // Saving a place should not move the map. Reframe only when search/filter changes.
  useEffect(() => {
    const points = resources
      .filter(hasCoordinates)
      .map((resource) => [resource.coordinates.lat, resource.coordinates.lng]);
    if (points.length)
      map.current?.fitBounds(points, { padding: [32, 32], maxZoom: 14 });
  }, [resources]);

  useEffect(() => {
    if (center && !resources.some(hasCoordinates)) {
      map.current?.setView([center.lat, center.lng], 12);
    }
  }, [center, resources]);

  function showMyLocation() {
    if (!navigator.geolocation) {
      setMapMessage(
        'Location is not available in this browser. Search for a town instead.',
      );
      return;
    }
    setMapMessage('Finding your location…');
    // Location is requested only when this button is pressed. It is not saved.
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (!map.current) return;
        const point = [coords.latitude, coords.longitude];
        userMarker.current?.remove();
        userMarker.current = L.circleMarker(point, {
          radius: 7,
          color: '#fff',
          fillColor: '#356ba6',
          fillOpacity: 1,
          weight: 3,
        }).addTo(map.current);
        map.current.setView(point, 13);
        setMapMessage('');
      },
      () => setMapMessage('Location unavailable. Search for a town instead.'),
      { timeout: 10000, maximumAge: 60000 },
    );
  }

  return (
    <section className="map-view" aria-label="Resource map">
      <div className="map-filters">
        <CategoryFilters
          category={category}
          onCategoryChange={onCategoryChange}
          showFilters={showFilters}
          onClear={onClear}
        />
      </div>
      <div className="map-canvas">
        <div
          ref={container}
          className="real-map"
          aria-label="Nearby resource map"
        />
        <div className="map-tools">
          <button
            className="map-tool"
            aria-pressed={savedOnly}
            onClick={() => setSavedOnly(!savedOnly)}
          >
            Saved
          </button>
          <button className="map-tool" onClick={showMyLocation}>
            Near me
          </button>
        </div>
        {!visibleResources.length &&
          !loading &&
          !searchFailed &&
          !mapMessage && (
            <div className="map-notice" role="status">
              {savedOnly
                ? 'No saved pins match. All saved places are in the Saved tab.'
                : 'No pins match this search.'}
            </div>
          )}
        {mapMessage && (
          <p className="map-notice" role="status">
            {mapMessage}
          </p>
        )}
        {selected && (
          <article className="map-place">
            <button
              className="map-place-close"
              aria-label="Close selected place"
              onClick={() => setSelectedId(null)}
            >
              ×
            </button>
            <h2>{selected.name}</h2>
            <p>{selected.city}</p>
            <div className="map-place-actions">
              <button
                className="text-button"
                onClick={() => onSelect(selected)}
              >
                View details
              </button>
              <SaveButton
                resource={selected}
                saved={savedIds.includes(selected.id)}
                onToggle={onToggleSave}
              />
            </div>
          </article>
        )}
      </div>
      <p className="sr-only" role="status">
        {visibleResources.length} mapped resources. Use the Home tab for the
        full accessible resource list, including listings without map
        coordinates.
      </p>
    </section>
  );
}
