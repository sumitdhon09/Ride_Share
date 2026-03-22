import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import { ALL_INDIA_CITIES } from "../data/indiaCities";
import { formatPaymentModeLabel } from "../utils/paymentPresentation";
import { persistRideBookingConfirmation } from "../utils/ridePresentation";

const RIDE_TYPES = [
  { id: "economy", label: "Economy", surcharge: 0, accent: "ECO", helper: "Lowest fare for short city hops" },
  { id: "comfort", label: "Comfort", surcharge: 50, accent: "CFT", helper: "Balanced cabin space and value" },
  { id: "xl", label: "XL", surcharge: 150, accent: "XL", helper: "More seats for friends or luggage" },
  { id: "premium", label: "Premium", surcharge: 200, accent: "PRM", helper: "Quieter cabin with priority feel" },
];

const PAYMENT_OPTIONS = [
  { id: "CASH", label: "Cash", accent: "CSH", helper: "Pay after the trip ends" },
  { id: "CARD", label: "Card", accent: "CRD", helper: "Secure hosted checkout before booking" },
  { id: "UPI", label: "UPI", accent: "UPI", helper: "Pay in hosted checkout and return automatically" },
];

const LIVE_PICKUP_LABEL = "Current Live Location";
const BASE_FARE_INR = 60;
const FARE_STEP_KM = 40;
const FARE_STEP_INR = 50;
const MIN_DISTANCE_KM = 0;
const PLATFORM_SURCHARGE_INR = 50;
const ECONOMY_MAX_DISTANCE_KM = 80;
const RIDE_PROGRESS_STARTED_AT_STORAGE_PREFIX = "rideProgressStartedAt:";
const PENDING_ONLINE_BOOKING_STORAGE_KEY = "pendingOnlineRideBooking:v1";
const ONLINE_PAYMENT_MODES = new Set(["CARD", "UPI", "WALLET"]);

function readRecentRoutes() {
  try {
    const parsed = JSON.parse(localStorage.getItem("recentLocations") || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveRecentRoute(route) {
  const current = readRecentRoutes();
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

function toInr(value) {
  return new Intl.NumberFormat("en-IN", {
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function getRideTypeSurcharge(rideTypeId) {
  const selected = RIDE_TYPES.find((rideType) => rideType.id === rideTypeId);
  return selected?.surcharge ?? 0;
}

function buildSimpleFare(distanceKm, rideTypeId) {
  const safeDistance = Math.max(MIN_DISTANCE_KM, Number(distanceKm) || 0);
  const completedSlabs = Math.floor(safeDistance / FARE_STEP_KM);
  const baseDistanceFare = BASE_FARE_INR + completedSlabs * FARE_STEP_INR;
  return baseDistanceFare + PLATFORM_SURCHARGE_INR + getRideTypeSurcharge(rideTypeId);
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

function persistRideProgressStart(ride) {
  const rideId = ride?.id;
  if (!rideId) {
    return;
  }

  const startedAtMs = Number(new Date(ride?.createdAt || ride?.requestedAt || ride?.bookedAt || "").getTime());
  const resolvedStartedAt = Number.isFinite(startedAtMs) && startedAtMs > 0 ? startedAtMs : Date.now();
  localStorage.setItem(`${RIDE_PROGRESS_STARTED_AT_STORAGE_PREFIX}${rideId}`, String(resolvedStartedAt));
}

function readPendingOnlineBooking() {
  try {
    const parsed = JSON.parse(localStorage.getItem(PENDING_ONLINE_BOOKING_STORAGE_KEY) || "null");
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    const bookingPayload = parsed.bookingPayload;
    if (!bookingPayload || typeof bookingPayload !== "object") {
      return null;
    }

    return {
      bookingPayload: {
        pickupLocation: String(bookingPayload.pickupLocation || "").trim(),
        dropLocation: String(bookingPayload.dropLocation || "").trim(),
        fare: Number(bookingPayload.fare) || 0,
        paymentMode: String(bookingPayload.paymentMode || "").trim().toUpperCase(),
        preferredDriverId: bookingPayload.preferredDriverId ?? null,
        preferredDriverName: String(bookingPayload.preferredDriverName || "").trim(),
        paymentReference: String(bookingPayload.paymentReference || "").trim(),
        paymentStatus: String(bookingPayload.paymentStatus || "").trim().toUpperCase() || "PAID",
      },
      bookingMeta: {
        rideTypeLabel: String(parsed.bookingMeta?.rideTypeLabel || "").trim(),
        etaText: String(parsed.bookingMeta?.etaText || "").trim(),
        preferredDriverName: String(parsed.bookingMeta?.preferredDriverName || "").trim(),
        requestedAt: String(parsed.bookingMeta?.requestedAt || ""),
      },
      createdAt: String(parsed.createdAt || ""),
    };
  } catch {
    return null;
  }
}

function savePendingOnlineBooking(bookingPayload, bookingMeta = null) {
  localStorage.setItem(
    PENDING_ONLINE_BOOKING_STORAGE_KEY,
    JSON.stringify({
      bookingPayload,
      bookingMeta,
      createdAt: new Date().toISOString(),
    })
  );
}

function clearPendingOnlineBooking() {
  localStorage.removeItem(PENDING_ONLINE_BOOKING_STORAGE_KEY);
}

function clearPaymentQueryParams() {
  if (typeof window === "undefined") {
    return;
  }

  const url = new URL(window.location.href);
  url.searchParams.delete("payment");
  url.searchParams.delete("session_id");
  const nextQuery = url.searchParams.toString();
  const nextUrl = `${url.pathname}${nextQuery ? `?${nextQuery}` : ""}${url.hash}`;
  window.history.replaceState({}, document.title, nextUrl);
}

function getOnlinePaymentSuccessMessage(paymentMode) {
  return paymentMode === "UPI"
    ? "UPI payment confirmed. Ride booked successfully."
    : "Card payment confirmed. Ride booked successfully.";
}

function buildRideSummary(pickupLocation, dropLocation, rideTypeLabel) {
  const rideLabel = rideTypeLabel ? `${rideTypeLabel} ride` : "Ride";
  return `${rideLabel}: ${pickupLocation} to ${dropLocation}`;
}

export default function RideBookingForm({
  onBook,
  selectedDriver = null,
  quickRoutePreset = null,
  onAutoAssign = null,
}) {
  const [pickup, setPickup] = useState("");
  const [drop, setDrop] = useState("");
  const [rideTypeId, setRideTypeId] = useState("economy");
  const [paymentMode, setPaymentMode] = useState("CASH");
  const [recentRoutes, setRecentRoutes] = useState(readRecentRoutes);
  const [liveLocation, setLiveLocation] = useState(readStoredLiveLocation);
  const [fareEstimate, setFareEstimate] = useState(null);
  const [distanceKm, setDistanceKm] = useState(null);
  const [etaText, setEtaText] = useState("");
  const [fareLoading, setFareLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const geocodeCacheRef = useRef(new Map());
  const paymentResumeKeyRef = useRef("");
  const isEconomyDistanceRestricted = Number.isFinite(distanceKm) && distanceKm > ECONOMY_MAX_DISTANCE_KM;
  const rideTypeOptions = useMemo(
    () => (isEconomyDistanceRestricted ? RIDE_TYPES.filter((option) => option.id !== "economy") : RIDE_TYPES),
    [isEconomyDistanceRestricted]
  );
  const effectiveRideTypeId = isEconomyDistanceRestricted && rideTypeId === "economy" ? "comfort" : rideTypeId;
  const selectedRideType = useMemo(
    () => RIDE_TYPES.find((rideType) => rideType.id === rideTypeId) || RIDE_TYPES[0],
    [rideTypeId]
  );
  const effectiveRideType = useMemo(
    () => RIDE_TYPES.find((rideType) => rideType.id === effectiveRideTypeId) || selectedRideType,
    [effectiveRideTypeId, selectedRideType]
  );
  const selectedPaymentOption = useMemo(
    () => PAYMENT_OPTIONS.find((option) => option.id === paymentMode) || PAYMENT_OPTIONS[0],
    [paymentMode]
  );
  const sanitizedPickup = pickup.trim();
  const sanitizedDrop = drop.trim();
  const hasDistanceEstimate = Number.isFinite(distanceKm);
  const fareDisplay = fareEstimate ? `INR ${toInr(fareEstimate)}` : "Enter valid pickup and destination";
  const estimateBadge = fareLoading ? "Calculating fare..." : etaText ? `ETA ${etaText}` : "Simple estimate";
  const rideTypeChargeLabel =
    effectiveRideType.id === "economy"
      ? "No ride-type surcharge on economy."
      : `INR ${toInr(effectiveRideType.surcharge + PLATFORM_SURCHARGE_INR)} applies on this class.`;
  const fareBreakdown = useMemo(() => {
    if (!Number.isFinite(distanceKm)) {
      return null;
    }

    const safeDistance = Math.max(MIN_DISTANCE_KM, Number(distanceKm) || 0);
    const completedSlabs = Math.floor(safeDistance / FARE_STEP_KM);
    const baseDistanceFare = BASE_FARE_INR + completedSlabs * FARE_STEP_INR;
    const rideTypeFee = getRideTypeSurcharge(effectiveRideTypeId);
    const subtotal = baseDistanceFare + PLATFORM_SURCHARGE_INR + rideTypeFee;
    const total = Number(fareEstimate) || subtotal;
    const liveAdjustment = Math.round(total - subtotal);

    return {
      baseDistanceFare,
      platformFee: PLATFORM_SURCHARGE_INR,
      rideTypeFee,
      liveAdjustment,
      total,
    };
  }, [distanceKm, effectiveRideTypeId, fareEstimate]);

  useEffect(() => {
    if (isEconomyDistanceRestricted && rideTypeId === "economy") {
      setRideTypeId("comfort");
    }
  }, [isEconomyDistanceRestricted, rideTypeId]);

  const resetBookingForm = useCallback(() => {
    setPickup("");
    setDrop("");
    setRideTypeId("economy");
    setPaymentMode("CASH");
    setFareEstimate(null);
    setDistanceKm(null);
    setEtaText("");
  }, []);

  const submitRideBooking = useCallback(
    async (bookingPayload, token, successMessage, bookingMeta = null) => {
      const bookedRide = await apiRequest("/rides/book", "POST", bookingPayload, token);
      persistRideProgressStart(bookedRide);
      persistRideBookingConfirmation(bookedRide, {
        paymentMode: bookingPayload.paymentMode,
        paymentStatus: bookingPayload.paymentStatus,
        rideTypeLabel: bookingMeta?.rideTypeLabel || "",
        etaText: bookingMeta?.etaText || "",
        preferredDriverName: bookingMeta?.preferredDriverName || "",
        requestedAt: bookedRide?.createdAt || bookingMeta?.requestedAt || new Date().toISOString(),
      });
      clearPendingOnlineBooking();
      clearPaymentQueryParams();
      setRecentRoutes(
        saveRecentRoute({
          pickup: bookingPayload.pickupLocation,
          drop: bookingPayload.dropLocation,
        })
      );
      setSuccess(successMessage);
      resetBookingForm();
      onBook?.();
      return bookedRide;
    },
    [onBook, resetBookingForm]
  );

  const startOnlineCheckout = useCallback(
    async (bookingPayload, bookingMeta, rideSummary, token) => {
      const checkoutSession = await apiRequest(
        "/payments/checkout-session",
        "POST",
        {
          amountInInr: Math.max(1, Math.round(Number(bookingPayload.fare) || 0)),
          rideSummary,
          paymentMode: bookingPayload.paymentMode,
        },
        token
      );

      const sessionId = String(checkoutSession?.sessionId || "").trim();
      if (!sessionId) {
        throw new Error("Payment session could not be created.");
      }

      const pendingPayload = {
        ...bookingPayload,
        paymentReference: "",
        paymentStatus: "PAID",
      };
      savePendingOnlineBooking(pendingPayload, bookingMeta);

      if (checkoutSession?.isMock) {
        const mockBookingPayload = {
          ...pendingPayload,
          paymentReference: sessionId,
        };
        savePendingOnlineBooking(mockBookingPayload, bookingMeta);
        await submitRideBooking(
          mockBookingPayload,
          token,
          getOnlinePaymentSuccessMessage(mockBookingPayload.paymentMode),
          bookingMeta
        );
        return;
      }

      const sessionUrl = String(checkoutSession?.sessionUrl || "").trim();
      if (!sessionUrl) {
        clearPendingOnlineBooking();
        throw new Error("Payment session URL is missing.");
      }

      window.location.assign(sessionUrl);
    },
    [submitRideBooking]
  );

  const geocodePlace = useCallback(async (place, signal) => {
    const key = place.trim().toLowerCase();
    if (!key) {
      return null;
    }

    if (geocodeCacheRef.current.has(key)) {
      return geocodeCacheRef.current.get(key);
    }

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(place)}`,
      { signal }
    );
    const data = await response.json();
    if (!Array.isArray(data) || data.length === 0) {
      geocodeCacheRef.current.set(key, null);
      return null;
    }

    const mapped = {
      lat: Number(data[0].lat),
      lon: Number(data[0].lon),
    };
    geocodeCacheRef.current.set(key, mapped);
    return mapped;
  }, []);

  const requestLiveLocationForPickup = () =>
    new Promise((resolve) => {
      if (!navigator.geolocation) {
        resolve(null);
        return;
      }

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
          setPickup(LIVE_PICKUP_LABEL);
          resolve(payload);
        },
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 10000 }
      );
    });

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      const pickupValue = pickup.trim();
      const dropValue = drop.trim();

      if (!pickupValue || !dropValue) {
        if (!cancelled) {
          setFareEstimate(null);
          setDistanceKm(null);
          setEtaText("");
        }
        return;
      }

      if (pickupValue === LIVE_PICKUP_LABEL && !liveLocation) {
        if (!cancelled) {
          setFareEstimate(null);
          setDistanceKm(null);
          setEtaText("");
        }
        return;
      }

      if (!cancelled) {
        setFareLoading(true);
      }

      try {
        const pickupCoordinate =
          pickupValue === LIVE_PICKUP_LABEL ? liveLocation : await geocodePlace(pickupValue, controller.signal);
        const dropCoordinate = await geocodePlace(dropValue, controller.signal);

        if (!pickupCoordinate || !dropCoordinate) {
          if (!cancelled) {
            setFareEstimate(null);
            setDistanceKm(null);
            setEtaText("");
          }
          return;
        }

        const calculatedDistance = Math.max(MIN_DISTANCE_KM, haversineKm(pickupCoordinate, dropCoordinate));

        const effectiveRideTypeId =
          calculatedDistance > ECONOMY_MAX_DISTANCE_KM && rideTypeId === "economy" ? "comfort" : rideTypeId;
        let estimatedFare = buildSimpleFare(calculatedDistance, effectiveRideTypeId);
        let etaRange = "";
        try {
          const estimate = await apiRequest(
            `/rides/estimate?distanceKm=${encodeURIComponent(calculatedDistance.toFixed(2))}&rideType=${encodeURIComponent(effectiveRideTypeId)}`
          );
          const apiFare = Number(estimate?.estimatedFare);
          const etaMin = Number(estimate?.etaMinMinutes);
          const etaMax = Number(estimate?.etaMaxMinutes);
          if (Number.isFinite(apiFare)) {
            estimatedFare = apiFare;
          }
          if (Number.isFinite(etaMin) && Number.isFinite(etaMax)) {
            etaRange = `${etaMin}-${etaMax} min`;
          }
        } catch {
          const etaMinutes = Math.max(6, Math.round((calculatedDistance / 28) * 60) + 4);
          etaRange = `${etaMinutes}-${etaMinutes + 5} min`;
        }

        if (!cancelled) {
          setDistanceKm(calculatedDistance);
          setFareEstimate(estimatedFare);
          setEtaText(etaRange);
        }
      } catch {
        if (!cancelled) {
          setFareEstimate(null);
          setDistanceKm(null);
          setEtaText("");
        }
      } finally {
        if (!cancelled) {
          setFareLoading(false);
        }
      }
    }, 400);

    return () => {
      cancelled = true;
      controller.abort();
      clearTimeout(timer);
    };
  }, [drop, geocodePlace, liveLocation, pickup, rideTypeId]);

  useEffect(() => {
    if (!quickRoutePreset?.pickup || !quickRoutePreset?.drop) {
      return;
    }
    setPickup(quickRoutePreset.pickup);
    setDrop(quickRoutePreset.drop);
    setSuccess(`Route loaded: ${quickRoutePreset.pickup} to ${quickRoutePreset.drop}`);
    onAutoAssign?.();
  }, [onAutoAssign, quickRoutePreset]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const url = new URL(window.location.href);
    const paymentState = String(url.searchParams.get("payment") || "").trim().toLowerCase();
    const sessionId = String(url.searchParams.get("session_id") || "").trim();
    if (!paymentState) {
      return;
    }

    const resumeKey = `${paymentState}:${sessionId}`;
    if (paymentResumeKeyRef.current === resumeKey) {
      return;
    }
    paymentResumeKeyRef.current = resumeKey;

    if (paymentState === "cancel") {
      clearPendingOnlineBooking();
      clearPaymentQueryParams();
      setError("Payment cancelled. No ride booked.");
      setSuccess("");
      return;
    }

    if (paymentState !== "success") {
      clearPaymentQueryParams();
      return;
    }

    if (!sessionId) {
      clearPaymentQueryParams();
      setError("Payment finished, but the session id is missing. Please try again.");
      return;
    }

    const pendingBooking = readPendingOnlineBooking();
    if (!pendingBooking?.bookingPayload) {
      clearPaymentQueryParams();
      setError(`Payment completed, but the pending trip could not be restored. Session: ${sessionId}`);
      return;
    }

    const token = localStorage.getItem("token");
    if (!token) {
      savePendingOnlineBooking({
        ...pendingBooking.bookingPayload,
        paymentReference: sessionId,
        paymentStatus: "PAID",
      }, pendingBooking.bookingMeta);
      setError("Payment completed, but your session expired. Please login again to finish booking.");
      return;
    }

    let cancelled = false;
    const resumeBooking = async () => {
      setLoading(true);
      setError("");
      setSuccess("");

      try {
        const resumedBookingPayload = {
          ...pendingBooking.bookingPayload,
          paymentReference: sessionId,
          paymentStatus: "PAID",
        };
        savePendingOnlineBooking(resumedBookingPayload, pendingBooking.bookingMeta);
        await submitRideBooking(
          resumedBookingPayload,
          token,
          getOnlinePaymentSuccessMessage(resumedBookingPayload.paymentMode),
          pendingBooking.bookingMeta
        );
      } catch (resumeError) {
        if (!cancelled) {
          setPickup(pendingBooking.bookingPayload.pickupLocation || "");
          setDrop(pendingBooking.bookingPayload.dropLocation || "");
          setPaymentMode(pendingBooking.bookingPayload.paymentMode || "CARD");
          if (Number.isFinite(Number(pendingBooking.bookingPayload.fare)) && Number(pendingBooking.bookingPayload.fare) > 0) {
            setFareEstimate(Number(pendingBooking.bookingPayload.fare));
          }
          clearPaymentQueryParams();
          setError(resumeError.message || "Payment completed, but ride booking failed.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void resumeBooking();

    return () => {
      cancelled = true;
    };
  }, [submitRideBooking]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    const token = localStorage.getItem("token");
    if (!token) {
      setError("Please login before booking a ride.");
      return;
    }

    if (isEconomyDistanceRestricted && rideTypeId === "economy") {
      setError("Economy is available only up to 80 km. Please choose another ride type.");
      return;
    }

    if (!fareEstimate) {
      setError("Unable to calculate real fare. Use valid pickup and destination.");
      return;
    }

    setLoading(true);
    try {
      const sanitizedPickup = pickup.trim();
      const sanitizedDrop = drop.trim();

      const bookingPayload = {
        pickupLocation: sanitizedPickup,
        dropLocation: sanitizedDrop,
        fare: fareEstimate,
        paymentMode,
        preferredDriverId: selectedDriver?.id || null,
        preferredDriverName: selectedDriver?.name || "",
        paymentReference: paymentMode === "CASH" ? "CASH" : "",
        paymentStatus: paymentMode === "CASH" ? "PAY_AT_END" : "PAID",
      };
      const bookingMeta = {
        rideTypeLabel: effectiveRideType.label,
        etaText,
        preferredDriverName: selectedDriver?.name || "Auto-assign",
        requestedAt: new Date().toISOString(),
      };

      if (ONLINE_PAYMENT_MODES.has(paymentMode)) {
        const pendingBooking = readPendingOnlineBooking();
        const matchingPaidBooking =
          pendingBooking?.bookingPayload &&
          pendingBooking.bookingPayload.paymentReference &&
          pendingBooking.bookingPayload.pickupLocation === bookingPayload.pickupLocation &&
          pendingBooking.bookingPayload.dropLocation === bookingPayload.dropLocation &&
          Number(pendingBooking.bookingPayload.fare) === Number(bookingPayload.fare) &&
          pendingBooking.bookingPayload.paymentMode === bookingPayload.paymentMode;

        if (matchingPaidBooking) {
          await submitRideBooking(
            {
              ...bookingPayload,
              paymentReference: pendingBooking.bookingPayload.paymentReference,
              paymentStatus: "PAID",
            },
            token,
            getOnlinePaymentSuccessMessage(paymentMode),
            pendingBooking.bookingMeta || bookingMeta
          );
          return;
        }

        await startOnlineCheckout(
          bookingPayload,
          bookingMeta,
          buildRideSummary(sanitizedPickup, sanitizedDrop, effectiveRideType.label),
          token
        );
        return;
      }

      await submitRideBooking(bookingPayload, token, "Ride booked successfully.", bookingMeta);
    } catch (requestError) {
      setError(requestError.message || "Unable to book this ride.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel map-motion-panel relative overflow-hidden border border-white/70 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.96),_rgba(241,245,249,0.92)_46%,_rgba(226,232,240,0.96)_100%)] p-6 shadow-[0_28px_80px_rgba(15,23,42,0.12)] sm:p-8">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-[radial-gradient(circle_at_top_left,_rgba(34,197,94,0.12),_transparent_52%),radial-gradient(circle_at_top_right,_rgba(56,189,248,0.16),_transparent_46%)]" />
      <div className="pointer-events-none absolute -right-10 top-24 h-40 w-40 rounded-full bg-cyan-200/20 blur-3xl" />
      <div className="pointer-events-none absolute -left-12 bottom-0 h-36 w-36 rounded-full bg-amber-200/25 blur-3xl" />

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">Book a ride</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-950 sm:text-[2.2rem]">
              Where do you want to go?
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-600 sm:text-[15px]">
              Build the trip once, compare ride styles faster, and confirm with a cleaner fare summary.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <div className="rounded-full border border-amber-200 bg-amber-50/90 px-4 py-2 text-sm font-semibold text-amber-700 shadow-sm">
              {estimateBadge}
            </div>
            <div className="rounded-full border border-slate-200 bg-white/80 px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm">
              {selectedRideType.label} selected
            </div>
          </div>
        </div>

        <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
          <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.16)] backdrop-blur">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Route inputs</p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">
                  {sanitizedPickup && sanitizedDrop ? `${sanitizedPickup} to ${sanitizedDrop}` : "Pickup and destination"}
                </h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {selectedPaymentOption.accent}
              </span>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                <label htmlFor="pickup" className="block text-sm font-semibold text-slate-700">
                  Pickup
                </label>
                <p className="mt-1 text-xs text-slate-500">Use search or your live location for faster matching.</p>
                <div className="mt-3 flex items-center gap-2">
                  <input
                    id="pickup"
                    type="text"
                    list="india-city-options"
                    value={pickup}
                    onChange={(event) => setPickup(event.target.value)}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100/80"
                    placeholder="Pickup location"
                    required
                  />
                  <button
                    type="button"
                    className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 transition hover:bg-emerald-100"
                    onClick={requestLiveLocationForPickup}
                  >
                    Live
                  </button>
                </div>
              </div>
              <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4">
                <label htmlFor="drop" className="block text-sm font-semibold text-slate-700">
                  Destination
                </label>
                <p className="mt-1 text-xs text-slate-500">Set the destination to unlock fare and ETA.</p>
                <input
                  id="drop"
                  type="text"
                  list="india-city-options"
                  value={drop}
                  onChange={(event) => setDrop(event.target.value)}
                  className="mt-3 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-sky-300 focus:ring-4 focus:ring-sky-100/80"
                  placeholder="Drop location"
                  required
                />
              </div>
            </div>
            <datalist id="india-city-options">
              {ALL_INDIA_CITIES.map((city) => (
                <option key={city} value={city} />
              ))}
            </datalist>

            {recentRoutes.length > 0 && (
              <div className="mt-5 rounded-[1.5rem] border border-emerald-100 bg-emerald-50/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-600">Quick reuse</p>
                    <p className="mt-2 text-sm font-semibold text-slate-900">Recent routes</p>
                  </div>
                  <span className="rounded-full border border-emerald-200 bg-white/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                    {recentRoutes.length} saved
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {recentRoutes.map((route, index) => (
                    <button
                      key={`${route.pickup}-${route.drop}-${index}`}
                      type="button"
                      className="rounded-full border border-emerald-200 bg-white/80 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100"
                      onClick={() => {
                        setPickup(route.pickup);
                        setDrop(route.drop);
                      }}
                    >
                      {route.pickup} to {route.drop}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.16)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Cab style</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">Ride type</h3>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {selectedRideType.accent}
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {rideTypeOptions.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    className={`rounded-[1.5rem] border p-4 text-left transition ${
                      rideTypeId === option.id
                        ? "border-amber-300 bg-[linear-gradient(135deg,rgba(255,251,235,0.96),rgba(255,237,213,0.9))] text-amber-950 shadow-[0_16px_40px_rgba(245,158,11,0.16)]"
                        : "border-slate-200 bg-slate-50/75 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                    onClick={() => setRideTypeId(option.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold">{option.label}</p>
                        <p className="mt-1 text-xs opacity-80">{option.helper}</p>
                      </div>
                      <span
                        className={`rounded-2xl px-3 py-2 text-[11px] font-bold tracking-[0.18em] ${
                          rideTypeId === option.id ? "bg-white/80 text-amber-700" : "bg-white text-slate-500"
                        }`}
                      >
                        {option.accent}
                      </span>
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] opacity-75">
                      {option.id === "economy" ? "No extra charge" : `+INR ${option.surcharge + PLATFORM_SURCHARGE_INR}`}
                    </p>
                  </button>
                ))}
              </div>
              {isEconomyDistanceRestricted && (
                <p className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                  Economy is hidden for rides more than 80 km.
                </p>
              )}
            </section>

            <section className="rounded-[1.75rem] border border-white/80 bg-white/82 p-5 shadow-[0_18px_40px_rgba(148,163,184,0.16)] backdrop-blur">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Checkout</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">Payment mode</h3>
                </div>
                <span className="rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan-700">
                  {selectedPaymentOption.accent}
                </span>
              </div>
              <div className="mt-4 grid gap-3">
                {PAYMENT_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    aria-label={option.label}
                    className={`rounded-[1.5rem] border p-4 text-left transition ${
                      paymentMode === option.id
                        ? "border-cyan-300 bg-[linear-gradient(135deg,rgba(236,254,255,0.96),rgba(224,242,254,0.94))] text-cyan-950 shadow-[0_16px_40px_rgba(14,165,233,0.14)]"
                        : "border-slate-200 bg-slate-50/75 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                    onClick={() => setPaymentMode(option.id)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold">{option.label}</p>
                        <p className="mt-1 text-xs opacity-80">{option.helper}</p>
                      </div>
                      <span
                        className={`rounded-2xl px-3 py-2 text-[11px] font-bold tracking-[0.18em] ${
                          paymentMode === option.id ? "bg-white/80 text-cyan-700" : "bg-white text-slate-500"
                        }`}
                      >
                        {option.accent}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <p className="mt-3 text-xs text-slate-500">
                Selected: <span className="font-semibold text-slate-700">{formatPaymentModeLabel(paymentMode)}</span>
              </p>
            </section>
          </div>

          {paymentMode !== "CASH" && (
            <section className="rounded-[1.75rem] border border-cyan-200/70 bg-cyan-50/70 p-5 shadow-[0_18px_40px_rgba(125,211,252,0.18)]">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-600">
                  {paymentMode === "UPI" ? "UPI checkout" : "Card checkout"}
                </p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">Secure hosted payment</h3>
              </div>
              <div className="mt-4 rounded-[1.5rem] border border-cyan-200 bg-white/75 p-4 text-sm text-slate-700">
                <p className="font-semibold text-slate-900">
                  Confirm this ride to open a secure checkout session.
                </p>
                <p className="mt-2 leading-6">
                  After payment succeeds, you will return here automatically and the ride booking will finish with the
                  verified payment session.
                </p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                  {paymentMode === "UPI"
                    ? "Use your preferred UPI-enabled option on the checkout page."
                    : "Use your card directly on the checkout page."}
                </p>
              </div>
            </section>
          )}

          <section className="rounded-[1.75rem] border border-slate-900/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.03),rgba(255,255,255,0.7))] p-5 shadow-[0_18px_40px_rgba(148,163,184,0.16)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">Fare summary</p>
                <h3 className="mt-2 text-lg font-bold text-slate-900">Estimated fare</h3>
              </div>
              <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                {selectedRideType.accent}
              </span>
            </div>
            <p className="mt-4 text-3xl font-bold tracking-tight text-slate-950">{fareDisplay}</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Distance</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{hasDistanceEstimate ? `${distanceKm.toFixed(1)} km` : "--"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">ETA</p>
                <p className="mt-2 text-lg font-bold text-slate-900">{etaText || "--"}</p>
              </div>
            </div>
            {fareBreakdown && (
              <div className="mt-4 rounded-[1.5rem] border border-slate-200 bg-white/85 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">Fare breakdown</p>
                  <span className="text-xs font-semibold text-slate-500">{effectiveRideType.label}</span>
                </div>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <div className="flex items-center justify-between gap-3">
                    <span>Base route fare</span>
                    <span className="font-semibold text-slate-900">INR {toInr(fareBreakdown.baseDistanceFare)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Platform fee</span>
                    <span className="font-semibold text-slate-900">INR {toInr(fareBreakdown.platformFee)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span>Ride-type surcharge</span>
                    <span className="font-semibold text-slate-900">INR {toInr(fareBreakdown.rideTypeFee)}</span>
                  </div>
                  {fareBreakdown.liveAdjustment !== 0 && (
                    <div className="flex items-center justify-between gap-3">
                      <span>Live pricing adjustment</span>
                      <span className="font-semibold text-slate-900">
                        {fareBreakdown.liveAdjustment > 0 ? "+" : "-"}INR {toInr(Math.abs(fareBreakdown.liveAdjustment))}
                      </span>
                    </div>
                  )}
                </div>
                <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-200 pt-3 text-sm font-bold text-slate-950">
                  <span>Total estimate</span>
                  <span>INR {toInr(fareBreakdown.total)}</span>
                </div>
              </div>
            )}
            <p className="mt-4 text-xs font-semibold text-slate-500">{rideTypeChargeLabel}</p>

            {error && <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>}
            {success && (
              <p className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </p>
            )}

            <button type="submit" className="btn-primary mt-5 w-full" disabled={loading || fareLoading}>
              {loading ? "Processing..." : paymentMode === "CASH" ? "Confirm ride" : "Continue to payment"}
            </button>
          </section>
        </form>
      </div>
    </section>
  );
}
