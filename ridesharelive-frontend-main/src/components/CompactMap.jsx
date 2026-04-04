import { useEffect, useMemo, useState, useRef } from "react";
import L from "leaflet";
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap, useMapEvents, Circle } from "react-leaflet";
import { fetchRouteSummary, geocodePlace, resolvePickupCoordinate, reverseGeocodeCoordinate } from "../utils/routing";

// Leaflet marker fix
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL("leaflet/dist/images/marker-icon-2x.png", import.meta.url).href,
  iconUrl: new URL("leaflet/dist/images/marker-icon.png", import.meta.url).href,
  shadowUrl: new URL("leaflet/dist/images/marker-shadow.png", import.meta.url).href,
});

const DEFAULT_CENTER = [20.5937, 78.9629];

// Custom Icons
const userIcon = new L.DivIcon({ 
  className: "rideshare-map-marker rideshare-map-marker--user", 
  html: '<span class="rideshare-map-marker__dot"></span>', 
  iconSize: [18, 18], 
  iconAnchor: [9, 9] 
});

const pickupIcon = new L.DivIcon({ 
  className: "rideshare-map-marker rideshare-map-marker--pickup", 
  html: '<span class="rideshare-map-marker__dot"></span>', 
  iconSize: [20, 20], 
  iconAnchor: [10, 10] 
});

const dropIcon = new L.DivIcon({ 
  className: "rideshare-map-marker rideshare-map-marker--drop", 
  html: '<span class="rideshare-map-marker__dot"></span>', 
  iconSize: [18, 18], 
  iconAnchor: [9, 9] 
});

const createDriverIcon = (vehicleType = "CAR", isNearest = false) => {
  const emoji = vehicleType.toUpperCase() === "BIKE" ? "🛵" : 
                vehicleType.toUpperCase() === "AUTO" ? "🛺" : 
                vehicleType.toUpperCase() === "XL" ? "🚙" : "🚗";
  
  return new L.DivIcon({
    className: "driver-marker-static",
    html: `
      <div class="relative flex items-center justify-center">
        <div class="z-10 bg-white rounded-full p-1 shadow border ${isNearest ? 'border-amber-400' : 'border-slate-200'}">
          <span class="text-lg">${emoji}</span>
        </div>
      </div>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 16]
  });
};

function MapViewport({ points, center, padding = [40, 40] }) {
  const map = useMap();
  useEffect(() => {
    if (points.length >= 2) {
      map.fitBounds(points, { padding, animate: false });
      return;
    }
    if (center) {
      map.setView(center, 14, { animate: false });
    }
  }, [center, map, points, padding]);
  return null;
}

function MapSelectionHandler({ enabled, onSelect }) {
  useMapEvents({
    click(event) {
      if (!enabled || !onSelect) return;
      onSelect({ lat: event.latlng.lat, lon: event.latlng.lng });
    },
  });
  return null;
}

function toPointArray(selection) {
  if (!selection || typeof selection.lat !== "number" || typeof selection.lon !== "number") return null;
  return [selection.lat, selection.lon];
}

export default function CompactMap({
  pickup,
  drop,
  pickupCoordinate,
  dropCoordinate,
  currentLocation,
  onMapLocationSelect,
  onRouteResolved,
  nearbyDrivers = [],
  searchRadiusKm = 5,
  onRadiusChange,
  selectionTarget = "drop",
  theme = "light",
  heightClass = "h-[340px] sm:h-[400px] lg:h-[440px]",
}) {
  const [pickupPoint, setPickupPoint] = useState(null);
  const [dropPoint, setDropPoint] = useState(null);
  const [routePath, setRoutePath] = useState([]);
  const [selectionStatus, setSelectionStatus] = useState("");
  const [simulatedDrivers, setSimulatedDrivers] = useState([]);
  const simIntervalRef = useRef(null);

  useEffect(() => {
    setSimulatedDrivers(nearbyDrivers.map(d => ({ ...d, simLat: d.lat, simLon: d.lon })));
  }, [nearbyDrivers]);

  // Slower simulation (10 seconds)
  useEffect(() => {
    if (simIntervalRef.current) clearInterval(simIntervalRef.current);
    simIntervalRef.current = setInterval(() => {
      setSimulatedDrivers(prev => prev.map(d => {
        const drift = 0.00003;
        return {
          ...d,
          simLat: d.simLat + (Math.random() - 0.5) * drift,
          simLon: d.simLon + (Math.random() - 0.5) * drift,
        };
      }));
    }, 10000);
    return () => clearInterval(simIntervalRef.current);
  }, [simulatedDrivers.length]);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const loadRoute = async () => {
      const normalizedPickup = pickup?.trim();
      const normalizedDrop = drop?.trim();
      
      if ((!normalizedPickup && !pickupCoordinate) || (!normalizedDrop && !dropCoordinate)) {
        setPickupPoint(toPointArray(pickupCoordinate));
        setDropPoint(toPointArray(dropCoordinate));
        setRoutePath([]);
        onRouteResolved?.(null);
        return;
      }

      try {
        const nextPickup =
          pickupCoordinate ||
          resolvePickupCoordinate(normalizedPickup, currentLocation) ||
          (normalizedPickup ? await geocodePlace(normalizedPickup, controller.signal, { referenceLocation: currentLocation }) : null);

        const nextDrop =
          dropCoordinate ||
          (normalizedDrop ? await geocodePlace(normalizedDrop, controller.signal, { referenceLocation: nextPickup || currentLocation }) : null);

        if (!active) return;
        setPickupPoint(toPointArray(nextPickup));
        setDropPoint(toPointArray(nextDrop));

        if (nextPickup && nextDrop) {
          try {
            const route = await fetchRouteSummary(nextPickup, nextDrop, controller.signal);
            if (active && Array.isArray(route.path) && route.path.length > 1) {
              setRoutePath(route.path);
              onRouteResolved?.({
                pickup: nextPickup,
                drop: nextDrop,
                distanceKm: route.distanceKm,
                durationMin: route.durationMin,
                path: route.path,
              });
            } else if (active) {
              setRoutePath([[nextPickup.lat, nextPickup.lon], [nextDrop.lat, nextDrop.lon]]);
              onRouteResolved?.({
                pickup: nextPickup,
                drop: nextDrop,
                distanceKm: null,
                durationMin: null,
                path: [[nextPickup.lat, nextPickup.lon], [nextDrop.lat, nextDrop.lon]],
              });
            }
          } catch {
            if (active) {
              setRoutePath([[nextPickup.lat, nextPickup.lon], [nextDrop.lat, nextDrop.lon]]);
              onRouteResolved?.({
                pickup: nextPickup,
                drop: nextDrop,
                distanceKm: null,
                durationMin: null,
                path: [[nextPickup.lat, nextPickup.lon], [nextDrop.lat, nextDrop.lon]],
              });
            }
          }
        } else {
          setRoutePath([]);
          onRouteResolved?.(null);
        }
      } catch {
        if (active) {
          setPickupPoint(toPointArray(pickupCoordinate));
          setDropPoint(toPointArray(dropCoordinate));
          setRoutePath([]);
          onRouteResolved?.(null);
        }
      }
    };

    loadRoute();
    return () => {
      active = false;
      controller.abort();
    };
  }, [currentLocation, drop, dropCoordinate, onRouteResolved, pickup, pickupCoordinate]);

  const center = useMemo(() => {
    if (pickupPoint) return pickupPoint;
    if (dropPoint) return dropPoint;
    if (currentLocation?.lat && currentLocation?.lon) return [currentLocation.lat, currentLocation.lon];
    return DEFAULT_CENTER;
  }, [currentLocation, dropPoint, pickupPoint]);

  const viewportPoints = useMemo(() => {
    if (pickupPoint && simulatedDrivers.length > 0) {
      return [pickupPoint, ...simulatedDrivers.map(d => [d.simLat, d.simLon])];
    }
    if (routePath.length > 1) return routePath;
    if (pickupPoint && dropPoint) return [pickupPoint, dropPoint];
    return [pickupPoint, dropPoint].filter(Boolean);
  }, [dropPoint, pickupPoint, routePath, simulatedDrivers]);

  const tileUrl = theme === "dark" ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png" : "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

  const handleMapSelect = async ({ lat, lon }) => {
    if (!onMapLocationSelect) return;
    try {
      const selection = await reverseGeocodeCoordinate(lat, lon);
      onMapLocationSelect({ ...selection, target: selectionTarget });
      setSelectionStatus(`${selectionTarget === "pickup" ? "Pickup" : "Drop"} pinned`);
      window.setTimeout(() => setSelectionStatus(""), 1000);
    } catch {
      setSelectionStatus("Try another point");
      window.setTimeout(() => setSelectionStatus(""), 1000);
    }
  };

  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-white border border-slate-200">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[500] flex bg-white rounded-full p-1 shadow border border-slate-200">
        {[3, 5, 10].map(r => (
          <button
            key={r}
            type="button"
            onClick={() => onRadiusChange?.(r)}
            className={`px-3 py-1 rounded-full text-xs font-bold ${
              searchRadiusKm === r 
              ? "bg-slate-900 text-white" 
              : "text-slate-600"
            }`}
          >
            {r}KM
          </button>
        ))}
      </div>

      {selectionStatus ? (
        <div className="absolute left-4 top-16 z-[500] rounded bg-slate-900 px-2 py-1 text-[10px] font-bold text-white">
          {selectionStatus}
        </div>
      ) : null}

      <div className={`${heightClass} w-full`}>
        <MapContainer center={center} zoom={14} zoomControl={false} attributionControl={false} className="h-full w-full">
          <TileLayer url={tileUrl} />
          <MapViewport points={viewportPoints} center={center} />
          <MapSelectionHandler enabled={Boolean(onMapLocationSelect)} onSelect={handleMapSelect} />
          
          {pickupPoint && (
            <Circle 
              center={pickupPoint} 
              radius={searchRadiusKm * 1000} 
              pathOptions={{ color: '#f59e0b', weight: 1, fillOpacity: 0.05 }}
            />
          )}

          {currentLocation?.lat && currentLocation?.lon && (
            <Marker position={[currentLocation.lat, currentLocation.lon]} icon={userIcon}>
              <Tooltip direction="top">You</Tooltip>
            </Marker>
          )}

          {pickupPoint && (
            <Marker position={pickupPoint} icon={pickupIcon}>
              <Tooltip direction="top" permanent>Pickup</Tooltip>
            </Marker>
          )}

          {dropPoint && (
            <Marker position={dropPoint} icon={dropIcon}>
              <Tooltip direction="top">Drop</Tooltip>
            </Marker>
          )}

          {simulatedDrivers.map((driver, idx) => (
            <Marker 
              key={driver.id || idx} 
              position={[driver.simLat, driver.simLon]} 
              icon={createDriverIcon(driver.vehicleType, idx === 0)}
            >
              <Tooltip direction="top">
                <div className="p-1 min-w-[80px]">
                  <p className="font-bold text-slate-900 text-xs">{driver.name}</p>
                  <p className="text-[10px] text-slate-500">{driver.etaMinutes} min</p>
                </div>
              </Tooltip>
            </Marker>
          ))}

          {routePath.length > 1 && (
            <Polyline 
              positions={routePath} 
              pathOptions={{ color: "#0f172a", weight: 3, opacity: 0.6 }} 
            />
          )}
        </MapContainer>
      </div>

      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex justify-between items-end">
        <div className="flex gap-2">
          {simulatedDrivers.length > 0 && (
            <span className="bg-emerald-600 text-white px-2 py-1 rounded-full text-[10px] font-bold">
              {simulatedDrivers.length} Nearby
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
