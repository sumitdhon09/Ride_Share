import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
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
    if (!value || typeof value.lat !== "number" || typeof value.lon !== "number") {
      return null;
    }
    return value;
  } catch {
    return null;
  }
}

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function haversineKm(from, to) {
  const toRadians = (value) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const latDelta = toRadians(to.lat - from.lat);
  const lonDelta = toRadians(to.lon - from.lon);
  const fromLat = toRadians(from.lat);
  const toLat = toRadians(to.lat);
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;
  return earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getPricingDistanceKm(routeDistanceKm, from, to) {
  const normalizedRouteDistance = Number(routeDistanceKm);
  const directDistanceKm = from && to ? haversineKm(from, to) : NaN;

  if (Number.isFinite(directDistanceKm) && directDistanceKm > 0) {
    const calibratedDistance = Math.max(1, directDistanceKm * 1.05);
    if (Number.isFinite(normalizedRouteDistance) && normalizedRouteDistance > 0) {
      return Math.min(normalizedRouteDistance, calibratedDistance);
    }
    return calibratedDistance;
  }

  if (Number.isFinite(normalizedRouteDistance) && normalizedRouteDistance > 0) {
    return normalizedRouteDistance;
  }

  return 0;
}

function buildLocationSummary(selection, landmarkOverride = "") {
  if (!selection) {
    return null;
  }
  return {
    label: selection.label || "",
    village: selection.village || "",
    landmark: landmarkOverride.trim() || selection.landmark || "",
    plusCode: selection.plusCode || "",
    nearbyVillageNames: Array.isArray(selection.nearbyVillageNames) ? selection.nearbyVillageNames : [],
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
  const [mapPinMode, setMapPinMode] = useState(false);

  const mapCurrentLocation = currentLocation || liveLocation;

  useEffect(() => {
    pickupRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!mapSelection || !mapSelection.target || !String(mapSelection.label || "").trim()) {
      return;
    }
    if (mapSelection.target === "pickup") {
      setPickup(mapSelection.label);
      setPickupSelection(mapSelection);
      setSuggestionsOpenFor("");
      setError("");
      return;
    }
    setDrop(mapSelection.label);
    setDropSelection(mapSelection);
    setSuggestionsOpenFor("");
    setError("");
  }, [mapSelection]);

  const geocodePlaceCached = useCallback(async (place, signal, options = {}) => {
    const key = `${place.trim().toLowerCase()}::${options.referenceLocation?.lat || ""}:${options.referenceLocation?.lon || ""}`;
    if (!place.trim()) {
      return null;
    }
    if (geocodeCacheRef.current.has(key)) {
      return geocodeCacheRef.current.get(key);
    }
    const mapped = await geocodePlace(place, signal, options);
    geocodeCacheRef.current.set(key, mapped);
    return mapped;
  }, []);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      const pickupValue = pickup.trim();
      const dropValue = drop.trim();
      if ((!pickupValue && !pickupSelection) || (!dropValue && !dropSelection)) {
        setDistanceKm(null);
        setFareEstimate(null);
        setEtaText("");
        setResolvedPickupSelection(null);
        setResolvedDropSelection(null);
        return;
      }
      if (pickupValue === LIVE_PICKUP_LABEL && !liveLocation && !pickupSelection) {
        setDistanceKm(null);
        setFareEstimate(null);
        setEtaText("");
        return;
      }

      setLoadingEstimate(true);
      try {
        const nextPickup =
          pickupSelection ||
          resolvePickupCoordinate(pickupValue, liveLocation) ||
          (await geocodePlaceCached(pickupValue, controller.signal, { referenceLocation: liveLocation }));
        const nextDrop =
          dropSelection ||
          (await geocodePlaceCached(dropValue, controller.signal, {
            referenceLocation: nextPickup || liveLocation,
          }));

        if (!nextPickup || !nextDrop) {
          if (!cancelled) {
            setDistanceKm(null);
            setFareEstimate(null);
            setEtaText("");
            setResolvedPickupSelection(nextPickup || null);
            setResolvedDropSelection(nextDrop || null);
            setError("Pin exact route or refine location.");
          }
          return;
        }

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
        let etaRange = "";
        try {
          const params = new URLSearchParams({
            distanceKm: calculatedDistance.toFixed(2),
            rideType,
            pickupLat: String(nextPickup.lat),
            pickupLon: String(nextPickup.lon),
            dropLat: String(nextDrop.lat),
            dropLon: String(nextDrop.lon),
          });
          const estimate = await apiRequest(`/rides/estimate?${params.toString()}`);
          const etaMin = Number(estimate?.etaMinMinutes);
          const etaMax = Number(estimate?.etaMaxMinutes);
          if (Number.isFinite(etaMin) && Number.isFinite(etaMax)) {
            etaRange = `${etaMin}-${etaMax} min`;
          }
        } catch {
          const baseEta = Math.max(6, Math.round(routedDurationMin || (calculatedDistance / 24) * 60) + 4);
          etaRange = `${baseEta}-${baseEta + 6} min`;
        }

        if (!cancelled) {
          setError("");
          setDistanceKm(pricingDistanceKm);
          setFareEstimate(estimatedFare);
          setEtaText(etaRange);
          setResolvedPickupSelection(nextPickup);
          setResolvedDropSelection(nextDrop);
        }
      } catch {
        if (!cancelled) {
          setDistanceKm(null);
          setFareEstimate(null);
          setEtaText("");
        }
      } finally {
        if (!cancelled) {
          setLoadingEstimate(false);
        }
      }
    }, 220);

    return () => {
      cancelled = true;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [drop, dropSelection, geocodePlaceCached, liveLocation, pickup, pickupSelection, rideType, roundTripEnabled]);

  const filteredPickupSuggestions = useMemo(() => {
    const query = pickup.trim().toLowerCase();
    return ALL_INDIA_CITIES.filter((city) => city.toLowerCase().includes(query)).slice(0, 6);
  }, [pickup]);

  const filteredDropSuggestions = useMemo(() => {
    const query = drop.trim().toLowerCase();
    return ALL_INDIA_CITIES.filter((city) => city.toLowerCase().includes(query)).slice(0, 6);
  }, [drop]);

  const requestLiveLocationForPickup = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }
      setRequestingLocation(true);
      setLocationSuccess(false);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const payload = {
            lat: position.coords.latitude,
            lon: position.coords.longitude,
            accuracy: position.coords.accuracy,
            capturedAt: new Date().toISOString(),
          };
          localStorage.setItem("liveLocation", JSON.stringify(payload));
          setLiveLocation(payload);
          onCurrentLocationChange?.({ lat: payload.lat, lon: payload.lon });
          setPickup(LIVE_PICKUP_LABEL);
          setPickupSelection({
            lat: payload.lat,
            lon: payload.lon,
            label: LIVE_PICKUP_LABEL,
            landmark: "",
            nearbyVillageNames: [],
            plusCode: "",
          });
          setSuggestionsOpenFor("");
          setRequestingLocation(false);
          setLocationSuccess(true);
          window.setTimeout(() => setLocationSuccess(false), 1400);
          resolve(payload);
        },
        () => {
          setRequestingLocation(false);
          resolve(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  const requestOnlinePayment = useCallback(
    async ({ token, rideSummary, amountInInr }) => {
      const order = await apiRequest("/payments/order", "POST", { amountInInr, rideSummary, paymentMode }, token);

      if (order?.isMock) {
        return {
          paymentReference: order.paymentId || order.orderId || order.sessionId,
          isMock: true,
        };
      }

      const Razorpay = await loadRazorpayCheckout();
      return new Promise((resolve, reject) => {
        const checkout = new Razorpay({
          key: order.keyId,
          amount: order.amountMinor,
          currency: order.currency,
          name: order.name || "RideShare Live",
          description: order.description || rideSummary,
          order_id: order.orderId,
          prefill: { name: localStorage.getItem("name") || "" },
          theme: { color: "#0ea5e9" },
          handler: async (response) => {
            try {
              const verification = await apiRequest(
                "/payments/verify",
                "POST",
                {
                  orderId: response.razorpay_order_id,
                  paymentId: response.razorpay_payment_id,
                  signature: response.razorpay_signature,
                  paymentMode,
                },
                token
              );
              resolve({
                paymentReference: verification.paymentReference || response.razorpay_payment_id,
                isMock: false,
              });
            } catch (requestError) {
              reject(requestError);
            }
          },
          modal: {
            ondismiss: () => reject(new Error("Payment was cancelled.")),
          },
        });

        checkout.open();
      });
    },
    [paymentMode]
  );

  const pickupSummary = buildLocationSummary(pickupSelection || resolvedPickupSelection, pickupLandmark);
  const dropSummary = buildLocationSummary(dropSelection || resolvedDropSelection, dropLandmark);
  const routeReady = Boolean(
    pickup.trim() &&
      drop.trim() &&
      (pickupSelection || resolvedPickupSelection) &&
      (dropSelection || resolvedDropSelection) &&
      (((fareEstimate ?? 0) > 0) || Number(distanceKm) > 0)
  );

  const rideCards = useMemo(() => {
    const baseEta = distanceKm ? Math.max(3, Math.round((distanceKm / 24) * 60) + 2) : 3;
    return RIDE_OPTIONS.map((item, index) => ({
      ...item,
      label: item.name,
      price: distanceKm ? calculateRideFare(distanceKm, item.id, roundTripEnabled) : item.minimumFare,
      eta: formatRideEta(baseEta, index),
    }));
  }, [distanceKm, roundTripEnabled]);
  const currentRideCard = rideCards.find((item) => item.id === rideType) || rideCards[0] || null;
  const displayFareEstimate = fareEstimate ?? currentRideCard?.price ?? 0;

  const handleRouteResolved = useCallback(
    (route) => {
      if (!route?.pickup || !route?.drop) {
        return;
      }

      const nextDistance = Number(route.distanceKm);
      const safeDistance = getPricingDistanceKm(nextDistance, route.pickup, route.drop);
      const nextEtaMinutes = Number(route.durationMin);
      const safeEta = Number.isFinite(nextEtaMinutes) && nextEtaMinutes > 0 ? nextEtaMinutes : Math.max(6, Math.round((safeDistance / 24) * 60) + 4);

      setResolvedPickupSelection(route.pickup);
      setResolvedDropSelection(route.drop);
      setDistanceKm(safeDistance);
      setFareEstimate(calculateRideFare(safeDistance, rideType, roundTripEnabled));
      setEtaText(formatRideEta(safeEta));
      setError("");
    },
    [rideType, roundTripEnabled]
  );

  const canVisitStep = useCallback(
    (stepId) => {
      if (stepId === "location") {
        return true;
      }
      if (stepId === "ride") {
        return routeReady;
      }
      if (stepId === "payment") {
        return routeReady;
      }
      return routeReady && paymentMode;
    },
    [paymentMode, routeReady]
  );

  const primaryAction = useMemo(() => {
    if (activeStep === "location") {
      return {
        label: "Continue to rides",
        disabled: !routeReady,
      };
    }
    if (activeStep === "ride") {
      return {
        label: "Continue to payment",
        disabled: !routeReady,
      };
    }
    if (activeStep === "payment") {
      return {
        label: "Review ride",
        disabled: !paymentMode,
      };
    }
    return {
      label: submitting ? "Processing..." : "Confirm Ride ->",
      disabled: !routeReady || submitting,
    };
  }, [activeStep, paymentMode, routeReady, submitting]);

  const handleAdvance = () => {
    if (activeStep === "confirm") {
      return;
    }
    const nextStep = getNextStep(activeStep);
    if (canVisitStep(nextStep)) {
      setActiveStep(nextStep);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (activeStep !== "confirm") {
      handleAdvance();
      return;
    }

    setError("");
    setSuccess("");
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Login required to book.");
      return;
    }
    if (!routeReady) {
      setError("Complete trip details first.");
      return;
    }

    const effectivePickup = pickupSelection || resolvedPickupSelection;
    const effectiveDrop = dropSelection || resolvedDropSelection;

    setSubmitting(true);
    try {
      let paymentReference = "Cash";
      let paymentStatus = "PENDING";
      const rideSummary = `${pickup.trim()} to ${drop.trim()}`;

      if (paymentMode !== "CASH") {
        const paymentResult = await requestOnlinePayment({
          token,
          rideSummary,
          amountInInr: displayFareEstimate,
        });
        paymentReference = paymentResult.paymentReference;
        paymentStatus = "PAID";
      }

      const bookingPayload = {
        pickupLocation: buildManualLocationLabel(pickup.trim(), pickupLandmark),
        dropLocation: buildManualLocationLabel(drop.trim(), dropLandmark),
        fare: displayFareEstimate,
        paymentMode,
        preferredDriverId: null,
        preferredDriverName: "",
        paymentReference,
        paymentStatus,
        pickupLat: effectivePickup?.lat ?? null,
        pickupLon: effectivePickup?.lon ?? null,
        dropLat: effectiveDrop?.lat ?? null,
        dropLon: effectiveDrop?.lon ?? null,
        pickupLandmark: pickupLandmark.trim() || effectivePickup?.landmark || "",
        dropLandmark: dropLandmark.trim() || effectiveDrop?.landmark || "",
        pickupPlusCode: effectivePickup?.plusCode || "",
        dropPlusCode: effectiveDrop?.plusCode || "",
      };
      await apiRequest("/rides/book", "POST", bookingPayload, token);
      saveRecentRoute({
        pickup: pickup.trim(),
        drop: drop.trim(),
        pickupLat: effectivePickup?.lat ?? null,
        pickupLon: effectivePickup?.lon ?? null,
        dropLat: effectiveDrop?.lat ?? null,
        dropLon: effectiveDrop?.lon ?? null,
      });

      setSuccess(paymentMode === "CASH" ? "Ride booked." : "Payment verified. Ride booked.");
      setPickup("");
      setDrop("");
      setPickupLandmark("");
      setDropLandmark("");
      setPickupSelection(null);
      setDropSelection(null);
      setResolvedPickupSelection(null);
      setResolvedDropSelection(null);
      setPaymentMode("CASH");
      setRideType("bike");
      setRoundTripEnabled(false);
      setDistanceKm(null);
      setFareEstimate(null);
      setEtaText("");
      setMapSelection(null);
      setActiveStep("location");
      onBooked?.();
      pickupRef.current?.focus();
    } catch (requestError) {
      setError(requestError.message || "Unable to book ride.");
    } finally {
      setSubmitting(false);
    }
  };

  const rideLabel = currentRideCard?.label || "Economy";
  return (
    <form onSubmit={handleSubmit}>
      <BookingLayout
        leftContent={
          <div className="space-y-5">
            {activeStep === "location" ? (
              <LocationStep
                pickup={pickup}
                drop={drop}
                pickupLandmark={pickupLandmark}
                dropLandmark={dropLandmark}
                pickupRef={pickupRef}
                requestingLocation={requestingLocation}
                locationSuccess={locationSuccess}
                suggestionsOpenFor={suggestionsOpenFor}
                filteredPickupSuggestions={filteredPickupSuggestions}
                filteredDropSuggestions={filteredDropSuggestions}
                mapSelectionTarget={mapSelectionTarget}
                loadingEstimate={loadingEstimate}
                pickupSummary={pickupSummary}
                dropSummary={dropSummary}
                mapPinMode={mapPinMode}
                onPickupChange={(value) => {
                  setPickup(value);
                  setPickupSelection(null);
                }}
                onDropChange={(value) => {
                  setDrop(value);
                  setDropSelection(null);
                }}
                onPickupFocus={() => setSuggestionsOpenFor("pickup")}
                onDropFocus={() => setSuggestionsOpenFor("drop")}
                onPickupLandmarkChange={setPickupLandmark}
                onDropLandmarkChange={setDropLandmark}
                onRequestCurrentLocation={requestLiveLocationForPickup}
                onPickupSuggestionSelect={(value) => {
                  setPickup(value);
                  setPickupSelection(null);
                  setSuggestionsOpenFor("");
                }}
                onDropSuggestionSelect={(value) => {
                  setDrop(value);
                  setDropSelection(null);
                  setSuggestionsOpenFor("");
                }}
              />
            ) : null}

            {activeStep === "ride" ? (
              <RideSelection
                rides={rideCards}
                selectedRide={rideType}
                onSelect={setRideType}
                roundTripEnabled={roundTripEnabled}
                onToggleRoundTrip={setRoundTripEnabled}
                fareEstimate={displayFareEstimate}
                distanceKm={distanceKm}
              />
            ) : null}

            {activeStep === "payment" ? (
              <PaymentStep
                options={PAYMENT_OPTIONS}
                selectedPayment={paymentMode}
                onSelect={setPaymentMode}
                fareEstimate={displayFareEstimate}
                rideLabel={rideLabel}
              />
            ) : null}

            {activeStep === "confirm" ? (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-[1.75rem] bg-slate-50 p-5"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Route</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">
                      {pickup || "Pickup"} to {drop || "Drop"}
                    </p>
                    {distanceKm || etaText ? <p className="mt-1 text-sm text-slate-500">{distanceKm ? `${distanceKm.toFixed(1)} km` : ""}{distanceKm && etaText ? " • " : ""}{etaText || ""}</p> : null}
                  </div>
                  <div className="rounded-2xl bg-white px-4 py-4">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">Booking</p>
                    <p className="mt-2 text-base font-semibold text-slate-900">{rideLabel}</p>
                    <motion.p
                      key={`confirm-fare-${displayFareEstimate || 0}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="mt-3 text-xl font-semibold text-slate-950"
                    >
                      {displayFareEstimate ? `Rs ${formatInr(displayFareEstimate)}` : "Fare loading"}
                    </motion.p>
                  </div>
                </div>
              </motion.div>
            ) : null}

            {error ? <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}
            {success ? <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">{success}</p> : null}
          </div>
        }
        rightContent={
          <div className="space-y-4">
            <div className="rounded-[1.5rem] border border-slate-200 bg-white p-3 shadow-[0_18px_40px_-30px_rgba(15,23,42,0.12)]">
              <div className="mb-3 flex items-center justify-end gap-2 px-1">
                <div className="inline-flex rounded-full bg-slate-100 p-1">
                  {["pickup", "drop"].map((target) => (
                    <button
                      key={target}
                      type="button"
                      onClick={() => {
                        setMapSelectionTarget(target);
                        setMapPinMode(true);
                      }}
                      className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] transition ${
                        mapSelectionTarget === target ? "bg-slate-950 text-white" : "text-slate-500"
                      }`}
                    >
                      {target}
                    </button>
                  ))}
                </div>
              </div>
              <div className="relative">
                <CompactMap
                  pickup={pickup}
                  drop={drop}
                  pickupCoordinate={pickupSelection || resolvedPickupSelection}
                  dropCoordinate={dropSelection || resolvedDropSelection}
                  currentLocation={mapCurrentLocation}
                  onMapLocationSelect={setMapSelection}
                  onRouteResolved={handleRouteResolved}
                  selectionTarget={mapSelectionTarget}
                  theme={theme}
                  heightClass="h-[430px] xl:h-[560px]"
                />
              </div>
            </div>

            <motion.div layout className="rounded-[1.5rem] bg-white p-4 shadow-[0_16px_36px_-30px_rgba(15,23,42,0.12)]">
              <div className="mt-4 space-y-3 text-sm">
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="mt-1 font-semibold text-slate-900">{pickupSummary?.label || pickup.trim() || "Add pickup"}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 px-3 py-3">
                  <p className="mt-1 font-semibold text-slate-900">{dropSummary?.label || drop.trim() || "Add destination"}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="mt-1 font-semibold text-slate-900">{rideLabel}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="mt-1 font-semibold text-slate-900">{paymentMode === "CASH" ? "Cash" : paymentMode}</p>
                    <motion.p
                      key={`snapshot-fare-${displayFareEstimate || 0}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18 }}
                      className="mt-1 text-xs text-slate-500"
                    >
                      {displayFareEstimate ? `Rs ${formatInr(displayFareEstimate)}` : "Fare soon"}
                    </motion.p>
                  </div>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                {mapPinMode ? <button type="button" onClick={() => setMapPinMode(false)} className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">Done</button> : null}
              </div>
            </motion.div>
          </div>
        }
        footer={
          <ConfirmButton
            type={activeStep === "confirm" ? "submit" : "button"}
            label={primaryAction.label}
            disabled={primaryAction.disabled}
            onClick={activeStep === "confirm" ? undefined : handleAdvance}
          />
        }
      />
    </form>
  );
}
