import { useCallback, useEffect, useMemo, useState } from "react";

function resolveMapTone(themeName) {
  // Always use light theme for maps regardless of app theme
  return "light";
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 38.5,
  minLon: 68,
  maxLon: 97.5,
};

const INDIA_VIEWBOX = `${INDIA_BOUNDS.minLon},${INDIA_BOUNDS.maxLat},${INDIA_BOUNDS.maxLon},${INDIA_BOUNDS.minLat}`;

function clampToIndia(point) {
  return {
    lat: clamp(point.lat, INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat),
    lon: clamp(point.lon, INDIA_BOUNDS.minLon, INDIA_BOUNDS.maxLon),
  };
}

function isInIndia(lat, lon) {
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lon >= INDIA_BOUNDS.minLon &&
    lon <= INDIA_BOUNDS.maxLon
  );
}

function getBbox(lat, lon, zoom) {
  const bounded = clampToIndia({ lat, lon });
  const boundedLat = bounded.lat;
  const boundedLon = bounded.lon;
  const lngDelta = 360 / Math.pow(2, zoom + 1);
  const latDelta = lngDelta * 0.62;
  const minLon = clamp(boundedLon - lngDelta, INDIA_BOUNDS.minLon, INDIA_BOUNDS.maxLon);
  const maxLon = clamp(boundedLon + lngDelta, INDIA_BOUNDS.minLon, INDIA_BOUNDS.maxLon);
  const minLat = clamp(boundedLat - latDelta, INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat);
  const maxLat = clamp(boundedLat + latDelta, INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat);
  return [minLon, minLat, maxLon, maxLat];
}

function toShortLabel(displayName) {
  if (!displayName) {
    return "India";
  }
  const parts = displayName.split(",").map((item) => item.trim());
  return parts.slice(0, 2).join(", ");
}

function toPhotonLabel(feature) {
  const properties = feature?.properties || {};
  const chunks = [properties.name, properties.city, properties.state, properties.country]
    .map((part) => (typeof part === "string" ? part.trim() : ""))
    .filter(Boolean);
  if (chunks.length === 0) {
    return "India";
  }
  return chunks.slice(0, 2).join(", ");
}

function buildStreetViewUrl(lat, lon) {
  return `https://maps.google.com/maps?q=${encodeURIComponent(`${lat},${lon}`)}&layer=c&cbll=${encodeURIComponent(
    `${lat},${lon}`
  )}&cbp=11,0,0,0,0&output=svembed`;
}

export default function LiveMapPanel({
  title = "Live map",
  defaultCenter = { lat: 21.774, lon: 78.257 },
  defaultZoom = 6,
  defaultLocationLabel = "Multai, India",
  labels = {},
  className = "",
}) {
  const copy = {
    searchPlaceholder: "Search or type pickup location",
    useMyLocation: "Use My Location",
    mapView: "Map",
    recenter: "Recenter",
    streetView: "Street View",
    locateFailed: "Location access failed.",
    searchFailed: "Unable to search this location.",
    indiaOnly: "Only India locations are supported on this map.",
    yourLocation: "Your location",
    ...labels,
  };

  const defaultLat = Number(defaultCenter?.lat ?? 21.774);
  const defaultLon = Number(defaultCenter?.lon ?? 78.257);

  const defaultIndiaCenter = useMemo(
    () => clampToIndia({ lat: defaultLat, lon: defaultLon }),
    [defaultLat, defaultLon]
  );
  const normalizedDefaultZoom = useMemo(() => clamp(defaultZoom, 5, 14), [defaultZoom]);

  const [searchQuery, setSearchQuery] = useState("");
  const [center, setCenter] = useState(defaultIndiaCenter);
  const [zoom, setZoom] = useState(normalizedDefaultZoom);
  const [locationLabel, setLocationLabel] = useState(defaultLocationLabel);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [viewMode, setViewMode] = useState("map");
  const [streetViewPoint, setStreetViewPoint] = useState(defaultIndiaCenter);
  const [mapTone, setMapTone] = useState(() => resolveMapTone(document.documentElement.dataset.theme));

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setMapTone(resolveMapTone(document.documentElement.dataset.theme));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const mapIframeSrc = useMemo(() => {
    const [minLon, minLat, maxLon, maxLat] = getBbox(center.lat, center.lon, zoom);
    return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${center.lat}%2C${center.lon}`;
  }, [center.lat, center.lon, zoom]);
  const streetViewSrc = useMemo(
    () => buildStreetViewUrl(streetViewPoint.lat, streetViewPoint.lon),
    [streetViewPoint.lat, streetViewPoint.lon]
  );
  const iframeSrc = viewMode === "street" ? streetViewSrc : mapIframeSrc;

  const handleSearch = async () => {
    const query = searchQuery.trim();
    if (!query) {
      return;
    }
    setError("");
    setLoading(true);
    try {
      let lat = NaN;
      let lon = NaN;
      let resolvedLabel = "";

      try {
        const nominatimResponse = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&countrycodes=in&bounded=1&viewbox=${INDIA_VIEWBOX}&q=${encodeURIComponent(query)}&limit=1`
        );
        if (nominatimResponse.ok) {
          const nominatimData = await nominatimResponse.json();
          if (Array.isArray(nominatimData) && nominatimData.length > 0) {
            const result = nominatimData[0];
            lat = Number(result.lat);
            lon = Number(result.lon);
            resolvedLabel = toShortLabel(result.display_name);
          }
        }
      } catch {
        // Fallback handled below.
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        const photonResponse = await fetch(
          `https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`
        );
        if (!photonResponse.ok) {
          setError(copy.searchFailed);
          return;
        }
        const photonData = await photonResponse.json();
        const feature = Array.isArray(photonData?.features) ? photonData.features[0] : null;
        const location = feature?.geometry?.coordinates;
        if (!Array.isArray(location) || location.length < 2) {
          setError(copy.searchFailed);
          return;
        }
        lon = Number(location[0]);
        lat = Number(location[1]);
        resolvedLabel = toPhotonLabel(feature);
      }

      if (!Number.isFinite(lat) || !Number.isFinite(lon) || !isInIndia(lat, lon)) {
        setError(copy.indiaOnly);
        return;
      }

      const bounded = clampToIndia({ lat, lon });
      setCenter(bounded);
      setStreetViewPoint(bounded);
      setLocationLabel(resolvedLabel || `${bounded.lat.toFixed(3)}, ${bounded.lon.toFixed(3)}`);
      setZoom(12);
      setViewMode("map");
    } catch {
      setError(copy.searchFailed);
    } finally {
      setLoading(false);
    }
  };

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError(copy.locateFailed);
      return;
    }

    setError("");
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        if (!isInIndia(lat, lon)) {
          setLoading(false);
          setError(copy.indiaOnly);
          setCenter(defaultIndiaCenter);
          setZoom(normalizedDefaultZoom);
          setLocationLabel(defaultLocationLabel);
          return;
        }

        setCenter(clampToIndia({ lat, lon }));
        setStreetViewPoint(clampToIndia({ lat, lon }));
        setZoom(13);
        setViewMode("map");

        try {
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16`
          );
          const data = await response.json();
          setLocationLabel(toShortLabel(data?.display_name) || copy.yourLocation);
        } catch {
          setLocationLabel(copy.yourLocation);
        } finally {
          setLoading(false);
        }
      },
      () => {
        setLoading(false);
        setError(copy.locateFailed);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }, [copy.indiaOnly, copy.locateFailed, copy.yourLocation, defaultIndiaCenter, defaultLocationLabel, normalizedDefaultZoom]);

  useEffect(() => {
    requestCurrentLocation();
  }, [requestCurrentLocation]);

  const handleUseMyLocation = () => {
    requestCurrentLocation();
  };

  const handleRecenter = () => {
    setError("");
    setSearchQuery("");
    setCenter(defaultIndiaCenter);
    setStreetViewPoint(defaultIndiaCenter);
    setZoom(normalizedDefaultZoom);
    setLocationLabel(defaultLocationLabel);
    setViewMode("map");
  };

  const zoomIn = () => setZoom((previous) => clamp(previous + 1, 5, 14));
  const zoomOut = () => setZoom((previous) => clamp(previous - 1, 5, 14));
  const handleStreetView = () => {
    setError("");
    setStreetViewPoint(center);
    setViewMode("street");
  };
  const handleMapView = () => setViewMode("map");

  return (
    <section className={`glass-panel card-rise live-map-shell live-map-shell--${mapTone} p-4 sm:p-6 ${className}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="live-map-shell__eyebrow text-xs font-semibold uppercase tracking-[0.2em]">Explore coverage</p>
          <h3 className="live-map-shell__title mt-2 text-2xl font-bold">{title}</h3>
        </div>
        <div className="live-map-shell__location inline-flex items-center rounded-full border px-3 py-2 text-sm font-semibold">
          {locationLabel}
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 xl:flex-row">
        <input
          type="text"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              handleSearch();
            }
          }}
          placeholder={copy.searchPlaceholder}
          className="live-map-shell__search w-full rounded-2xl border px-4 py-3 outline-none transition"
        />
        <div className="grid shrink-0 grid-cols-4 gap-2 sm:flex sm:flex-wrap">
          <button type="button" className="live-map-shell__control live-map-shell__control--primary" onClick={handleUseMyLocation} disabled={loading} aria-label={copy.useMyLocation} title={copy.useMyLocation}>
            <span aria-hidden="true">◎</span>
          </button>
          <button type="button" className="live-map-shell__control" onClick={handleMapView} aria-label={copy.mapView} title={copy.mapView}>
            <span aria-hidden="true">M</span>
          </button>
          <button type="button" className="live-map-shell__control" onClick={handleStreetView} aria-label={copy.streetView} title={copy.streetView}>
            <span aria-hidden="true">S</span>
          </button>
          <button type="button" className="live-map-shell__control" onClick={handleRecenter} disabled={loading} aria-label={copy.recenter} title={copy.recenter}>
            <span aria-hidden="true">+</span>
          </button>
        </div>
      </div>

      {error && <p className="live-map-shell__error mt-3 rounded-xl border px-3 py-2 text-sm">{error}</p>}

      <div className="live-map-shell__frame relative mt-4 overflow-hidden rounded-[1.8rem] border border-sky-200 bg-white">
        <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex flex-wrap gap-2 p-3 sm:p-4">
          <span className="live-map-shell__tag rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur">
            India only
          </span>
          <span className="live-map-shell__tag rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] backdrop-blur">
            Search and zoom
          </span>
        </div>
        {viewMode === "map" ? <div className="live-map-shell__map-tint pointer-events-none absolute inset-0 z-[1]" aria-hidden="true" /> : null}
        <iframe
          title={`${title} panel`}
          src={iframeSrc}
          className={`live-map-shell__iframe h-[54vh] min-h-[360px] w-full border-0 sm:min-h-[420px] ${
            viewMode === "map" ? "live-map-shell__iframe--map" : "live-map-shell__iframe--street"
          }`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {viewMode !== "street" && (
          <div className="absolute bottom-4 right-4 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-lg">
            <button
              type="button"
              className="live-map-shell__zoom-button live-map-shell__zoom-button--top grid h-10 w-10 place-items-center border-b text-xl font-semibold transition"
              onClick={zoomIn}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="live-map-shell__zoom-button grid h-10 w-10 place-items-center text-xl font-semibold transition"
              onClick={zoomOut}
              aria-label="Zoom out"
            >
              -
            </button>
          </div>
        )}
      </div>
      {viewMode === "street" && (
        <p className="live-map-shell__note mt-2 text-xs">
          Street View is shown from the nearest mapped road. Coverage depends on Google imagery availability.
        </p>
      )}
    </section>
  );
}
