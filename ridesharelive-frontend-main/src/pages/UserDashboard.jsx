import { useCallback, useEffect, useRef, useState } from "react";
import { apiRequest } from "../api";
import BookingPanel from "../components/BookingPanel";
import LiveUpdateToast from "../components/LiveUpdateToast";
import RideHistory from "../components/RideHistory";
import RiderActiveTripPage from "./RiderActiveTripPage";

function sortByNewest(left, right) {
  const leftTime = new Date(left?.createdAt || left?.bookedAt || left?.requestedAt || 0).getTime();
  const rightTime = new Date(right?.createdAt || right?.bookedAt || right?.requestedAt || 0).getTime();
  return rightTime - leftTime;
}

function getDayGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Good Morning";
  if (hour < 17) return "Good Afternoon";
  return "Good Evening";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
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
    if (!navigator.geolocation) return;
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
  const completedRideCount = orderedRides.filter((ride) => ride.status === "COMPLETED").length;
  const activeRideCount = orderedRides.filter(
    (ride) => ride.status && ride.status !== "COMPLETED" && ride.status !== "CANCELLED"
  ).length;
  const totalSpend = orderedRides.reduce((sum, ride) => sum + Number(ride?.fare || 0), 0);
  
  const heroStats = [
    { label: "Active rides", value: activeRideCount, detail: activeRide ? activeRide.status.replace(/_/g, " ") : "Ready" },
    { label: "Completed trips", value: completedRideCount, detail: "History" },
    { label: "Total spend", value: formatCurrency(totalSpend), detail: "Fares" },
  ];

  const isDarkTheme = theme === "dark";
  const heroShellClass = `relative overflow-hidden rounded-[2rem] border p-6 sm:px-7 ${isDarkTheme ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`;
  const heroBadgeClass = `inline-flex rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider ${isDarkTheme ? 'border-white/10 text-slate-400' : 'border-slate-200 text-slate-500'}`;
  const heroTitleClass = `mt-2 text-3xl font-bold ${isDarkTheme ? 'text-white' : 'text-slate-900'}`;
  const heroStatCardClass = `rounded-2xl border p-4 ${isDarkTheme ? 'border-white/10 bg-slate-800' : 'border-slate-100 bg-slate-50'}`;
  const rideShellClass = `rounded-[2rem] border p-5 ${isDarkTheme ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'}`;

  return (
    <section className="dashboard-view rider-dashboard-view">
      <LiveUpdateToast toast={liveToast} />
      <div className="mx-auto max-w-7xl space-y-5 px-1 pb-8">
        <header className={heroShellClass}>
          <div className="relative z-10 grid gap-6 lg:grid-cols-[1.08fr,0.92fr] lg:items-end">
            <div>
              <span className={heroBadgeClass}>Rider dashboard</span>
              <p className="mt-5 text-sm font-semibold text-slate-500">{greeting}, {riderName}</p>
              <h1 className={heroTitleClass}>Quick booking, clear feedback.</h1>
              <p className="mt-4 text-sm text-slate-500">Book and track your rides in one place.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {heroStats.map((item) => (
                <article key={item.label} className={heroStatCardClass}>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{item.label}</p>
                  <p className="mt-2 text-xl font-bold">{item.value}</p>
                </article>
              ))}
            </div>
          </div>
        </header>

        {loading ? (
          <div className="h-48 bg-slate-100 rounded-[2rem] animate-pulse" />
        ) : activeRide ? (
          <RiderActiveTripPage ride={activeRide} onRideUpdated={fetchRides} theme={theme} />
        ) : (
          <>
            <section className={rideShellClass}>
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-1">
                <div>
                  <h2 className="text-xl font-bold">New Ride</h2>
                </div>
                {currentLocation && <span className="text-xs font-bold text-emerald-600">Location active</span>}
              </div>
              <BookingPanel onBooked={fetchRides} currentLocation={currentLocation} onCurrentLocationChange={setCurrentLocation} theme={theme} />
            </section>
            <RideHistory rides={orderedRides} title="Recent rides" emptyMessage="No rides yet." autoRefresh={false} loadingOverride={loading} theme={theme} />
          </>
        )}
      </div>
    </section>
  );
}
