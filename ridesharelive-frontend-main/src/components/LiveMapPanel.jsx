import { useCallback, useEffect, useMemo, useState } from "react";

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
    <section className={`glass-panel card-rise p-4 sm:p-6 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-2xl font-bold text-slate-900">{title}</h3>
        <p className="text-sm font-semibold text-slate-600">{locationLabel}</p>
      </div>

      <div className="mt-4 flex flex-col gap-3 lg:flex-row">
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
          className="w-full rounded-xl border border-sky-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-sky-300"
        />
        <div className="flex shrink-0 gap-2">
          <button type="button" className="btn-primary !rounded-xl !px-4 !py-3" onClick={handleUseMyLocation} disabled={loading}>
            {copy.useMyLocation}
          </button>
          <button type="button" className="btn-secondary !rounded-xl !px-4 !py-3" onClick={handleMapView}>
            {copy.mapView}
          </button>
          <button type="button" className="btn-secondary !rounded-xl !px-4 !py-3" onClick={handleStreetView}>
            {copy.streetView}
          </button>
          <button type="button" className="btn-secondary !rounded-xl !px-4 !py-3" onClick={handleRecenter} disabled={loading}>
            {copy.recenter}
          </button>
        </div>
      </div>

      {error && <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className="relative mt-4 overflow-hidden rounded-2xl border border-sky-200 bg-white">
        <iframe
          title={`${title} panel`}
          src={iframeSrc}
          className="h-[68vh] min-h-[430px] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
        {viewMode !== "street" && (
          <div className="absolute left-3 top-3 overflow-hidden rounded-md border border-slate-300 bg-white shadow">
            <button
              type="button"
              className="grid h-10 w-10 place-items-center border-b border-slate-300 text-xl font-semibold text-slate-700 transition hover:bg-slate-100"
              onClick={zoomIn}
              aria-label="Zoom in"
            >
              +
            </button>
            <button
              type="button"
              className="grid h-10 w-10 place-items-center text-xl font-semibold text-slate-700 transition hover:bg-slate-100"
              onClick={zoomOut}
              aria-label="Zoom out"
            >
              -
            </button>
          </div>
        )}
      </div>
      {viewMode === "street" && (
        <p className="mt-2 text-xs text-slate-600">
          Street View is shown from the nearest mapped road. Coverage depends on Google imagery availability.
        </p>
      )}
    </section>
  );
}
