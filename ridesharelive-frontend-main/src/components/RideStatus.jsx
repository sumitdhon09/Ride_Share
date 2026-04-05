import { useCallback, useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
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

  return `https://www.openstreetmap.org/export/embed.html?bbox=${minLon}%2C${minLat}%2C${maxLon}%2C${maxLat}&layer=hotosm&marker=${boundedLat}%2C${boundedLon}`;
}

function getStepClass(index, activeStep, isCompleted = false, isDarkTheme = false) {
  if (isCompleted) {
    return "border-emerald-400 bg-emerald-400 text-white";
  }

  const pendingStepClass = isDarkTheme
    ? [
        "border-sky-400/24 bg-sky-400/10 text-sky-200",
        "border-cyan-400/24 bg-cyan-400/10 text-cyan-200",
        "border-amber-400/24 bg-amber-400/10 text-amber-200",
        "border-emerald-400/24 bg-emerald-400/10 text-emerald-200",
      ][index] || "border-white/10 bg-white/[0.05] text-slate-400"
    : [
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

export default function RideStatus({ ride, onComplete, theme = "light" }) {
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
  const isDarkTheme = theme === "dark";
  const rootClass = isDarkTheme
    ? "glass-panel border border-white/10 bg-[linear-gradient(145deg,rgba(2,6,23,0.94),rgba(15,23,42,0.92),rgba(15,23,42,0.88))] p-6 shadow-[0_28px_60px_-42px_rgba(2,6,23,0.9)] sm:p-8"
    : "glass-panel p-6 sm:p-8";
  const titleClass = isDarkTheme ? "text-2xl font-bold text-slate-50" : "text-2xl font-bold text-slate-900";
  const bodyClass = isDarkTheme ? "mt-2 text-sm text-slate-300" : "mt-2 text-sm text-slate-600";
  const helperMutedClass = isDarkTheme ? "text-slate-400" : "text-slate-500";
  const helperStrongClass = isDarkTheme ? "text-slate-100" : "text-slate-900";
  const progressTrackClass = isDarkTheme ? "mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/[0.08]" : "mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-200";
  const trackingCardClass = isDarkTheme
    ? "mt-4 rounded-2xl border border-white/10 bg-white/[0.05] p-3 shadow-sm"
    : "mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm";
  const routeMetaClass = isDarkTheme
    ? "mt-6 grid gap-4 rounded-2xl border border-white/10 bg-white/[0.05] p-4 sm:grid-cols-2"
    : "mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white/80 p-4 sm:grid-cols-2";
  const cancelPanelShell = isDarkTheme
    ? "relative mt-6 overflow-hidden rounded-[1.65rem] border border-rose-500/30 bg-[linear-gradient(152deg,rgba(225,29,72,0.16)_0%,rgba(30,27,75,0.35)_32%,rgba(15,23,42,0.94)_58%,rgba(15,23,42,0.92)_100%)] p-5 shadow-[0_28px_64px_-36px_rgba(225,29,72,0.55)] backdrop-blur-xl ring-1 ring-inset ring-white/[0.07] sm:p-6"
    : "relative mt-6 overflow-hidden rounded-[1.65rem] border border-[#f2d2ca] bg-[linear-gradient(165deg,#fffdfc_0%,#fff4ef_48%,#fff8f3_100%)] p-5 shadow-[0_24px_56px_-40px_rgba(168,63,42,0.2),0_1px_0_rgba(255,255,255,0.94)_inset] ring-1 ring-[#f8e2db] sm:p-6";
  const cancelGlowClass = isDarkTheme ? "bg-rose-500/25" : "bg-[rgba(232,148,128,0.34)]";
  const cancelIconWrapClass = isDarkTheme
    ? "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-rose-400/25 bg-rose-500/12 text-rose-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
    : "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-[#f0d1c8] bg-[#fffaf7] text-[#bc4b39] shadow-[0_12px_28px_-22px_rgba(188,75,57,0.38)]";
  const cancelEyebrowClass = isDarkTheme ? "text-[11px] font-semibold uppercase tracking-[0.2em] text-rose-300/95" : "text-[11px] font-semibold uppercase tracking-[0.2em] text-[#bc4b39]";
  const cancelTitleClass = isDarkTheme ? "text-lg font-bold tracking-tight text-slate-50" : "text-lg font-bold tracking-tight text-slate-900";
  const cancelSubtitleClass = isDarkTheme ? "mt-1 text-sm leading-relaxed text-slate-400" : "mt-1 text-sm leading-relaxed text-slate-600";
  const cancelLabelClass = isDarkTheme ? "text-xs font-semibold text-slate-400" : "text-xs font-semibold text-slate-500";
  const cancelSelectClass = isDarkTheme
    ? "w-full cursor-pointer appearance-none rounded-xl border border-white/14 bg-slate-950/85 bg-[length:1rem] bg-[right_0.75rem_center] bg-no-repeat px-3.5 py-3 pr-10 text-sm text-slate-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none transition focus:border-rose-400/45 focus:ring-2 focus:ring-rose-500/30 [&>option]:bg-slate-950 [&>option]:text-slate-100"
    : "w-full cursor-pointer appearance-none rounded-xl border border-[#eadad5] bg-white px-3.5 py-3 pr-10 text-sm text-slate-800 shadow-sm outline-none transition focus:border-[#cd715f] focus:ring-2 focus:ring-[#f4cdc4] [&>option]:bg-white [&>option]:text-slate-900";
  const cancelFeeNoteClass = isDarkTheme
    ? "rounded-xl border border-white/10 bg-black/30 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-slate-400"
    : "rounded-xl border border-[#f0ddd7] bg-white/85 px-3.5 py-2.5 text-xs font-medium leading-relaxed text-slate-600";
  const cancelErrorClass = isDarkTheme
    ? "mt-3 rounded-xl border border-rose-400/35 bg-rose-950/50 px-3.5 py-2.5 text-sm font-medium text-rose-100"
    : "mt-3 rounded-xl border border-[#efc7bf] bg-[#fff3ef] px-3.5 py-2.5 text-sm font-medium text-[#9f3326]";
  const otpCardClass = isDarkTheme
    ? "mt-4 grid gap-3 rounded-2xl border border-cyan-400/18 bg-[linear-gradient(145deg,rgba(34,211,238,0.12),rgba(8,47,73,0.22),rgba(15,23,42,0.68))] p-4 shadow-[0_20px_44px_-34px_rgba(34,211,238,0.3)] sm:grid-cols-2"
    : "mt-4 grid gap-3 rounded-2xl border border-cyan-200 bg-cyan-50 p-4 sm:grid-cols-2";
  const otpLabelClass = isDarkTheme
    ? "text-xs font-semibold uppercase tracking-wide text-cyan-200"
    : "text-xs font-semibold uppercase tracking-wide text-cyan-700";
  const otpValueClass = isDarkTheme ? "mt-1 text-xl font-extrabold text-cyan-50" : "mt-1 text-xl font-extrabold text-cyan-900";
  const waitingCardClass = isDarkTheme
    ? "mt-4 rounded-2xl border border-amber-400/18 bg-[linear-gradient(145deg,rgba(251,191,36,0.08),rgba(120,53,15,0.18),rgba(15,23,42,0.68))] p-3"
    : "mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3";
  const waitingTitleClass = isDarkTheme ? "text-sm font-semibold text-amber-100" : "text-sm font-semibold text-amber-800";
  const waitingBodyClass = isDarkTheme ? "mt-1 text-xs text-amber-200/90" : "mt-1 text-xs text-amber-700";
  const cancelButtonClass = isDarkTheme
    ? "inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-gradient-to-b from-rose-500 to-rose-700 px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-12px_rgba(225,29,72,0.65)] transition hover:from-rose-400 hover:to-rose-600 hover:shadow-[0_16px_32px_-12px_rgba(225,29,72,0.55)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-rose-500 disabled:hover:to-rose-700 sm:w-auto sm:min-w-[10.5rem]"
    : "inline-flex min-h-[3rem] w-full items-center justify-center rounded-xl bg-gradient-to-b from-[#d76450] to-[#bc4635] px-5 text-sm font-semibold text-white shadow-[0_12px_28px_-14px_rgba(188,70,53,0.42)] transition hover:from-[#ca5a47] hover:to-[#ae3d2d] hover:shadow-[0_16px_34px_-14px_rgba(188,70,53,0.38)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:from-[#d76450] disabled:hover:to-[#bc4635] sm:w-auto sm:min-w-[10.5rem]";

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
    <section className={rootClass}>
      <h2 className={titleClass}>Current ride</h2>
      <AnimatePresence mode="wait" initial={false}>
        <MotionParagraph
          key={currentRide.status || "UNKNOWN"}
          className={bodyClass}
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -6 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
        >
          {STATUS_MESSAGE[currentRide.status] || "Tracking your trip status."}
        </MotionParagraph>
      </AnimatePresence>

      <div className="mt-4">
        <div className={`flex items-center justify-between text-xs font-semibold uppercase tracking-wide ${helperMutedClass}`}>
          <span>Trip progress</span>
          <span>{Math.round(timedProgress)}%</span>
        </div>
        <div className={progressTrackClass}>
          <div
            className="h-full rounded-full bg-gradient-to-r from-amber-400 via-cyan-400 to-emerald-500 transition-all duration-700"
            style={{ width: `${Math.min(100, Math.max(0, timedProgress))}%` }}
          />
        </div>
        {showCountdown && (
          <p className={`mt-2 text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
            Progress completes in 2 minutes after booking. {secondsLeft}s left.
          </p>
        )}
      </div>

      {(currentRide.status === "ACCEPTED" || currentRide.status === "PICKED") && (
        <div className={otpCardClass}>
          <div>
            <p className={otpLabelClass}>Pickup OTP</p>
            <p className={otpValueClass}>{currentRide.startOtp || "----"}</p>
          </div>
          <div>
            <p className={otpLabelClass}>Complete OTP</p>
            <p className={otpValueClass}>{currentRide.endOtp || "----"}</p>
          </div>
        </div>
      )}

      {showDriverTracking && trackingPoint.hasLiveGps && (
        <div className={trackingCardClass}>
          <div className="flex items-center justify-between gap-2">
            <p className={`text-sm font-bold ${helperStrongClass}`}>Driver live tracking</p>
            <p className={`text-xs font-semibold ${isDarkTheme ? "text-slate-300" : "text-slate-600"}`}>
              {trackingPoint.lat.toFixed(5)}, {trackingPoint.lon.toFixed(5)}
            </p>
          </div>
          <iframe
            title="Driver live tracking map"
            className={`mt-3 h-56 w-full rounded-xl border ${isDarkTheme ? "border-white/10" : "border-slate-200"}`}
            src={getTrackingMapSrc(trackingPoint)}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
          />
        </div>
      )}
      {showDriverTracking && !trackingPoint.hasLiveGps && (
        <div className={waitingCardClass}>
          <p className={waitingTitleClass}>
            Waiting for driver live location.
          </p>
          <p className={waitingBodyClass}>
            Map will appear once driver allows location access and starts sharing GPS.
          </p>
        </div>
      )}

      <div className="mt-6">
        <div className={`flex items-center justify-between text-[11px] font-semibold uppercase tracking-wide ${helperMutedClass}`}>
          <span>Status timeline</span>
          <span>{currentRide.status || "-"}</span>
        </div>
        <div className={`mt-2 h-2 w-full overflow-hidden rounded-full ${isDarkTheme ? "bg-white/[0.08]" : "bg-slate-200"}`}>
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
                  } ${getStepClass(index, timelineActiveStep, currentRide.status === "COMPLETED", isDarkTheme)}`}
                >
                  {index + 1}
                </span>
                <p className={`text-sm font-semibold ${
                  isComplete || isActive ? (isDarkTheme ? "text-slate-100" : "text-slate-900") : (isDarkTheme ? "text-slate-500" : "text-slate-400")
                }`}>
                  {step.label}
                </p>
              </MotionDiv>
            );
          })}
        </div>
      </div>

      <div className={routeMetaClass}>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${helperMutedClass}`}>Pickup</p>
          <p className={`mt-1 text-sm font-semibold ${helperStrongClass}`}>{currentRide.pickupLocation || "-"}</p>
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${helperMutedClass}`}>Destination</p>
          <p className={`mt-1 text-sm font-semibold ${helperStrongClass}`}>{currentRide.dropLocation || "-"}</p>
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${helperMutedClass}`}>Fare</p>
          <p className={`mt-1 text-sm font-semibold ${helperStrongClass}`}>INR {Number(currentRide.fare || 0).toFixed(0)}</p>
        </div>
        <div>
          <p className={`text-xs font-semibold uppercase tracking-wide ${helperMutedClass}`}>Status</p>
          <p className={`mt-1 text-sm font-semibold ${helperStrongClass}`}>{currentRide.status || "-"}</p>
        </div>
        {currentRide.status === "CANCELLED" && (
          <>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${helperMutedClass}`}>Cancelled by</p>
              <p className={`mt-1 text-sm font-semibold ${helperStrongClass}`}>{currentRide.cancelledBy || "-"}</p>
            </div>
            <div>
              <p className={`text-xs font-semibold uppercase tracking-wide ${helperMutedClass}`}>Cancellation fee</p>
              <p className={`mt-1 text-sm font-semibold ${helperStrongClass}`}>
                INR {Number(currentRide.cancellationFee || 0).toFixed(0)}
              </p>
            </div>
          </>
        )}
      </div>

      {canCancel && (
        <MotionDiv
          initial={reduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={reduceMotion ? { duration: 0 } : { duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={cancelPanelShell}
        >
          <div
            className={`pointer-events-none absolute -right-6 -top-14 h-36 w-36 rounded-full blur-3xl ${cancelGlowClass}`}
            aria-hidden
          />
          <div className="relative flex flex-col gap-4">
            <div className="flex gap-3.5">
              <span className={cancelIconWrapClass}>
                <AlertTriangle className="h-5 w-5" strokeWidth={2.25} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className={cancelEyebrowClass}>End trip</p>
                <h3 className={`mt-1 ${cancelTitleClass}`}>Cancel this ride</h3>
                <p className={cancelSubtitleClass}>
                  Pick a reason. Cancellation fees depend on how far the trip has progressed.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
              <label className="grid gap-1.5">
                <span className={cancelLabelClass}>Reason for cancelling</span>
                <select
                  value={cancelReason}
                  onChange={(event) => setCancelReason(event.target.value)}
                  className={`${cancelSelectClass} ${isDarkTheme ? "[background-image:url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20stroke%3D%22%23fda4af%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')]" : "[background-image:url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2220%22%20height%3D%2220%22%20fill%3D%22none%22%20stroke%3D%22%23bc4b39%22%20stroke-width%3D%222%22%3E%3Cpath%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')]"}`}
                >
                  <option>Plan changed</option>
                  <option>Driver taking too long</option>
                  <option>Booked by mistake</option>
                  <option>Pickup issue</option>
                </select>
              </label>
              <button type="button" className={cancelButtonClass} onClick={handleCancelRide} disabled={cancelLoading}>
                {cancelLoading ? "Cancelling…" : "Confirm cancel"}
              </button>
            </div>

            <p className={cancelFeeNoteClass}>
              <span className={isDarkTheme ? "text-rose-200/90" : "text-[#bc4b39]"}>Fee guide: </span>
              REQUESTED — no fee · ACCEPTED — up to 20% of fare · PICKED — up to 40% (capped by policy).
            </p>
            {cancelError ? <p className={cancelErrorClass}>{cancelError}</p> : null}
          </div>
        </MotionDiv>
      )}
    </section>
  );
}
