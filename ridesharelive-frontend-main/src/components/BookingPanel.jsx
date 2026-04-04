import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import { ALL_INDIA_CITIES } from "../data/indiaCities";
import { loadRazorpayCheckout } from "../utils/razorpay";
import {
  buildManualLocationLabel,
  fetchRouteSummary,
  geocodePlace,
  LIVE_PICKUP_LABEL,
  resolvePickupCoordinate,
} from "../utils/routing";
import { calculateRideFare, formatRideEta, RIDE_OPTIONS } from "../utils/farePricing";
import BookingLayout from "./BookingLayout";
import CompactMap from "./CompactMap";
import ConfirmButton from "./ConfirmButton";
import LocationStep from "./LocationStep";
import PaymentStep from "./PaymentStep";
import RideSelection from "./RideSelection";

const STEP_ORDER = ["location", "ride", "payment", "confirm"];
const PAYMENT_OPTIONS = [
  { id: "CASH", label: "Cash" },
  { id: "UPI", label: "UPI" },
  { id: "CARD", label: "Card" },
];

function saveRecentRoute(route) {
  let current = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("recentLocations") || "[]");
    current = Array.isArray(parsed) ? parsed : [];
  } catch {
    current = [];
  }
  const deduped = current.filter((item) => item.pickup !== route.pickup || item.drop !== route.drop);
  const next = [route, ...deduped].slice(0, 6);
  localStorage.setItem("recentLocations", JSON.stringify(next));
  return next;
}

function readStoredLiveLocation() {
  try {
    const value = JSON.parse(localStorage.getItem("liveLocation") || "null");
    if (!value || typeof value.lat !== "number" || typeof value.lon !== "number") return null;
    return value;
  } catch {
    return null;
  }
}

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function haversineKm(from, to) {
  const toRadians = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRadians(from.lat))*Math.cos(toRadians(to.lat))*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getPricingDistanceKm(routeDistanceKm, from, to) {
  const normalized = Number(routeDistanceKm);
  const direct = from && to ? haversineKm(from, to) : NaN;
  if (Number.isFinite(direct) && direct > 0) {
    const calibrated = Math.max(1, direct * 1.05);
    return (Number.isFinite(normalized) && normalized > 0) ? Math.min(normalized, calibrated) : calibrated;
  }
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 0;
}

function buildLocationSummary(selection, landmarkOverride = "") {
  if (!selection) return null;
  return {
    label: selection.label || "",
    lat: selection.lat,
    lon: selection.lon,
  };
}

function getNextStep(currentStep) {
  const index = STEP_ORDER.indexOf(currentStep);
  return STEP_ORDER[Math.min(index + 1, STEP_ORDER.length - 1)];
}

export default function BookingPanel({
  onBooked,
  currentLocation = null,
  onCurrentLocationChange,
  theme = "light",
}) {
  const pickupRef = useRef(null);
  const geocodeCacheRef = useRef(new Map());
  const [activeStep, setActiveStep] = useState("location");
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [pickupLandmark, setPickupLandmark] = useState("");
  const [dropLandmark, setDropLandmark] = useState("");
  const [pickupSelection, setPickupSelection] = useState(null);
  const [dropSelection, setDropSelection] = useState(null);
  const [resolvedPickupSelection, setResolvedPickupSelection] = useState(null);
  const [resolvedDropSelection, setResolvedDropSelection] = useState(null);
  const [rideType, setRideType] = useState("bike");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [roundTripEnabled, setRoundTripEnabled] = useState(false);
  const [suggestionsOpenFor, setSuggestionsOpenFor] = useState("pickup");
  const [liveLocation, setLiveLocation] = useState(readStoredLiveLocation);
  const [requestingLocation, setRequestingLocation] = useState(false);
  const [locationSuccess, setLocationSuccess] = useState(false);
  const [distanceKm, setDistanceKm] = useState(null);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [etaText, setEtaText] = useState("");
  const [loadingEstimate, setLoadingEstimate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [mapSelection, setMapSelection] = useState(null);
  const [mapSelectionTarget, setMapSelectionTarget] = useState("drop");
  const [nearbyDrivers, setNearbyDrivers] = useState([]);
  const [searchRadiusKm, setSearchRadiusKm] = useState(5);

  const mapCurrentLocation = currentLocation || liveLocation;

  useEffect(() => {
    const effectivePickup = pickupSelection || resolvedPickupSelection;
    if (!effectivePickup?.lat || !effectivePickup?.lon) {
      setNearbyDrivers([]);
      return;
    }
    const fetchDrivers = async () => {
      try {
        const drivers = await apiRequest(
          `/api/drivers/nearby?lat=${effectivePickup.lat}&lon=${effectivePickup.lon}&radiusKm=${searchRadiusKm}&limit=3`
        );
        if (drivers && drivers.length > 0) setNearbyDrivers(drivers);
      } catch (err) {
        setNearbyDrivers([]);
      }
    };
    fetchDrivers();
  }, [pickupSelection, resolvedPickupSelection, searchRadiusKm]);

  useEffect(() => {
    pickupRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!mapSelection || !mapSelection.target || !String(mapSelection.label || "").trim()) return;
    if (mapSelection.target === "pickup") {
      setPickup(mapSelection.label);
      setPickupSelection(mapSelection);
      setSuggestionsOpenFor("");
    } else {
      setDrop(mapSelection.label);
      setDropSelection(mapSelection);
      setSuggestionsOpenFor("");
    }
  }, [mapSelection]);

  const geocodePlaceCached = useCallback(async (place, signal, options = {}) => {
    const key = `${place.trim().toLowerCase()}::${options.referenceLocation?.lat || ""}:${options.referenceLocation?.lon || ""}`;
    if (!place.trim()) return null;
    if (geocodeCacheRef.current.has(key)) return geocodeCacheRef.current.get(key);
    const mapped = await geocodePlace(place, signal, options);
    geocodeCacheRef.current.set(key, mapped);
    return mapped;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const pVal = pickup.trim();
      const dVal = drop.trim();
      if ((!pVal && !pickupSelection) || (!dVal && !dropSelection)) return;
      setLoadingEstimate(true);
      try {
        const nextPickup = pickupSelection || resolvePickupCoordinate(pVal, liveLocation) || await geocodePlaceCached(pVal, controller.signal, { referenceLocation: liveLocation });
        const nextDrop = dropSelection || await geocodePlaceCached(dVal, controller.signal, { referenceLocation: nextPickup || liveLocation });

        if (!nextPickup || !nextDrop) return;

        let calculatedDistance = 0;
        let routedDurationMin = 0;
        try {
          const route = await fetchRouteSummary(nextPickup, nextDrop, controller.signal);
          calculatedDistance = Math.max(1, Number(route.distanceKm) || 0);
          routedDurationMin = Math.max(1, Number(route.durationMin) || 0);
        } catch {
          calculatedDistance = Math.max(1, haversineKm(nextPickup, nextDrop) * 1.22);
          routedDurationMin = Math.max(6, (calculatedDistance / 26) * 60);
        }

        const pricingDistanceKm = getPricingDistanceKm(calculatedDistance, nextPickup, nextDrop);
        let estimatedFare = calculateRideFare(pricingDistanceKm, rideType, roundTripEnabled);
        
        if (!cancelled) {
          setError("");
          setDistanceKm(pricingDistanceKm);
          setFareEstimate(estimatedFare);
          setEtaText(`${Math.round(routedDurationMin)} min`);
          setResolvedPickupSelection(nextPickup);
          setResolvedDropSelection(nextDrop);
        }
      } catch (err) {} finally {
        if (!cancelled) setLoadingEstimate(false);
      }
    }, 400); // Throttled to save CPU
    return () => { cancelled = true; controller.abort(); window.clearTimeout(timer); };
  }, [drop, dropSelection, geocodePlaceCached, liveLocation, pickup, pickupSelection, rideType, roundTripEnabled]);

  const pickupSummary = buildLocationSummary(pickupSelection || resolvedPickupSelection, pickupLandmark);
  const dropSummary = buildLocationSummary(dropSelection || resolvedDropSelection, dropLandmark);
  const routeReady = Boolean(pickup.trim() && drop.trim() && (pickupSelection || resolvedPickupSelection) && (dropSelection || resolvedDropSelection));

  const displayFareEstimate = fareEstimate ?? (distanceKm ? calculateRideFare(distanceKm, rideType, roundTripEnabled) : 0);

  const handleRouteResolved = useCallback((route) => {
    if (!route?.pickup || !route?.drop) return;
    const safeDistance = getPricingDistanceKm(Number(route.distanceKm), route.pickup, route.drop);
    setResolvedPickupSelection(route.pickup);
    setResolvedDropSelection(route.drop);
    setDistanceKm(safeDistance);
    setFareEstimate(calculateRideFare(safeDistance, rideType, roundTripEnabled));
    setEtaText(`${Math.round(route.durationMin || 0)} min`);
  }, [rideType, roundTripEnabled]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (activeStep !== "confirm") {
      const nextStep = getNextStep(activeStep);
      setActiveStep(nextStep);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token || !routeReady) return;

    setSubmitting(true);
    try {
      const payload = {
        pickupLocation: buildManualLocationLabel(pickup.trim(), pickupLandmark),
        dropLocation: buildManualLocationLabel(drop.trim(), dropLandmark),
        fare: displayFareEstimate,
        paymentMode,
        pickupLat: (pickupSelection || resolvedPickupSelection)?.lat,
        pickupLon: (pickupSelection || resolvedPickupSelection)?.lon,
        dropLat: (dropSelection || resolvedDropSelection)?.lat,
        dropLon: (dropSelection || resolvedDropSelection)?.lon,
      };
      await apiRequest("/rides/book", "POST", payload, token);
      setSuccess("Booked!");
      onBooked?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <BookingLayout
        leftContent={
          <div className="space-y-4">
            {activeStep === "location" && (
              <LocationStep
                pickup={pickup} drop={drop} pickupRef={pickupRef}
                onPickupChange={v => { setPickup(v); setPickupSelection(null); }}
                onDropChange={v => { setDrop(v); setDropSelection(null); }}
              />
            )}
            {activeStep === "ride" && (
              <RideSelection
                rides={RIDE_OPTIONS.map(r => ({ ...r, price: distanceKm ? calculateRideFare(distanceKm, r.id, roundTripEnabled) : r.minimumFare }))}
                selectedRide={rideType} onSelect={setRideType}
              />
            )}
            {activeStep === "confirm" && (
              <div className="bg-slate-50 p-4 rounded-xl">
                <p className="font-bold">{pickup} -> {drop}</p>
                <p className="text-xl font-bold mt-2">Rs {formatInr(displayFareEstimate)}</p>
              </div>
            )}
            {error && <p className="text-rose-600 text-sm">{error}</p>}
            {success && <p className="text-emerald-600 text-sm">{success}</p>}
          </div>
        }
        rightContent={
          <div className="space-y-4">
            <div className="bg-white border p-2 rounded-2xl">
              <CompactMap
                pickup={pickup} drop={drop}
                pickupCoordinate={pickupSelection || resolvedPickupSelection}
                dropCoordinate={dropSelection || resolvedDropSelection}
                currentLocation={mapCurrentLocation}
                onMapLocationSelect={setMapSelection}
                onRouteResolved={handleRouteResolved}
                nearbyDrivers={nearbyDrivers}
                searchRadiusKm={searchRadiusKm}
                onRadiusChange={setSearchRadiusKm}
                theme={theme}
                heightClass="h-[400px]"
              />
            </div>
          </div>
        }
        footer={
          <ConfirmButton
            type={activeStep === "confirm" ? "submit" : "button"}
            label={activeStep === "confirm" ? (submitting ? "Booking..." : "Confirm") : "Next"}
            disabled={!routeReady || submitting}
            onClick={activeStep === "confirm" ? undefined : () => setActiveStep(getNextStep(activeStep))}
          />
        }
      />
    </form>
  );
}
