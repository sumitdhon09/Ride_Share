import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { apiRequest } from "../api";

const MotionDiv = motion.div;
const MotionParagraph = motion.p;

const STATUS_STEPS = [
  { key: "REQUESTED", label: "Requested" },
  { key: "ACCEPTED", label: "Accepted" },
  { key: "PICKED", label: "Picked up" },
  { key: "COMPLETED", label: "Completed" },
];

const STATUS_MESSAGE = {
  REQUESTED: "Looking for the nearest driver.",
  ACCEPTED: "Driver assigned. Head to pickup.",
  PICKED: "Ride in progress.",
  COMPLETED: "Trip completed.",
  CANCELLED: "Trip cancelled.",
};

const BOOK_TO_COMPLETE_MS = 120_000;
const PROGRESS_STARTED_AT_STORAGE_PREFIX = "rideProgressStartedAt:";
const LEGACY_ACCEPTED_AT_STORAGE_PREFIX = "rideAcceptedAt:";
const INDIA_BOUNDS = {
  minLat: 6,
  maxLat: 38.5,
  minLon: 68,
  maxLon: 97.5,
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function isInIndia(lat, lon) {
  return (
    lat >= INDIA_BOUNDS.minLat &&
    lat <= INDIA_BOUNDS.maxLat &&
    lon >= INDIA_BOUNDS.minLon &&
    lon <= INDIA_BOUNDS.maxLon
  );
}

function getTrackingPoint(lat, lon) {
  const parsedLat = Number(lat);
  const parsedLon = Number(lon);
  const hasLiveGps =
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLon) &&
    isInIndia(parsedLat, parsedLon) &&
    !(Math.abs(parsedLat) < 0.00001 && Math.abs(parsedLon) < 0.00001);

  if (!hasLiveGps) {
    return { lat: null, lon: null, hasLiveGps: false };
  }
  return {
    lat: clamp(parsedLat, INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat),
    lon: clamp(parsedLon, INDIA_BOUNDS.minLon, INDIA_BOUNDS.maxLon),
    hasLiveGps: true,
  };
}

function getTrackingMapSrc(point) {
  const boundedLat = clamp(Number(point.lat), INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat);
  const boundedLon = clamp(Number(point.lon), INDIA_BOUNDS.minLon, INDIA_BOUNDS.maxLon);
  const deltaLon = 0.12;
  const deltaLat = 0.08;
  const minLon = clamp(boundedLon - deltaLon, INDIA_BOUNDS.minLon, INDIA_BOUNDS.maxLon);
  const maxLon = clamp(boundedLon + deltaLon, INDIA_BOUNDS.minLon, INDIA_BOUNDS.maxLon);
  const minLat = clamp(boundedLat - deltaLat, INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat);
  const maxLat = clamp(boundedLat + deltaLat, INDIA_BOUNDS.minLat, INDIA_BOUNDS.maxLat);

  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=mapnik&marker=${boundedLat}%2C${boundedLon}`;
}

function getStepClass(index, activeStep, isCompleted = false) {
  if (isCompleted) {
    return "border-emerald-400 bg-emerald-400 text-white";
  }

  const pendingStepClass = [
    "border-sky-300 bg-sky-50 text-sky-700",
    "border-cyan-300 bg-cyan-50 text-cyan-700",
    "border-amber-300 bg-amber-50 text-amber-700",
    "border-emerald-300 bg-emerald-50 text-emerald-700",
  ][index] || "border-slate-300 bg-slate-50 text-slate-600";

  if (index < activeStep) {
    return "border-emerald-400 bg-emerald-400 text-white";
  }
  if (index === activeStep) {
    return "border-amber-400 bg-amber-400 text-slate-900";
  }
  return pendingStepClass;
}

export default function RideStatus({ ride, onComplete }) {
  const token = localStorage.getItem("token") || "";
  const [currentRide, setCurrentRide] = useState(ride || null);
  const [timedProgress, setTimedProgress] = useState(0);
  const [progressStartedAtMs, setProgressStartedAtMs] = useState(null);
  const [cancelReason, setCancelReason] = useState("Plan changed");
  const [cancelError, setCancelError] = useState("");
  const [cancelLoading, setCancelLoading] = useState(false);
  const completeNotifiedRef = useRef(false);

  const fetchRideStatus = useCallback(async () => {
    if (!ride?.id || !token) {
      return;
    }
    try {
      const response = await apiRequest(`/rides/status/${ride.id}`, "GET", null, token);
      setCurrentRide(response || null);
    } catch {
      setCurrentRide((previous) => previous || ride);
    }
  }, [ride, token]);

  useEffect(() => {
    setCurrentRide(ride || null);
  }, [ride]);

  useEffect(() => {
    if (!ride?.id || !token) {
      return;
    }
    fetchRideStatus();
    const interval = setInterval(fetchRideStatus, 8000);
    return () => clearInterval(interval);
  }, [fetchRideStatus, ride, token]);

  useEffect(() => {
    if (currentRide?.status === "COMPLETED" || currentRide?.status === "CANCELLED") {
      if (currentRide?.id) {
        localStorage.removeItem(`${PROGRESS_STARTED_AT_STORAGE_PREFIX}${currentRide.id}`);
        localStorage.removeItem(`${LEGACY_ACCEPTED_AT_STORAGE_PREFIX}${currentRide.id}`);
      }
      if (!completeNotifiedRef.current) {
        completeNotifiedRef.current = true;
        onComplete?.();
      }
      return;
    }
    completeNotifiedRef.current = false;
  }, [currentRide?.id, currentRide?.status, onComplete]);

  useEffect(() => {
    if (!currentRide?.id || !currentRide?.status) {
      setTimedProgress(0);
      setProgressStartedAtMs(null);
      return;
    }

    if (currentRide.status === "COMPLETED") {
      setTimedProgress(100);
      setProgressStartedAtMs(null);
      return;
    }

    if (currentRide.status === "CANCELLED") {
      setTimedProgress(0);
      setProgressStartedAtMs(null);
      return;
    }

    const isActiveTrip =
      currentRide.status === "REQUESTED" || currentRide.status === "ACCEPTED" || currentRide.status === "PICKED";
    if (!isActiveTrip) {
      setTimedProgress(0);
      setProgressStartedAtMs(null);
      return;
    }

    const storageKey = `${PROGRESS_STARTED_AT_STORAGE_PREFIX}${currentRide.id}`;
    const startedFromStorage = Number(localStorage.getItem(storageKey));
    const bookingStartedFromRide = Number(
      new Date(currentRide.createdAt || currentRide.requestedAt || currentRide.bookedAt || "").getTime()
    );
    const legacyAccepted = Number(localStorage.getItem(`${LEGACY_ACCEPTED_AT_STORAGE_PREFIX}${currentRide.id}`));
    const resolvedStartedAt =
      Number.isFinite(startedFromStorage) && startedFromStorage > 0
        ? startedFromStorage
        : Number.isFinite(bookingStartedFromRide) && bookingStartedFromRide > 0
          ? bookingStartedFromRide
          : Number.isFinite(legacyAccepted) && legacyAccepted > 0
            ? legacyAccepted
            : Date.now();

    localStorage.setItem(storageKey, String(resolvedStartedAt));
    setProgressStartedAtMs(resolvedStartedAt);

    const updateProgress = () => {
      const elapsed = Math.max(0, Date.now() - resolvedStartedAt);
      const ratio = Math.min(1, elapsed / BOOK_TO_COMPLETE_MS);
      const next = 10 + ratio * 90;
      setTimedProgress(next);
    };

    updateProgress();
    const interval = setInterval(updateProgress, 1000);
    return () => clearInterval(interval);
  }, [currentRide?.bookedAt, currentRide?.createdAt, currentRide?.id, currentRide?.requestedAt, currentRide?.status]);

  if (!currentRide) {
    return null;
  }

  const activeStep = STATUS_STEPS.findIndex((item) => item.key === currentRide.status);
  const showCountdown =
    (currentRide.status === "REQUESTED" || currentRide.status === "ACCEPTED" || currentRide.status === "PICKED") &&
    progressStartedAtMs;
  const secondsLeft = showCountdown
    ? Math.max(0, Math.ceil((progressStartedAtMs + BOOK_TO_COMPLETE_MS - Date.now()) / 1000))
    : 0;
  const canCancel =
    /^(\d+)$/.test(String(currentRide.id || "")) &&
    (currentRide.status === "REQUESTED" || currentRide.status === "ACCEPTED" || currentRide.status === "PICKED");
  const trackingPoint = getTrackingPoint(currentRide.driverLat, currentRide.driverLon);
  const showDriverTracking = currentRide.status === "ACCEPTED" || currentRide.status === "PICKED";
  const reduceMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const normalizedActiveStep = activeStep < 0 ? 0 : activeStep;
  const isCancelled = currentRide.status === "CANCELLED";
  const timelineActiveStep = isCancelled ? -1 : normalizedActiveStep;
  const statusStepProgress =
    isCancelled
      ? 0
      : currentRide.status === "COMPLETED"
        ? 100
        : (normalizedActiveStep / (STATUS_STEPS.length - 1)) * 100;

  const handleCancelRide = async () => {
    if (!canCancel) {
      return;
    }
    setCancelError("");
    setCancelLoading(true);
    try {
      const response = await apiRequest(
        `/rides/cancel/${currentRide.id}`,
        "POST",
        { reason: cancelReason.trim() },
        token
      );
      setCurrentRide(response || currentRide);
    } catch (requestError) {
      setCancelError(requestError.message || "Unable to cancel this ride.");
    } finally {
      setCancelLoading(false);
    }
  };

  return (
    <section className="glass-panel p-6 sm:p-8">
      <h2 className="text-2xl font-bold text-slate-900">Current ride</h2>
      <AnimatePresence mode="wait" initial={false}>
        <MotionParagraph
          key={currentRide.status || "UNKNOWN"}
          className="mt-2 text-sm text-slate-600"
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {STATUS_MESSAGE[currentRide.status] || "Tracking your trip status."}
        </MotionParagraph>
      </AnimatePresence>

      <div className="mt-4">
        <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-slate-500">
          <span>Trip progress</span>
          <span>{Math.round(timedProgress)}%</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200">
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-500 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, timedProgress))}%` }}
          />
        </div>
        {showCountdown && (
          <p className="mt-2 text-xs font-semibold text-slate-600">
            Progress completes in 2 minutes after booking. {secondsLeft}s left.
          </p>
        )}
      </div>

      {(currentRide.status === "ACCEPTED" || currentRide.status === "PICKED") && (
        <div className="mt-4 grid gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Pickup OTP</p>
            <p className="mt-1 text-xl font-extrabold text-cyan-900">{currentRide.startOtp || "----"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Complete OTP</p>
            <p className="mt-1 text-xl font-extrabold text-cyan-900">{currentRide.endOtp || "----"}</p>
          </div>
        </div>
      )}

      {showDriverTracking && trackingPoint.hasLiveGps && (
        <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-bold text-slate-900">Driver live tracking</p>
            <p className="text-xs font-semibold text-slate-600">
              {trackingPoint.lat.toFixed(5)}, {trackingPoint.lon.toFixed(5)}
            </p>
          </div>
          <iframe
            title="Driver live tracking map"
            className="mt-3 h-56 w-full rounded-xl border border-slate-200"
            src={getTrackingMapSrc(trackingPoint)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
      {showDriverTracking && !trackingPoint.hasLiveGps && (
        <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-sm font-semibold text-amber-800">
            Waiting for driver live location.
          </p>
          <p className="mt-1 text-xs text-amber-700">
            Map will appear once driver allows location access and starts sharing GPS.
          </p>
        </div>
      )}

      <div className="mt-6">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          <span>Status timeline</span>
          <span>{currentRide.status || "-"}</span>
        </div>
        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-200">
          <MotionDiv
            className="h-full rounded-full bg-gradient-to-r from-sky-400 via-cyan-400 to-emerald-500"
            initial={false}
            animate={{ width: `${Math.max(0, Math.min(100, statusStepProgress))}%` }}
            transition={reduceMotion ? { duration: 0 } : { duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>

        <div className="mt-3 grid gap-2 sm:grid-cols-4">
          {STATUS_STEPS.map((step, index) => {
            const isComplete = currentRide.status === "COMPLETED" || index < timelineActiveStep;
            const isActive = !isCancelled && currentRide.status !== "COMPLETED" && index === timelineActiveStep;

            return (
              <MotionDiv
                key={step.key}
                className="flex items-center gap-2 sm:flex-col sm:items-start"
                initial={false}
                animate={
                  isActive && !reduceMotion
                    ? { y: [0, -2, 0] }
                    : { y: 0 }
                }
                transition={
                  isActive && !reduceMotion
                    ? { duration: 0.9, repeat: Infinity, ease: [0.22, 1, 0.36, 1] }
                    : { duration: 0.2 }
                }
              >
                <span
                  className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold ${
                    isActive ? "ride-status-step__dot--active" : ""
                  } ${getStepClass(index, timelineActiveStep, currentRide.status === "COMPLETED")}`}
                >
                  {index + 1}
                </span>
                <p className={`text-sm font-semibold ${isComplete || isActive ? "text-slate-900" : "text-slate-400"}`}>
                  {step.label}
                </p>
              </MotionDiv>
            );
          })}
        </div>
      </div>

      <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pickup</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{currentRide.pickupLocation || "-"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Destination</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{currentRide.dropLocation || "-"}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Fare</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">INR {Number(currentRide.fare || 0).toFixed(0)}</p>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Status</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{currentRide.status || "-"}</p>
        </div>
        {currentRide.status === "CANCELLED" && (
          <>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cancelled by</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{currentRide.cancelledBy || "-"}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cancellation fee</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                INR {Number(currentRide.cancellationFee || 0).toFixed(0)}
              </p>
            </div>
          </>
        )}
      </div>

      {canCancel && (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
          <p className="text-sm font-bold text-rose-800">Cancel ride</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr,auto]">
            <select
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              className="rounded-xl border border-rose-200 bg-white px-3 py-2 text-rose-900"
            >
              <option>Plan changed</option>
              <option>Driver taking too long</option>
              <option>Booked by mistake</option>
              <option>Pickup issue</option>
            </select>
            <button type="button" className="btn-secondary" onClick={handleCancelRide} disabled={cancelLoading}>
              {cancelLoading ? "Cancelling..." : "Cancel ride"}
            </button>
          </div>
          <p className="mt-2 text-xs font-semibold text-rose-700">
            Cancellation fee rule: REQUESTED INR 0, ACCEPTED 20%, PICKED 40% (with limits).
          </p>
          {cancelError && (
            <p className="mt-2 rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-700">{cancelError}</p>
          )}
        </div>
      )}
    </section>
  );
}
