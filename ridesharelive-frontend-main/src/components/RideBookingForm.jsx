import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import { ALL_INDIA_CITIES } from "../data/indiaCities";
import { formatPaymentModeLabel } from "../utils/paymentPresentation";

const RIDE_TYPES = [
  { id: "economy", label: "Economy", surcharge: 0 },
  { id: "comfort", label: "Comfort", surcharge: 50 },
  { id: "xl", label: "XL", surcharge: 150 },
  { id: "premium", label: "Premium", surcharge: 200 },
];

const PAYMENT_OPTIONS = [
  { id: "CASH", label: "Cash" },
  { id: "CARD", label: "Card" },
  { id: "UPI", label: "UPI" },
];

const LIVE_PICKUP_LABEL = "Current Live Location";
const BASE_FARE_INR = 60;
const FARE_STEP_KM = 40;
const FARE_STEP_INR = 50;
const MIN_DISTANCE_KM = 0;
const PLATFORM_SURCHARGE_INR = 50;
const ECONOMY_MAX_DISTANCE_KM = 80;
const RIDE_PROGRESS_STARTED_AT_STORAGE_PREFIX = "rideProgressStartedAt:";
const UPI_ID_PATTERN = /^[a-zA-Z0-9._-]{2,}@[a-zA-Z]{2,}$/;

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
  const [upiId, setUpiId] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExpiry, setCardExpiry] = useState("");
  const [cardCvv, setCardCvv] = useState("");
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
  const isEconomyDistanceRestricted = Number.isFinite(distanceKm) && distanceKm > ECONOMY_MAX_DISTANCE_KM;
  const rideTypeOptions = useMemo(
    () => (isEconomyDistanceRestricted ? RIDE_TYPES.filter((option) => option.id !== "economy") : RIDE_TYPES),
    [isEconomyDistanceRestricted]
  );

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
    setUpiId("");
    setCardHolder("");
    setCardNumber("");
    setCardExpiry("");
    setCardCvv("");
    setFareEstimate(null);
    setDistanceKm(null);
    setEtaText("");
  }, []);

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

    const normalizedUpi = upiId.trim();
    if (paymentMode === "UPI" && !normalizedUpi) {
      setError("Please enter your UPI ID.");
      return;
    }
    if (paymentMode === "UPI" && !UPI_ID_PATTERN.test(normalizedUpi)) {
      setError("Enter a valid-looking UPI ID, for example name@bank.");
      return;
    }

    const normalizedCardHolder = cardHolder.trim();
    const normalizedCardNumber = cardNumber.replace(/\s+/g, "");
    const normalizedCardExpiry = cardExpiry.trim();
    const normalizedCardCvv = cardCvv.trim();

    if (paymentMode === "CARD") {
      if (!normalizedCardHolder) {
        setError("Please enter the card holder name.");
        return;
      }
      if (!/^\d{16}$/.test(normalizedCardNumber)) {
        setError("Enter a dummy 16-digit card number.");
        return;
      }
      if (!/^\d{2}\/\d{2}$/.test(normalizedCardExpiry)) {
        setError("Enter card expiry in MM/YY format.");
        return;
      }
      if (!/^\d{3}$/.test(normalizedCardCvv)) {
        setError("Enter a dummy 3-digit CVV.");
        return;
      }
    }

    setLoading(true);
    try {
      const sanitizedPickup = pickup.trim();
      const sanitizedDrop = drop.trim();
      const paymentReference =
        paymentMode === "CARD"
          ? `DUMMY-CARD-${normalizedCardNumber.slice(-4)}`
          : paymentMode === "UPI"
            ? `DUMMY-UPI-${normalizedUpi}`
            : "Cash";

      const bookingPayload = {
        pickupLocation: sanitizedPickup,
        dropLocation: sanitizedDrop,
        fare: fareEstimate,
        paymentMode,
        preferredDriverId: selectedDriver?.id || null,
        preferredDriverName: selectedDriver?.name || "",
        paymentReference,
        paymentStatus: paymentMode === "CASH" ? "PENDING" : "PAID",
      };

      const bookedRide = await apiRequest(
        "/rides/book",
        "POST",
        bookingPayload,
        token
      );
      persistRideProgressStart(bookedRide);

      setRecentRoutes(saveRecentRoute({ pickup: sanitizedPickup, drop: sanitizedDrop }));
      setSuccess(
        paymentMode === "CASH"
          ? "Ride booked successfully."
          : `Dummy ${paymentMode === "CARD" ? "card" : "UPI"} payment accepted. Ride booked successfully.`
      );
      resetBookingForm();
      onBook?.();
    } catch (requestError) {
      setError(requestError.message || "Unable to book this ride.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass-panel map-motion-panel p-6 sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Book a ride</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-900">Where do you want to go?</h2>
        </div>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
          {fareLoading ? "Calculating fare..." : `Simple estimate ${etaText ? `| ETA ${etaText}` : ""}`}
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="pickup" className="mb-1 block text-sm font-semibold text-slate-700">
              Pickup
            </label>
            <div className="flex items-center gap-2">
              <input
                id="pickup"
                type="text"
                list="india-city-options"
                value={pickup}
                onChange={(event) => setPickup(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
                placeholder="Pickup location"
                required
              />
              <button
                type="button"
                className="btn-secondary !rounded-xl !px-3 !py-2 text-xs"
                onClick={requestLiveLocationForPickup}
              >
                Live
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="drop" className="mb-1 block text-sm font-semibold text-slate-700">
              Destination
            </label>
            <input
              id="drop"
              type="text"
              list="india-city-options"
              value={drop}
              onChange={(event) => setDrop(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-amber-400 focus:ring-2 focus:ring-amber-100"
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
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Recent routes</p>
            <div className="flex flex-wrap gap-2">
              {recentRoutes.map((route, index) => (
                <button
                  key={`${route.pickup}-${route.drop}-${index}`}
                  type="button"
                  className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
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

        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Ride type</p>
            <div className="grid grid-cols-2 gap-2">
              {rideTypeOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-left text-sm transition ${
                    rideTypeId === option.id
                      ? "border-amber-400 bg-amber-50 text-amber-800"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                  onClick={() => setRideTypeId(option.id)}
                >
                  <p className="font-bold">{option.label}</p>
                  <p className="text-xs opacity-80">
                    {option.id === "economy"
                      ? "No extra charge"
                      : `+INR ${option.surcharge + PLATFORM_SURCHARGE_INR}`}
                  </p>
                </button>
              ))}
            </div>
            {isEconomyDistanceRestricted && (
              <p className="mt-2 text-xs font-semibold text-amber-700">
                Economy is hidden for rides more than 80 km.
              </p>
            )}
          </div>
          <div>
            <p className="mb-2 text-sm font-semibold text-slate-700">Payment mode</p>
            <div className="grid grid-cols-3 gap-2">
              {PAYMENT_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                    paymentMode === option.id
                      ? "border-cyan-400 bg-cyan-50 text-cyan-900"
                      : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                  }`}
                  onClick={() => setPaymentMode(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-slate-500">
              Selected: <span className="font-semibold text-slate-700">{formatPaymentModeLabel(paymentMode)}</span>
            </p>
          </div>
        </div>

        {paymentMode === "CARD" && (
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="cardHolder" className="mb-1 block text-sm font-semibold text-slate-700">
                Card holder
              </label>
              <input
                id="cardHolder"
                type="text"
                value={cardHolder}
                onChange={(event) => setCardHolder(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="Dummy card holder name"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="cardNumber" className="mb-1 block text-sm font-semibold text-slate-700">
                Card number
              </label>
              <input
                id="cardNumber"
                type="text"
                inputMode="numeric"
                value={cardNumber}
                onChange={(event) => setCardNumber(event.target.value.replace(/\D/g, "").slice(0, 16))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="4242424242424242"
              />
            </div>
            <div>
              <label htmlFor="cardExpiry" className="mb-1 block text-sm font-semibold text-slate-700">
                Expiry
              </label>
              <input
                id="cardExpiry"
                type="text"
                value={cardExpiry}
                onChange={(event) => {
                  const digits = event.target.value.replace(/\D/g, "").slice(0, 4);
                  const formatted = digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
                  setCardExpiry(formatted);
                }}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="12/28"
              />
            </div>
            <div>
              <label htmlFor="cardCvv" className="mb-1 block text-sm font-semibold text-slate-700">
                CVV
              </label>
              <input
                id="cardCvv"
                type="password"
                inputMode="numeric"
                value={cardCvv}
                onChange={(event) => setCardCvv(event.target.value.replace(/\D/g, "").slice(0, 3))}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
                placeholder="123"
              />
            </div>
            <div className="sm:col-span-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-semibold text-cyan-800">
              Dummy card payment only. Use any 16-digit test number with any future-looking MM/YY and 3-digit CVV.
            </div>
          </div>
        )}

        {paymentMode === "UPI" && (
          <div>
            <label htmlFor="upiId" className="mb-1 block text-sm font-semibold text-slate-700">
              UPI ID
            </label>
            <input
              id="upiId"
              type="text"
              value={upiId}
              onChange={(event) => setUpiId(event.target.value)}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-100"
              placeholder="Enter UPI ID, e.g. name@bank"
            />
            <p className="mt-2 rounded-2xl border border-cyan-200 bg-cyan-50 px-4 py-3 text-xs font-semibold text-cyan-800">
              Dummy UPI payment only. Enter any valid-looking UPI ID and the ride will be marked as paid.
            </p>
          </div>
        )}

        <div className="map-node rounded-2xl border border-slate-200 bg-white/80 p-4">
          <p className="text-sm text-slate-600">Estimated fare</p>
          <p className="text-2xl font-bold text-slate-900">
            {fareEstimate ? `INR ${toInr(fareEstimate)}` : "Enter valid pickup and destination"}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Fare rule: INR 60 base, +INR 50 every 40 km, +INR 50 on every ride, plus ride type surcharge.
          </p>
          {distanceKm && (
            <p className="mt-1 text-sm text-slate-600">
              Distance: {distanceKm.toFixed(1)} km {etaText ? `| ETA: ${etaText}` : ""}
            </p>
          )}
        </div>

        {error && <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p>}
        {success && (
          <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <button type="submit" className="btn-primary w-full" disabled={loading || fareLoading}>
          {loading ? "Booking..." : "Confirm ride"}
        </button>
      </form>
    </section>
  );
}
