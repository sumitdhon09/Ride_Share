import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { CheckCircle2, XCircle } from "lucide-react";
import { apiRequest } from "../api";
import ActiveTripCard from "../components/ActiveTripCard";
import DriverHeader from "../components/DriverHeader";
import DriverMapPanel from "../components/DriverMapPanel";
import DriverStatusCard from "../components/DriverStatusCard";
import EarningsCard from "../components/EarningsCard";
import LiveUpdateToast from "../components/LiveUpdateToast";
import OpsActionButton from "../components/OpsActionButton";
import RecentTripsTable from "../components/RecentTripsTable";
import RideRequestCard from "../components/RideRequestCard";

function formatInr(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Number(value) || 0);
}

const FALLBACK_DRIVER_REQUESTS = [
  {
    id: "demo-request-1",
    riderName: "Aarav Sharma",
    riderEmail: "aarav.rider@rideshare.demo",
    pickupLocation: "Multai Bus Stand",
    dropLocation: "Chandora Khurd",
    distanceKm: 4,
    fare: 25,
    paymentMode: "CASH",
    status: "REQUESTED",
  },
  {
    id: "demo-request-2",
    riderName: "Meera Joshi",
    riderEmail: "meera.rider@rideshare.demo",
    pickupLocation: "Multai Market",
    dropLocation: "Parmandal",
    distanceKm: 5,
    fare: 25,
    paymentMode: "CASH",
    status: "REQUESTED",
  },
  {
    id: "demo-request-3",
    riderName: "Rohan Patil",
    riderEmail: "rohan.rider@rideshare.demo",
    pickupLocation: "Multai Railway Station",
    dropLocation: "Jaulkhera",
    distanceKm: 8,
    fare: 40,
    paymentMode: "UPI",
    status: "REQUESTED",
  },
  {
    id: "demo-request-4",
    riderName: "Neha Verma",
    riderEmail: "neha.rider@rideshare.demo",
    pickupLocation: "Betul Naka, Multai",
    dropLocation: "Aamadoh",
    distanceKm: 6,
    fare: 35,
    paymentMode: "CARD",
    status: "REQUESTED",
  },
];
const demoDriverQueueEnabled =
  String(import.meta.env.VITE_ENABLE_DEMO_DRIVER_QUEUE || "").toLowerCase() === "true";

function DriverDashboardSkeleton({ isDark }) {
  const cardClass = isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96";
  const panelClass = isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/78" : "border-slate-200 bg-slate-50";

  return (
    <div className="space-y-5">
      <div className={`grid gap-3 rounded-[1.5rem] border px-4 py-4 sm:grid-cols-3 ${cardClass}`}>
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={`driver-summary-skeleton-${index}`} className="space-y-2">
            <div className="loading-shimmer h-3 w-24 rounded-full" />
            <div className="loading-shimmer h-5 w-40 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.92fr)]">
        <div className="space-y-5">
          <div className={`rounded-[1.75rem] border p-5 ${cardClass}`}>
            <div className="grid gap-3 sm:grid-cols-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`status-skeleton-${index}`} className="loading-shimmer h-16 rounded-[1.15rem]" />
              ))}
            </div>
          </div>
          <div className={`rounded-[1.4rem] border p-4 ${cardClass}`}>
            <div className="loading-shimmer h-5 w-32 rounded-full" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={`queue-skeleton-${index}`} className={`rounded-[1.15rem] border px-4 py-4 ${panelClass}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-full max-w-[16rem] space-y-2">
                      <div className="loading-shimmer h-4 w-full rounded-lg" />
                      <div className="loading-shimmer h-4 w-4/5 rounded-lg" />
                    </div>
                    <div className="loading-shimmer h-6 w-14 rounded-full" />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-3">
                    <div className="loading-shimmer h-4 w-32 rounded-lg" />
                    <div className="flex gap-2">
                      <div className="loading-shimmer h-8 w-20 rounded-full" />
                      <div className="loading-shimmer h-8 w-20 rounded-full" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`earnings-skeleton-${index}`} className={`rounded-[1.75rem] border p-5 ${cardClass}`}>
                <div className="loading-shimmer h-3 w-20 rounded-full" />
                <div className="mt-3 loading-shimmer h-8 w-24 rounded-lg" />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className={`rounded-[1.75rem] border p-5 ${cardClass}`}>
            <div className="loading-shimmer h-64 rounded-[1.4rem]" />
          </div>
          <div className={`rounded-[1.75rem] border p-5 ${cardClass}`}>
            <div className="loading-shimmer h-5 w-28 rounded-full" />
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <div key={`timeline-skeleton-${index}`} className="flex items-center gap-3">
                  <div className="loading-shimmer h-7 w-7 rounded-full" />
                  <div className="loading-shimmer h-4 w-36 rounded-lg" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DriverDashboard() {
  const token = localStorage.getItem("token") || "";
  const myName = localStorage.getItem("name") || "Driver";
  const myUserId = localStorage.getItem("userId") || "";
  const shiftStartedAtRef = useRef(Date.now());
  const previousOpenCountRef = useRef(0);
  const previousActiveRideRef = useRef("");
  const [activeRides, setActiveRides] = useState([]);
  const [history, setHistory] = useState([]);
  const [availabilityMode, setAvailabilityMode] = useState("ONLINE");
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false);
  const [busyRideId, setBusyRideId] = useState(null);
  const [pickupOtpByRide, setPickupOtpByRide] = useState({});
  const [dropOtpByRide, setDropOtpByRide] = useState({});
  const [liveToast, setLiveToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [currentLocation, setCurrentLocation] = useState({ lat: 21.774, lon: 78.257 });
  const [shiftTick, setShiftTick] = useState(0);
  const [isDark, setIsDark] = useState(() => document.documentElement.dataset.theme === "dark-theme");
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [dismissedRequestIds, setDismissedRequestIds] = useState([]);

  useEffect(() => {
    const root = document.documentElement;
    const syncTheme = () => setIsDark(root.dataset.theme === "dark-theme");
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  const fetchRides = useCallback(async ({ silent = false } = {}) => {
    if (!token) {
      setError("Please login to access driver dashboard.");
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
    }
    try {
      const [activeResult, historyResult] = await Promise.allSettled([
        apiRequest("/rides/requested", "GET", null, token),
        apiRequest("/rides/history", "GET", null, token),
      ]);
      const activeList = activeResult.status === "fulfilled" && Array.isArray(activeResult.value) ? activeResult.value : [];
      const historyList = historyResult.status === "fulfilled" && Array.isArray(historyResult.value) ? historyResult.value : [];

      if (activeResult.status === "rejected" && historyResult.status === "rejected") {
        throw new Error(activeResult.reason?.message || historyResult.reason?.message || "Failed to load driver rides.");
      }

      if (activeResult.status === "rejected") {
        setError(activeResult.reason?.message || "Live request queue is unavailable right now.");
      } else if (historyResult.status === "rejected") {
        setError(historyResult.reason?.message || "Trip history is unavailable right now.");
      } else {
        setError("");
      }

      setDismissedRequestIds([]);

      const openCount = activeList.filter((ride) => ride?.status === "REQUESTED" && !ride?.driverId).length;
      if (previousOpenCountRef.current && openCount > previousOpenCountRef.current) {
        setLiveToast({ id: Date.now(), message: "New ride request received.", tone: "success" });
        setNotificationsOpen(true);
      }
      previousOpenCountRef.current = openCount;
      setActiveRides(activeList);
      setHistory(historyList);
    } catch (requestError) {
      setError(requestError.message || "Failed to load driver rides.");
    } finally {
      if (!silent) {
        setLoading(false);
      }
    }
  }, [token]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  useEffect(() => {
    if (!token) {
      return;
    }
    const interval = window.setInterval(() => {
      fetchRides({ silent: true });
    }, 5000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fetchRides({ silent: true });
      }
    };
    window.addEventListener("focus", handleVisibility);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", handleVisibility);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [fetchRides, token]);

  useEffect(() => {
    const interval = window.setInterval(() => setShiftTick((value) => value + 1), 60000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => setCurrentLocation({ lat: position.coords.latitude, lon: position.coords.longitude }),
      () => {}
    );
  }, []);

  const updateRideStatus = useCallback(
    async (ride, status, otp = "") => {
      if (status === "ACCEPTED" && availabilityMode !== "ONLINE") {
        setError("Switch online to accept requests.");
        return;
      }
      setBusyRideId(ride.id);
      try {
        if (typeof ride.id === "number") {
          const payload = status === "ACCEPTED" ? { status, driverId: myUserId } : { status, otp };
          await apiRequest(`/rides/status/${ride.id}`, "POST", payload, token);
          setActiveRides((previous) =>
            previous.map((item) =>
              String(item.id) === String(ride.id)
                ? {
                    ...item,
                    status,
                    driverId: status === "ACCEPTED" ? myUserId : item.driverId,
                  }
                : item
            )
          );
          await fetchRides({ silent: true });
        }
        setLiveToast({ id: Date.now(), message: `Ride ${status.toLowerCase()}.`, tone: "success" });
      } catch (requestError) {
        setError(requestError.message || "Unable to update ride status.");
      } finally {
        setBusyRideId(null);
      }
    },
    [availabilityMode, fetchRides, myUserId, token]
  );

  const liveOpenRequests = useMemo(() => activeRides.filter((ride) => ride.status === "REQUESTED" && !ride.driverId), [activeRides]);
  const openRequests = useMemo(() => {
    const source = liveOpenRequests.length ? liveOpenRequests : demoDriverQueueEnabled ? FALLBACK_DRIVER_REQUESTS : [];
    return source.filter((ride) => !dismissedRequestIds.includes(String(ride.id)));
  }, [dismissedRequestIds, liveOpenRequests]);
  const currentRide = useMemo(() => activeRides.find((ride) => String(ride.driverId) === String(myUserId) && (ride.status === "ACCEPTED" || ride.status === "PICKED")) || null, [activeRides, myUserId]);
  const notifications = useMemo(
    () =>
      [
        ...openRequests.slice(0, 3).map((ride) => ({
          id: `request-${ride.id}`,
          label: `New request for ${ride.pickupLocation || "pickup"}`,
        })),
        ...(currentRide
          ? [
              {
                id: `active-${currentRide.id}`,
                label: `Active trip ${currentRide.status.toLowerCase()}.`,
              },
            ]
          : []),
      ].slice(0, 4),
    [currentRide, openRequests]
  );

  useEffect(() => {
    const currentRideSignature = currentRide ? `${currentRide.id}:${currentRide.status}` : "";
    if (previousActiveRideRef.current && currentRideSignature && previousActiveRideRef.current !== currentRideSignature) {
      setLiveToast({
        id: Date.now(),
        message: currentRide.status === "PICKED" ? "Trip is now in progress." : `Ride ${currentRide.status.toLowerCase()}.`,
        tone: "info",
      });
      setNotificationsOpen(true);
    }
    previousActiveRideRef.current = currentRideSignature;
  }, [currentRide]);

  useEffect(() => {
    if (!autoAssignEnabled || availabilityMode !== "ONLINE" || busyRideId || openRequests.length === 0) return;
    updateRideStatus(openRequests[0], "ACCEPTED");
  }, [autoAssignEnabled, availabilityMode, busyRideId, openRequests, updateRideStatus]);

  const completedRides = history.filter((ride) => ride.status === "COMPLETED");
  const earnings = completedRides.reduce((sum, ride) => sum + (Number(ride.fare) || 0), 0);
  const acceptanceRate = openRequests.length + completedRides.length > 0 ? Math.round((completedRides.length / Math.max(openRequests.length + completedRides.length, 1)) * 100) : 92;
  const shiftMinutes = Math.max(1, Math.round((Date.now() - shiftStartedAtRef.current) / 60000));
  const shiftDuration = `${Math.floor(shiftMinutes / 60)}h ${shiftMinutes % 60}m`;
  const topRequest = openRequests[0] || null;
  const queuedRequests = openRequests.slice(0, 4);

  const handleRejectRequest = useCallback((request) => {
    if (!request) {
      return;
    }
    setDismissedRequestIds((previous) => [...new Set([...previous, String(request.id)])]);
    setActiveRides((previous) => previous.filter((item) => String(item.id) !== String(request.id)));
    setLiveToast({ id: Date.now(), message: "Ride rejected.", tone: "info" });
  }, []);

  const handleAcceptRequest = useCallback(
    async (request) => {
      if (!request) {
        return;
      }
      if (typeof request.id === "number") {
        await updateRideStatus(request, "ACCEPTED");
        return;
      }
      setDismissedRequestIds((previous) => [...new Set([...previous, String(request.id)])]);
    },
    [updateRideStatus]
  );

  const handleContactRider = useCallback(async () => {
    const riderPhone = currentRide?.riderPhone || currentRide?.phone || "";
    const riderEmail = currentRide?.riderEmail || "";

    if (riderPhone) {
      window.open(`tel:${riderPhone}`, "_self");
      return;
    }

    if (riderEmail) {
      window.open(`mailto:${riderEmail}?subject=Ride pickup update`, "_self");
      setLiveToast({ id: Date.now(), message: "Opened rider email.", tone: "info" });
      return;
    }

    const fallbackText = `${currentRide?.riderName || "Rider"} | ${currentRide?.pickupLocation || ""}`.trim();
    if (navigator.clipboard?.writeText && fallbackText) {
      try {
        await navigator.clipboard.writeText(fallbackText);
        setLiveToast({ id: Date.now(), message: "Rider details copied.", tone: "info" });
        return;
      } catch {
        // Fall through to toast below.
      }
    }

    setLiveToast({ id: Date.now(), message: "Rider contact not available yet.", tone: "info" });
  }, [currentRide]);
  void shiftTick;

  return (
    <section className={isDark ? "min-h-screen bg-[radial-gradient(circle_at_top,rgba(20,35,63,0.38),transparent_26%),linear-gradient(180deg,#020611_0%,#071220_52%,#0a1527_100%)] text-slate-100" : "min-h-screen bg-[linear-gradient(180deg,#f8fbff_0%,#eef4ff_100%)] text-slate-900"}>
      <LiveUpdateToast toast={liveToast} />
      <div className="mx-auto max-w-[108rem] space-y-6 px-4 pb-10 sm:px-6 xl:px-8">
        <DriverHeader
          driverName={myName}
          vehicleLabel="Swift Dzire - MH 48"
          online={availabilityMode === "ONLINE"}
          earningsToday={formatInr(earnings)}
          notifications={notifications.length}
          onToggleOnline={() => setAvailabilityMode((value) => (value === "ONLINE" ? "OFFLINE" : "ONLINE"))}
          onOpenNotifications={() => setNotificationsOpen(true)}
          isDark={isDark}
        />
        {error ? <div className={`rounded-[1.4rem] border px-4 py-3 text-sm font-semibold ${isDark ? "border-rose-400/18 bg-rose-400/[0.08] text-rose-100" : "border-rose-200 bg-rose-50 text-rose-700"}`}>{error}</div> : null}

        <div className={`grid gap-3 rounded-[1.5rem] border px-4 py-4 sm:grid-cols-3 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.92),rgba(9,18,34,0.86))]" : "border-slate-200 bg-white/90"}`}>
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Driver workspace</p>
            <p className={`mt-1 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{availabilityMode === "ONLINE" ? "Ready for incoming rides" : "Offline and hidden from requests"}</p>
          </div>
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Queue</p>
            <p className={`mt-1 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{openRequests.length} open requests</p>
          </div>
          <div>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Current trip</p>
            <p className={`mt-1 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{currentRide ? currentRide.pickupLocation || "Trip active" : "No active trip"}</p>
          </div>
        </div>

        {loading ? <DriverDashboardSkeleton isDark={isDark} /> : null}

        {!loading ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(340px,0.92fr)]">
          <div className="space-y-5">
            <DriverStatusCard online={availabilityMode === "ONLINE"} currentLocationLabel="Multai live zone" shiftDuration={shiftDuration} autoAssignEnabled={autoAssignEnabled} isDark={isDark} />
            <div className="space-y-3">
              <RideRequestCard
                request={topRequest}
                accepting={busyRideId === topRequest?.id}
                disabled={availabilityMode !== "ONLINE"}
                onAccept={() => topRequest && handleAcceptRequest(topRequest)}
                onReject={() => handleRejectRequest(topRequest)}
                isDark={isDark}
              />
              <section className={`rounded-[1.4rem] border p-4 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.92),rgba(9,18,34,0.86))]" : "border-slate-200 bg-white/96"}`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className={`text-[11px] font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Open requests</p>
                    <p className={`mt-1 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>Live queue for nearby rides</p>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${isDark ? "bg-cyan-400/10 text-cyan-300" : "bg-sky-50 text-sky-700"}`}>{openRequests.length}</span>
                </div>
                <div className="mt-4 space-y-3">
                  {queuedRequests.length ? (
                    queuedRequests.map((request, index) => (
                      <motion.div
                        key={request.id}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.22, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] }}
                        className={`rounded-[1.15rem] border px-4 py-3 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/78" : "border-slate-200 bg-slate-50"}`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                              {request.pickupLocation}
                            </p>
                            <p className={`mt-1 text-xs ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                              To {request.dropLocation}
                            </p>
                          </div>
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${index === 0 ? (isDark ? "bg-emerald-400/10 text-emerald-300" : "bg-emerald-50 text-emerald-700") : (isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700")}`}>
                            {index === 0 ? "Next" : "Queued"}
                          </span>
                        </div>
                        <div className="mt-3 flex items-center justify-between gap-3">
                          <div className={`text-xs ${isDark ? "text-slate-300" : "text-slate-600"}`}>
                            {request.distanceKm || 0} km • INR {request.fare} • {request.paymentMode}
                          </div>
                          <div className="flex items-center gap-2">
                            <OpsActionButton compact icon={CheckCircle2} variant="success" isDark={isDark} onClick={() => handleAcceptRequest(request)} disabled={availabilityMode !== "ONLINE" || busyRideId === request.id}>
                              {busyRideId === request.id ? "..." : "Accept"}
                            </OpsActionButton>
                            <OpsActionButton compact icon={XCircle} variant="danger" isDark={isDark} onClick={() => handleRejectRequest(request)}>
                              Reject
                            </OpsActionButton>
                          </div>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className={`rounded-[1.15rem] border border-dashed px-4 py-5 text-sm ${isDark ? "border-slate-700 bg-slate-900/50 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                      No open requests right now.
                    </div>
                  )}
                </div>
              </section>
            </div>
            <ActiveTripCard ride={currentRide} pickupOtp={pickupOtpByRide[currentRide?.id] || ""} dropOtp={dropOtpByRide[currentRide?.id] || ""} busy={busyRideId === currentRide?.id} onPickupOtpChange={(value) => currentRide && setPickupOtpByRide((previous) => ({ ...previous, [currentRide.id]: value }))} onDropOtpChange={(value) => currentRide && setDropOtpByRide((previous) => ({ ...previous, [currentRide.id]: value }))} onMarkPicked={() => currentRide && updateRideStatus(currentRide, "PICKED", pickupOtpByRide[currentRide.id] || "")} onCompleteRide={() => currentRide && updateRideStatus(currentRide, "COMPLETED", dropOtpByRide[currentRide.id] || "")} onCallRider={handleContactRider} isDark={isDark} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <EarningsCard label="Total rides" value={String(completedRides.length)} delay={0} isDark={isDark} />
              <EarningsCard label="Earnings" value={`INR ${formatInr(earnings)}`} tone="success" delay={0.04} isDark={isDark} />
              <EarningsCard label="Rating" value="4.9 / 5" tone="cyan" delay={0.08} isDark={isDark} />
              <EarningsCard label="Acceptance" value={`${acceptanceRate}%`} tone="amber" delay={0.12} isDark={isDark} />
            </div>
          </div>

          <div className="space-y-5 xl:sticky xl:top-24 xl:self-start">
            <DriverMapPanel pickup={currentRide?.pickupLocation || topRequest?.pickupLocation || ""} drop={currentRide?.dropLocation || topRequest?.dropLocation || ""} currentLocation={currentLocation} onCenterToUser={() => { if (!navigator.geolocation) return; navigator.geolocation.getCurrentPosition((position) => setCurrentLocation({ lat: position.coords.latitude, lon: position.coords.longitude }), () => {}); }} onRefresh={fetchRides} isDark={isDark} />
            <div className={`rounded-[1.75rem] border p-5 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96"}`}>
              <div className="mb-4 flex items-center justify-between">
                <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Ride timeline</p>
                <label className={`flex items-center gap-2 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}><input type="checkbox" checked={autoAssignEnabled} onChange={(event) => setAutoAssignEnabled(event.target.checked)} className="accent-cyan-400" />Auto assign</label>
              </div>
              <div className={`space-y-3 text-sm ${isDark ? "text-slate-300" : "text-slate-700"}`}>
                {["Request received", "Pickup OTP", "Trip started", "Drop OTP", "Payment cleared"].map((item, index) => (
                  <div key={item} className="flex items-center gap-3">
                    <span className={`grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${index < 2 && currentRide ? "bg-cyan-400 text-slate-950" : isDark ? "bg-slate-800 text-slate-400" : "bg-slate-200 text-slate-500"}`}>{index + 1}</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div> : null}

        {!loading ? <div className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_minmax(320px,0.9fr)]">
          <RecentTripsTable rides={history} isDark={isDark} />
          <section className={`rounded-[1.75rem] border p-5 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96"}`}>
            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Earnings summary</p>
            <div className="mt-4 grid gap-3">
              {[["Cash rides", "INR 820"], ["Online payments", "INR 1,940"], ["Bonuses", "INR 320"], ["Payout due", "INR 480"]].map(([label, value]) => (
                <div key={label} className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
                  <span className="text-sm text-slate-500">{label}</span>
                  <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{value}</span>
                </div>
              ))}
            </div>
          </section>
        </div> : null}
      </div>
      {notificationsOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-end bg-slate-950/30 p-4 backdrop-blur-[2px]" onClick={() => setNotificationsOpen(false)}>
          <div className={`w-full max-w-sm rounded-[1.75rem] border p-5 shadow-[0_30px_90px_-35px_rgba(15,23,42,0.35)] ${isDark ? "border-cyan-400/20 bg-[linear-gradient(180deg,rgba(5,12,24,0.98),rgba(9,18,34,0.96))]" : "border-sky-200 bg-white"} `} onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Notifications</p>
                <h3 className={`mt-2 text-lg font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>Driver updates</h3>
              </div>
              <OpsActionButton compact isDark={isDark} onClick={() => setNotificationsOpen(false)}>
                Close
              </OpsActionButton>
            </div>
            <div className="mt-4 space-y-3">
              <div className={`rounded-[1.1rem] border px-4 py-3 text-sm ${isDark ? "border-cyan-400/15 bg-cyan-400/8 text-cyan-100" : "border-sky-200 bg-sky-50 text-sky-800"}`}>
                Notifications auto-open on every new request and trip update.
              </div>
              {notifications.length ? notifications.map((item) => (
                <div key={item.id} className={`rounded-[1.1rem] border px-4 py-3 text-sm ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                  {item.label}
                </div>
              )) : (
                <div className={`rounded-[1.1rem] border border-dashed px-4 py-5 text-sm ${isDark ? "border-slate-700 bg-slate-900/60 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
                  No new notifications.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
