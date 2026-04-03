import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { apiRequest } from "../api";
import BookingPanel from "../components/BookingPanel";
import LiveUpdateToast from "../components/LiveUpdateToast";
import RideHistory from "../components/RideHistory";
import RideStatus from "../components/RideStatus";

function sortByNewest(left, right) {
  const leftTime = new Date(left?.createdAt || left?.bookedAt || left?.requestedAt || 0).getTime();
  const rightTime = new Date(right?.createdAt || right?.bookedAt || right?.requestedAt || 0).getTime();
  return rightTime - leftTime;
}

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) {
    return "Good Morning";
  }
  if (hour < 17) {
    return "Good Afternoon";
  }
  return "Good Evening";
}

export default function UserDashboard({ session }) {
  const token = localStorage.getItem("token") || session?.token || "";
  const riderName = localStorage.getItem("name") || session?.name || "Passenger";
  const greeting = getDayGreeting();
  const previousRideCountRef = useRef(0);
  const initializedRef = useRef(false);
  const [liveToast, setLiveToast] = useState(null);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [rides, setRides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => (document.documentElement.dataset.theme === "dark-theme" ? "dark" : "light"));

  const fetchRides = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const response = await apiRequest("/rides/history", "GET", null, token);
      const nextRides = Array.isArray(response) ? response : [];
      setRides(nextRides);
      if (!initializedRef.current) {
        initializedRef.current = true;
        previousRideCountRef.current = nextRides.length;
        return;
      }
      if (nextRides.length > previousRideCountRef.current) {
        setLiveToast({ id: Date.now(), message: "New ride update received.", tone: "success" });
      }
      previousRideCountRef.current = nextRides.length;
    } catch (requestError) {
      return requestError;
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchRides();
  }, [fetchRides]);

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.dataset.theme === "dark-theme" ? "dark" : "light");
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) {
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => {}
    );
  }, []);

  const orderedRides = [...rides].sort(sortByNewest);
  const activeRide = orderedRides.find((ride) => ride.status && ride.status !== "COMPLETED" && ride.status !== "CANCELLED") || null;

  return (
    <section className="dashboard-view">
      <LiveUpdateToast toast={liveToast} />
      <div className="mx-auto max-w-7xl space-y-4 px-1 pb-8">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          className="rounded-[1.75rem] border border-slate-200 bg-white px-5 py-4 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)] sm:px-6"
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm font-semibold text-slate-500">
                {greeting}, {String(riderName).trim()}
              </p>
              <h1 className="mt-1 text-[2rem] font-black tracking-tight text-slate-950">Your journey starts here</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-700">
                {String(localStorage.getItem("name") || "P").slice(0, 1)}
              </div>
            </div>
          </div>
        </motion.header>

        {loading ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.72fr)]">
            <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)]">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="loading-shimmer h-12 rounded-[1rem]" />
                <div className="loading-shimmer h-12 rounded-[1rem]" />
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={`ride-option-skeleton-${index}`} className="loading-shimmer h-24 rounded-[1.25rem]" />
                ))}
              </div>
              <div className="mt-4 flex justify-end">
                <div className="loading-shimmer h-11 w-36 rounded-full" />
              </div>
            </section>
            <aside className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-[0_18px_40px_-32px_rgba(15,23,42,0.14)]">
              <div className="loading-shimmer h-5 w-24 rounded-full" />
              <div className="mt-4 loading-shimmer h-14 rounded-[1.1rem]" />
              <div className="mt-3 loading-shimmer h-14 rounded-[1.1rem]" />
              <div className="mt-4 loading-shimmer h-36 rounded-[1.25rem]" />
            </aside>
          </div>
        ) : (
          <motion.div key="ride-tab" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <BookingPanel onBooked={fetchRides} currentLocation={currentLocation} onCurrentLocationChange={setCurrentLocation} theme={theme} />
          </motion.div>
        )}

        {activeRide ? <RideStatus ride={activeRide} onComplete={fetchRides} /> : null}
        <RideHistory rides={orderedRides} title="Recent rides" emptyMessage="No rides yet." autoRefresh={false} loadingOverride={loading} />
      </div>
    </section>
  );
}
