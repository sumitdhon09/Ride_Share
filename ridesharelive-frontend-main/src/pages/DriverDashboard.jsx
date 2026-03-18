import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "../api";
import CountUpNumber from "../components/CountUpNumber";
import LiveUpdateToast from "../components/LiveUpdateToast";
import PredictiveInsightsPanel from "../components/PredictiveInsightsPanel";
import RideFeedbackPanel from "../components/RideFeedbackPanel";
import LiveMapPanel from "../components/LiveMapPanel";
import RideHistory from "../components/RideHistory";
import { formatPaymentModeLabel } from "../utils/paymentPresentation";

const DUMMY_ROUTE_DISTANCES_KM = [12, 24, 36, 48, 58];

function generateLocalOtp() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function isServerRideId(rideId) {
  if (typeof rideId === "number") {
    return Number.isFinite(rideId);
  }
  return /^\d+$/.test(String(rideId || "").trim());
}

function buildDummyRides() {
  const routes = [
    { pickup: "Multai Bus Stand, MP", drop: "Amla Railway Station, MP" },
    { pickup: "Multai Market, MP", drop: "Betul City Center, MP" },
    { pickup: "Betul City Center, MP", drop: "Chicholi, Betul, MP" },
    { pickup: "Amla Railway Station, MP", drop: "Pandhurna Bus Stand, MP" },
    { pickup: "Pandhurna Bus Stand, MP", drop: "Warud Market, Maharashtra" },
  ];

  return routes.map((route, index) => {
    const distanceKm = DUMMY_ROUTE_DISTANCES_KM[index] || 20;
    const fare = 60 + Math.floor(distanceKm / 40) * 50;
    return {
      id: `local-ride-${index + 1}`,
      pickupLocation: route.pickup,
      dropLocation: route.drop,
      distanceKm,
      fare,
      paymentMode: index % 2 === 0 ? "CASH" : "UPI",
      status: "REQUESTED",
      driverId: null,
      isDummy: true,
      startOtp: "",
      endOtp: "",
    };
  });
}

function buildDummyCompletedHistory(myUserId) {
  const ownerId = myUserId || "1";
  return [
    {
      id: 910001,
      pickupLocation: "Betul City Center, MP",
      dropLocation: "Amla Railway Station, MP",
      fare: 110,
      paymentMode: "CASH",
      status: "COMPLETED",
      driverId: ownerId,
      riderId: 301,
    },
    {
      id: 910002,
      pickupLocation: "Multai Bus Stand, MP",
      dropLocation: "Pandhurna Bus Stand, MP",
      fare: 160,
      paymentMode: "UPI",
      status: "COMPLETED",
      driverId: ownerId,
      riderId: 302,
    },
    {
      id: 910003,
      pickupLocation: "Amla Railway Station, MP",
      dropLocation: "Chicholi, Betul, MP",
      fare: 120,
      paymentMode: "CARD",
      status: "COMPLETED",
      driverId: ownerId,
      riderId: 303,
    },
    {
      id: 910004,
      pickupLocation: "Pandhurna Bus Stand, MP",
      dropLocation: "Warud Market, Maharashtra",
      fare: 170,
      paymentMode: "CASH",
      status: "COMPLETED",
      driverId: ownerId,
      riderId: 304,
    },
  ];
}

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

function getRideTimestampMs(ride, fallbackIndex = 0) {
  const preferredDate =
    ride?.completedAt || ride?.updatedAt || ride?.createdAt || ride?.requestedAt || ride?.acceptedAt || "";
  const parsed = Number(new Date(preferredDate).getTime());
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return Date.now() - fallbackIndex * 24 * 60 * 60 * 1000;
}

function getQualityScore(ride) {
  const fare = Number(ride?.fare) || 0;
  const distanceKm = Number(ride?.distanceKm) || 0;
  const perKmYield = distanceKm > 0 ? fare / distanceKm : fare / 8;
  const paymentMode = String(ride?.paymentMode || "").toUpperCase();

  let score = 40;
  score += Math.min(30, perKmYield * 2.8);
  if (distanceKm > 0) {
    if (distanceKm <= 20) {
      score += 12;
    } else if (distanceKm > 45) {
      score -= 10;
    }
  }
  score += paymentMode === "CASH" ? -3 : 5;
  if (ride?.status === "REQUESTED" && !ride?.driverId) {
    score += 8;
  }

  const normalized = Math.min(99, Math.max(1, Math.round(score)));
  const tier = normalized >= 80 ? "High" : normalized >= 60 ? "Medium" : "Low";
  const suggestion =
    tier === "High"
      ? "Good fare-to-distance balance."
      : tier === "Medium"
        ? "Decent option if nearby."
        : "Lower yield. Prefer other requests if available.";

  return {
    score: normalized,
    tier,
    suggestion,
    perKmYield,
  };
}

export default function DriverDashboard() {
  const token = localStorage.getItem("token") || "";
  const myName = localStorage.getItem("name") || "Driver";
  const myUserId = localStorage.getItem("userId") || "";

  const [activeRides, setActiveRides] = useState([]);
  const [myHistory, setMyHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [predictiveInsights, setPredictiveInsights] = useState(null);
  const [busyRideId, setBusyRideId] = useState(null);
  const [otpByRide, setOtpByRide] = useState({});
  const [cancelReasonByRide, setCancelReasonByRide] = useState({});
  const [trackingRideId, setTrackingRideId] = useState(null);
  const [availabilityMode, setAvailabilityMode] = useState("ONLINE");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [lastAutoAssignedRideId, setLastAutoAssignedRideId] = useState("");
  const [liveToast, setLiveToast] = useState(null);
  const [pulseQueueBadge, setPulseQueueBadge] = useState(false);
  const mapSectionRef = useRef(null);
  const demandSectionRef = useRef(null);
  const feedbackSectionRef = useRef(null);
  const historySectionRef = useRef(null);
  const toastTimerRef = useRef(null);
  const pulseTimerRef = useRef(null);
  const hasQueueFeedInitializedRef = useRef(false);
  const previousOpenRequestsRef = useRef(0);

  const fetchRides = useCallback(async () => {
    if (!token) {
      setError("Please login to access driver dashboard.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [activeResult, historyResult, insightsResult] = await Promise.allSettled([
        apiRequest("/rides/requested", "GET", null, token),
        apiRequest("/rides/history", "GET", null, token),
        apiRequest("/rides/insights/predictive", "GET", null, token),
      ]);

      if (activeResult.status === "rejected" && historyResult.status === "rejected") {
        throw activeResult.reason || historyResult.reason;
      }

      const activeResponse = activeResult.status === "fulfilled" ? activeResult.value : [];
      const historyResponse = historyResult.status === "fulfilled" ? historyResult.value : [];
      const activeList = Array.isArray(activeResponse) ? activeResponse : [];
      const historyList = Array.isArray(historyResponse) ? historyResponse : [];
      const myCompletedHistory = historyList.filter(
        (ride) => ride.driverId && myUserId && String(ride.driverId) === String(myUserId)
      );

      setActiveRides(activeList.length > 0 ? activeList : buildDummyRides());
      setMyHistory(myCompletedHistory.length > 0 ? myCompletedHistory : buildDummyCompletedHistory(myUserId));
      setPredictiveInsights(insightsResult.status === "fulfilled" ? insightsResult.value : null);
    } catch (requestError) {
      setPredictiveInsights(null);
      setError(requestError.message || "Failed to load driver rides.");
    } finally {
      setLoading(false);
    }
  }, [myUserId, token]);

  useEffect(() => {
    fetchRides();
    const interval = setInterval(fetchRides, 10000);
    return () => clearInterval(interval);
  }, [fetchRides]);

  const getCurrentLocation = useCallback(
    () =>
      new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
          reject(new Error("Geolocation is not available in this browser."));
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (position) =>
            resolve({
              lat: position.coords.latitude,
              lon: position.coords.longitude,
            }),
          (positionError) => {
            if (positionError?.code === 1) {
              reject(new Error("Location permission denied. Please allow location access."));
              return;
            }
            reject(new Error("Unable to read current location."));
          },
          { enableHighAccuracy: true, timeout: 10000 }
        );
      }),
    []
  );

  const updateRideStatus = useCallback(
    async (ride, status, otp = "") => {
      if (status === "ACCEPTED" && availabilityMode !== "ONLINE") {
        setError("Switch to Online mode to take new requests.");
        return;
      }

      if (ride?.isDummy) {
        const enteredOtp = (otp || "").trim();
        setActiveRides((previous) => {
          if (status === "PICKED") {
            const target = previous.find((item) => item.id === ride.id);
            if (target && target.startOtp && enteredOtp !== target.startOtp) {
              setError("Invalid start OTP.");
              return previous;
            }
          }

          if (status === "COMPLETED") {
            const target = previous.find((item) => item.id === ride.id);
            if (target && target.endOtp && enteredOtp !== target.endOtp) {
              setError("Invalid end OTP.");
              return previous;
            }
          }

          if (status === "COMPLETED") {
            const completedRide = previous.find((item) => item.id === ride.id);
            if (completedRide) {
              setMyHistory((oldHistory) => [
                { ...completedRide, status: "COMPLETED", driverId: myUserId || completedRide.driverId },
                ...oldHistory,
              ]);
            }
            return previous.filter((item) => item.id !== ride.id);
          }

          return previous.map((item) => {
            if (item.id !== ride.id) {
              return item;
            }
            if (status === "ACCEPTED") {
              return {
                ...item,
                status,
                driverId: myUserId || item.driverId,
                acceptedAt: new Date().toISOString(),
                startOtp: item.startOtp || generateLocalOtp(),
                endOtp: item.endOtp || generateLocalOtp(),
              };
            }
            return {
              ...item,
              status,
              driverId: status === "ACCEPTED" ? myUserId || item.driverId : item.driverId,
            };
          });
        });
        return;
      }

      if (!token) {
        return;
      }

      setBusyRideId(ride.id);
      setError("");
      try {
        const payload =
          status === "ACCEPTED"
            ? { status, driverId: myUserId }
            : { status, otp: (otp || "").trim() };
        await apiRequest(`/rides/status/${ride.id}`, "POST", payload, token);
        setOtpByRide((previous) => ({ ...previous, [ride.id]: "" }));
        await fetchRides();
      } catch (requestError) {
        setError(requestError.message || "Unable to update ride status.");
      } finally {
        setBusyRideId(null);
      }
    },
    [availabilityMode, fetchRides, myUserId, token]
  );

  const shareDriverLocation = useCallback(
    async (ride) => {
      if (!ride) {
        return false;
      }

      setBusyRideId(ride.id);
      setError("");
      let shared = false;
      try {
        const currentLocation = await getCurrentLocation();
        if (!isServerRideId(ride.id)) {
          setActiveRides((previous) =>
            previous.map((item) =>
              item.id === ride.id
                ? {
                    ...item,
                    driverLat: currentLocation.lat,
                    driverLon: currentLocation.lon,
                    driverLocationUpdatedAt: new Date().toISOString(),
                  }
                : item
            )
          );
          shared = true;
        } else {
          await apiRequest(`/rides/location/${ride.id}`, "POST", currentLocation, token);
          await fetchRides();
          shared = true;
        }
      } catch (locationError) {
        const message = String(locationError?.message || "");
        if (message.toLowerCase().includes("permission denied")) {
          setError("Location access is required. Please allow location permission.");
        } else {
          setError(message || "Unable to share live location.");
        }
      } finally {
        setBusyRideId(null);
      }
      return shared;
    },
    [fetchRides, getCurrentLocation, token]
  );

  const toggleAutoShareLocation = useCallback(
    async (ride) => {
      if (!ride) {
        return;
      }
      if (String(trackingRideId) === String(ride.id)) {
        setTrackingRideId(null);
        return;
      }
      const shared = await shareDriverLocation(ride);
      if (shared) {
        setTrackingRideId(ride.id);
      }
    },
    [shareDriverLocation, trackingRideId]
  );

  const cancelRide = useCallback(
    async (ride) => {
      const reason = (cancelReasonByRide?.[ride.id] || "Plan changed").trim();
      if (!reason) {
        setError("Please select a cancel reason.");
        return;
      }

      if (!isServerRideId(ride.id)) {
        setActiveRides((previous) => previous.filter((item) => item.id !== ride.id));
        setMyHistory((previous) => [
          {
            ...ride,
            status: "CANCELLED",
            cancelledBy: "DRIVER",
            cancellationReason: reason,
            cancellationFee: 0,
            driverId: myUserId || ride.driverId,
          },
          ...previous,
        ]);
        return;
      }

      setBusyRideId(ride.id);
      setError("");
      try {
        await apiRequest(`/rides/cancel/${ride.id}`, "POST", { reason }, token);
        await fetchRides();
      } catch (requestError) {
        setError(requestError.message || "Unable to cancel ride.");
      } finally {
        setBusyRideId(null);
      }
    },
    [cancelReasonByRide, fetchRides, myUserId, token]
  );

  const stats = useMemo(() => {
    const completed = myHistory.filter((ride) => ride.status === "COMPLETED");
    const earnings = completed.reduce((sum, ride) => sum + (Number(ride.fare) || 0), 0);
    return {
      completed: completed.length,
      earnings,
      inProgress: activeRides.filter(
        (ride) =>
          ride.driverId &&
          myUserId &&
          String(ride.driverId) === String(myUserId) &&
          ride.status !== "COMPLETED" &&
          ride.status !== "CANCELLED"
      ).length,
    };
  }, [activeRides, myHistory, myUserId]);

  const earningsSnapshot = useMemo(() => {
    const completed = myHistory.filter((ride) => ride.status === "COMPLETED");
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const weekAgoMs = Date.now() - 6 * 24 * 60 * 60 * 1000;

    let today = 0;
    let week = 0;
    completed.forEach((ride, index) => {
      const fare = Number(ride.fare) || 0;
      const rideTimeMs = getRideTimestampMs(ride, index);
      if (rideTimeMs >= startOfToday.getTime()) {
        today += fare;
      }
      if (rideTimeMs >= weekAgoMs) {
        week += fare;
      }
    });

    return {
      today,
      week,
      avgPerRide: completed.length > 0 ? Math.round((stats.earnings || 0) / completed.length) : 0,
    };
  }, [myHistory, stats.earnings]);

  const averageDriverRating = useMemo(() => {
    const ratings = myHistory
      .map((ride) => Number(ride.driverRating))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (ratings.length === 0) {
      return "5.0";
    }

    return (ratings.reduce((sum, value) => sum + value, 0) / ratings.length).toFixed(1);
  }, [myHistory]);

  const bestRequestMatch = useMemo(() => {
    const openRequests = activeRides.filter((ride) => ride.status === "REQUESTED" && !ride.driverId);
    if (openRequests.length === 0) {
      return null;
    }
    return openRequests
      .map((ride) => ({ ride, quality: getQualityScore(ride) }))
      .sort((left, right) => right.quality.score - left.quality.score)[0];
  }, [activeRides]);

  const openRequestCount = useMemo(
    () => activeRides.filter((ride) => ride.status === "REQUESTED" && !ride.driverId).length,
    [activeRides]
  );

  const triggerLiveFeedback = useCallback((message, tone = "info") => {
    if (!message) {
      return;
    }

    if (toastTimerRef.current) {
      clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    if (pulseTimerRef.current) {
      clearTimeout(pulseTimerRef.current);
      pulseTimerRef.current = null;
    }

    setLiveToast({
      id: Date.now(),
      message,
      tone,
    });
    setPulseQueueBadge(false);
    requestAnimationFrame(() => setPulseQueueBadge(true));

    toastTimerRef.current = setTimeout(() => {
      setLiveToast(null);
    }, 2600);
    pulseTimerRef.current = setTimeout(() => {
      setPulseQueueBadge(false);
    }, 780);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        clearTimeout(toastTimerRef.current);
      }
      if (pulseTimerRef.current) {
        clearTimeout(pulseTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!hasQueueFeedInitializedRef.current) {
      hasQueueFeedInitializedRef.current = true;
      previousOpenRequestsRef.current = openRequestCount;
      return;
    }

    if (openRequestCount > previousOpenRequestsRef.current) {
      triggerLiveFeedback("New ride request arrived.", "success");
    }

    previousOpenRequestsRef.current = openRequestCount;
  }, [openRequestCount, triggerLiveFeedback]);

  const patchDriverRideFeedback = useCallback((rideId, patch) => {
    setMyHistory((previous) =>
      previous.map((ride) => (String(ride.id) === String(rideId) ? { ...ride, ...patch } : ride))
    );
  }, []);

  const availabilityMeta = useMemo(() => {
    if (availabilityMode === "ONLINE") {
      return {
        label: "Online and taking new rides",
        badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
        hint: "New requests can be accepted immediately.",
      };
    }

    if (availabilityMode === "BREAK") {
      return {
        label: "On break",
        badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
        hint: "Current trips continue but new demand is paused.",
      };
    }

    return {
      label: "Offline",
      badgeClass: "border-slate-300 bg-slate-100 text-slate-700",
      hint: "Demand actions stay paused until you go online.",
    };
  }, [availabilityMode]);

  const scrollToSection = (sectionRef) => {
    sectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    if (!trackingRideId) {
      return;
    }
    const trackedRide = activeRides.find((ride) => String(ride.id) === String(trackingRideId));
    if (!trackedRide || (trackedRide.status !== "ACCEPTED" && trackedRide.status !== "PICKED")) {
      setTrackingRideId(null);
      return;
    }

    const interval = setInterval(() => {
      shareDriverLocation(trackedRide);
    }, 12000);
    return () => clearInterval(interval);
  }, [activeRides, shareDriverLocation, trackingRideId]);

  useEffect(() => {
    if (!autoAssignEnabled || availabilityMode !== "ONLINE" || loading || busyRideId) {
      return;
    }
    const openRequest = activeRides.find((ride) => ride.status === "REQUESTED" && !ride.driverId);
    if (!openRequest || String(openRequest.id) === String(lastAutoAssignedRideId)) {
      return;
    }
    setLastAutoAssignedRideId(String(openRequest.id));
    updateRideStatus(openRequest, "ACCEPTED");
  }, [
    activeRides,
    autoAssignEnabled,
    availabilityMode,
    busyRideId,
    lastAutoAssignedRideId,
    loading,
    updateRideStatus,
  ]);

  return (
    <section className="dashboard-view space-y-6 fade-up">
      <LiveUpdateToast toast={liveToast} />

      <div className="glass-panel card-rise map-motion-panel p-6 sm:p-8" data-reveal>
        <div className="grid gap-6 lg:grid-cols-[1.35fr,0.95fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Driver dashboard</p>
              <span className={`live-badge ${pulseQueueBadge ? "pulse-once" : ""}`}>Queue live</span>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${availabilityMeta.badgeClass}`}>
                {availabilityMeta.label}
              </span>
            </div>
            <h1 className="mt-3 text-3xl font-bold text-slate-900 sm:text-4xl">Welcome back, {myName}</h1>
            <p className="mt-3 max-w-2xl text-slate-600">
              Manage incoming demand, track live trip progress, and keep your shifts moving without changing the core workflow.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" className="btn-secondary !px-3 !py-2 !text-xs" onClick={fetchRides}>
                Refresh demand
              </button>
              <button
                type="button"
                className="btn-secondary !px-3 !py-2 !text-xs"
                onClick={() => scrollToSection(mapSectionRef)}
              >
                Live map
              </button>
              <button
                type="button"
                className="btn-secondary !px-3 !py-2 !text-xs"
                onClick={() => scrollToSection(demandSectionRef)}
              >
                Active demand
              </button>
              <button
                type="button"
                className="btn-secondary !px-3 !py-2 !text-xs"
                onClick={() => scrollToSection(feedbackSectionRef)}
              >
                Feedback
              </button>
              <button
                type="button"
                className="btn-secondary !px-3 !py-2 !text-xs"
                onClick={() => scrollToSection(historySectionRef)}
              >
                Ride history
              </button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Availability</p>
                <p className="mt-1 text-base font-bold text-slate-900">{availabilityMode}</p>
                <p className="mt-1 text-xs text-slate-500">{availabilityMeta.hint}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Auto-assign</p>
                <p className="mt-1 text-base font-bold text-slate-900">{autoAssignEnabled ? "Enabled" : "Manual mode"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {autoAssignEnabled ? "Open requests are picked automatically while online." : "You approve each request yourself."}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Live tracking</p>
                <p className="mt-1 text-base font-bold text-slate-900">{trackingRideId ? `Ride ${trackingRideId}` : "Inactive"}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {trackingRideId ? "Automatic location updates are running." : "Start tracking from an accepted ride."}
                </p>
              </div>
            </div>
          </div>

          <aside className="rounded-[1.75rem] border border-slate-200 bg-white/70 p-5 shadow-[0_20px_40px_-32px_rgba(15,23,42,0.35)]" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">Operational pulse</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Open requests</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  <CountUpNumber value={openRequestCount} className="tabular-nums" />
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">This week</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  INR{" "}
                  <CountUpNumber
                    value={earningsSnapshot.week}
                    className="tabular-nums"
                    formatter={(number) => formatInr(Math.round(number))}
                  />
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Driver rating</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">
                  <CountUpNumber
                    value={Number(averageDriverRating) || 0}
                    className="tabular-nums"
                    formatter={(number) => Number(number).toFixed(1)}
                  />{" "}
                  / 5
                </p>
              </div>
            </div>

            {bestRequestMatch ? (
              <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50/90 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Recommended next request</p>
                    <p className="mt-1 text-sm font-semibold text-cyan-900">
                      {bestRequestMatch.ride.pickupLocation || "-"} to {bestRequestMatch.ride.dropLocation || "-"}
                    </p>
                  </div>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-800">
                    Score {bestRequestMatch.quality.score}/100
                  </span>
                </div>
                <p className="mt-2 text-sm text-cyan-800">{bestRequestMatch.quality.suggestion}</p>
              </div>
            ) : (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
                <p className="text-sm text-slate-600">No open request available for quality scoring right now.</p>
              </div>
            )}
          </aside>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Completed rides</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              <CountUpNumber value={stats.completed} className="tabular-nums" />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">In progress</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              <CountUpNumber value={stats.inProgress} className="tabular-nums" />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Earnings</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              INR{" "}
              <CountUpNumber
                value={stats.earnings}
                className="tabular-nums"
                formatter={(number) => formatInr(Math.round(number))}
              />
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white/80 p-4" data-reveal>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Average rating</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">
              <CountUpNumber
                value={Number(averageDriverRating) || 0}
                className="tabular-nums"
                formatter={(number) => Number(number).toFixed(1)}
              />
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">{error}</div>
      )}

      <PredictiveInsightsPanel insights={predictiveInsights} loading={loading} />

      <section className="grid gap-6 lg:grid-cols-2" data-reveal>
        <article className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Availability controls</h2>
          <p className="mt-2 text-sm text-slate-600">Choose your work mode and optionally auto-assign open requests.</p>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["ONLINE", "BREAK", "OFFLINE"].map((mode) => (
              <button
                key={mode}
                type="button"
                className={`rounded-xl border px-3 py-2 text-sm font-semibold transition ${
                  availabilityMode === mode
                    ? mode === "ONLINE"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                      : mode === "BREAK"
                        ? "border-amber-300 bg-amber-50 text-amber-800"
                        : "border-slate-400 bg-slate-100 text-slate-800"
                    : "border-slate-300 bg-white text-slate-700 hover:border-slate-400"
                }`}
                onClick={() => setAvailabilityMode(mode)}
              >
                {mode}
              </button>
            ))}
          </div>
          <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-white/80 px-3 py-2 text-sm font-semibold text-slate-700">
            <input
              type="checkbox"
              checked={autoAssignEnabled}
              onChange={(event) => setAutoAssignEnabled(event.target.checked)}
            />
            Auto-assign open requests while online
          </label>
          <p className="mt-3 text-xs text-slate-500">
            Online: can take new rides. Break: keep current rides, pause new ones. Offline: stop all new demand actions.
          </p>
        </article>

        <article className="glass-panel map-motion-panel p-6 sm:p-8" data-reveal>
          <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Earnings snapshot</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Today</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                INR{" "}
                <CountUpNumber
                  value={earningsSnapshot.today}
                  className="tabular-nums"
                  formatter={(number) => formatInr(Math.round(number))}
                />
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Last 7 days</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                INR{" "}
                <CountUpNumber
                  value={earningsSnapshot.week}
                  className="tabular-nums"
                  formatter={(number) => formatInr(Math.round(number))}
                />
              </p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Avg per ride</p>
              <p className="mt-1 text-xl font-bold text-slate-900">
                INR{" "}
                <CountUpNumber
                  value={earningsSnapshot.avgPerRide}
                  className="tabular-nums"
                  formatter={(number) => formatInr(Math.round(number))}
                />
              </p>
            </div>
          </div>
          {bestRequestMatch ? (
            <div className="mt-4 rounded-2xl border border-cyan-200 bg-cyan-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-cyan-700">Best request quality</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-900">
                    {bestRequestMatch.ride.pickupLocation || "-"} to {bestRequestMatch.ride.dropLocation || "-"}
                  </p>
                </div>
                <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-cyan-800">
                  Score {bestRequestMatch.quality.score}/100
                </span>
              </div>
              <p className="mt-2 text-sm text-cyan-800">{bestRequestMatch.quality.suggestion}</p>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">No open request available for quality scoring right now.</p>
          )}
        </article>
      </section>

      <div ref={mapSectionRef} data-reveal>
        <LiveMapPanel
          title="Live map"
          defaultCenter={{ lat: 21.774, lon: 78.257 }}
          defaultZoom={6}
          defaultLocationLabel="Multai, India"
        />
      </div>

      <section className="glass-panel map-motion-panel p-6 sm:p-8" ref={demandSectionRef} data-reveal>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <h2 className="text-xl font-bold text-slate-900 sm:text-2xl">Active demand</h2>
            <p className="mt-2 text-sm text-slate-600">Accept nearby rides and move them through each trip stage.</p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-semibold ${
              availabilityMode === "ONLINE"
                ? "bg-emerald-100 text-emerald-700"
                : availabilityMode === "BREAK"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-slate-200 text-slate-700"
            }`}
          >
            {availabilityMode}
          </span>
        </div>

        {loading ? (
          <p className="mt-4 text-sm text-slate-600">Loading active rides...</p>
        ) : activeRides.length === 0 ? (
          <p className="mt-4 text-sm text-slate-600">No active rides right now.</p>
        ) : (
          <div className="mt-5 space-y-3">
            {activeRides.map((ride) => {
              const isMine = ride.driverId && myUserId && String(ride.driverId) === String(myUserId);
              const isBusy = busyRideId === ride.id;
              const quality = getQualityScore(ride);
              const rideSummary = [
                { label: "Pickup", value: ride.pickupLocation || "-" },
                { label: "Drop", value: ride.dropLocation || "-" },
                { label: "Fare", value: `INR ${formatInr(ride.fare)}` },
                {
                  label: "Payment",
                  value: ride.paymentStatus
                    ? `${formatPaymentModeLabel(ride.paymentMode)} • ${ride.paymentStatus}`
                    : formatPaymentModeLabel(ride.paymentMode),
                },
                ...(ride.distanceKm ? [{ label: "Distance", value: `${Number(ride.distanceKm).toFixed(0)} km` }] : []),
                { label: "Request quality", value: `${quality.score}/100 (${quality.tier})` },
              ];
              const showInTripActions = (ride.status === "ACCEPTED" || ride.status === "PICKED") && isMine;
              const showVerification = (ride.status === "ACCEPTED" || ride.status === "PICKED") && isMine;

              return (
                <article key={ride.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white/85">
                  <div className="grid lg:grid-cols-[1.15fr,1fr,0.95fr]">
                    <div className="px-4 py-4 sm:px-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ride overview</p>
                          <p className="mt-1 text-sm text-slate-600">Trip details and current state.</p>
                        </div>
                        <span
                          className={`inline-flex self-start rounded-full px-3 py-1 text-xs font-bold ${
                            ride.status === "REQUESTED"
                              ? "bg-slate-100 text-slate-700"
                              : ride.status === "ACCEPTED"
                              ? "bg-cyan-100 text-cyan-700"
                              : ride.status === "PICKED"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-emerald-100 text-emerald-700"
                          }`}
                        >
                          {ride.status}
                        </span>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        {rideSummary.map((item) => (
                          <div key={item.label} className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2">
                            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
                            <p className="mt-1 break-words text-sm font-semibold text-slate-900">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="border-t border-slate-200 px-4 py-4 sm:px-5 lg:border-l lg:border-t-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Driver actions</p>

                      <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Quick actions</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {ride.status === "REQUESTED" && !ride.driverId && (
                            <button
                              type="button"
                              onClick={() => updateRideStatus(ride, "ACCEPTED")}
                              className="btn-primary"
                              disabled={isBusy || availabilityMode !== "ONLINE"}
                            >
                              {isBusy ? "Accepting..." : availabilityMode === "ONLINE" ? "Accept" : "Go online to accept"}
                            </button>
                          )}

                          {showInTripActions && (
                            <>
                              <button
                                type="button"
                                onClick={() => shareDriverLocation(ride)}
                                className="btn-secondary"
                                disabled={isBusy}
                              >
                                {isBusy ? "Sharing..." : "Allow location & share"}
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleAutoShareLocation(ride)}
                                className="btn-secondary"
                                disabled={isBusy}
                              >
                                {String(trackingRideId) === String(ride.id) ? "Stop auto-share" : "Auto-share location"}
                              </button>
                            </>
                          )}

                          {ride.status === "REQUESTED" && ride.driverId && !isMine && (
                            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                              Assigned to another driver
                            </span>
                          )}
                        </div>
                      </div>

                      {ride.status === "ACCEPTED" && isMine && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Pickup verification</p>
                          <div className="mt-3 space-y-3">
                            <input
                              value={otpByRide[ride.id] || ""}
                              onChange={(event) =>
                                setOtpByRide((previous) => ({ ...previous, [ride.id]: event.target.value.replace(/\D/g, "") }))
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              placeholder="Enter rider pickup OTP"
                            />
                            <button
                              type="button"
                              onClick={() => updateRideStatus(ride, "PICKED", otpByRide[ride.id] || "")}
                              className="btn-secondary w-full"
                              disabled={isBusy}
                            >
                              {isBusy ? "Updating..." : "Mark picked"}
                            </button>
                          </div>
                        </div>
                      )}

                      {ride.status === "PICKED" && isMine && (
                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Drop verification</p>
                          <div className="mt-3 space-y-3">
                            <input
                              value={otpByRide[ride.id] || ""}
                              onChange={(event) =>
                                setOtpByRide((previous) => ({ ...previous, [ride.id]: event.target.value.replace(/\D/g, "") }))
                              }
                              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                              placeholder="Enter rider complete OTP"
                            />
                            <button
                              type="button"
                              onClick={() => updateRideStatus(ride, "COMPLETED", otpByRide[ride.id] || "")}
                              className="btn-secondary w-full"
                              disabled={isBusy}
                            >
                              {isBusy ? "Completing..." : "Complete ride"}
                            </button>
                          </div>
                        </div>
                      )}

                      {!showVerification && ride.status !== "REQUESTED" && (
                        <p className="mt-4 text-sm text-slate-500">No verification action required for this ride.</p>
                      )}
                    </div>

                    <div className="border-t border-slate-200 px-4 py-4 sm:px-5 lg:border-l lg:border-t-0">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500">Ride controls</p>

                      {showInTripActions && (
                        <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 p-3">
                          <p className="text-[11px] font-semibold uppercase tracking-wide text-rose-700">Cancellation</p>
                          <div className="mt-3 space-y-3">
                            <select
                              value={cancelReasonByRide[ride.id] || "Vehicle issue"}
                              onChange={(event) =>
                                setCancelReasonByRide((previous) => ({ ...previous, [ride.id]: event.target.value }))
                              }
                              className="w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm text-rose-900"
                            >
                              <option>Vehicle issue</option>
                              <option>Unable to reach pickup</option>
                              <option>Emergency</option>
                              <option>Traffic blockage</option>
                            </select>
                            <button
                              type="button"
                              className="btn-secondary w-full"
                              onClick={() => cancelRide(ride)}
                              disabled={isBusy}
                            >
                              {isBusy ? "Cancelling..." : "Cancel ride"}
                            </button>
                          </div>
                        </div>
                      )}

                      {!showInTripActions && (
                        <p className="mt-4 text-sm text-slate-500">No extra controls available for this ride yet.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <div ref={feedbackSectionRef} data-reveal>
        <RideFeedbackPanel
          rides={myHistory}
          userRole="DRIVER"
          title="Driver feedback"
          onRidePatched={patchDriverRideFeedback}
        />
      </div>

      <div ref={historySectionRef} data-reveal>
        <RideHistory rides={myHistory} title="Your ride history" emptyMessage="No completed driver rides yet." autoRefresh={false} />
      </div>
    </section>
  );
}
