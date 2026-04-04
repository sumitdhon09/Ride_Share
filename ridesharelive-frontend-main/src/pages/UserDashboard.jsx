import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
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
  if (hour < 12) {
    return "Good Morning";
  }
  if (hour < 17) {
    return "Good Afternoon";
  }
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
  const completedRideCount = orderedRides.filter((ride) => ride.status === "COMPLETED").length;
  const activeRideCount = orderedRides.filter(
    (ride) => ride.status && ride.status !== "COMPLETED" && ride.status !== "CANCELLED"
  ).length;
  const totalSpend = orderedRides.reduce((sum, ride) => sum + Number(ride?.fare || 0), 0);
  const heroStats = [
    {
      label: "Active rides",
      value: activeRideCount,
      detail: activeRide ? activeRide.status.replace(/_/g, " ") : "Ready for your next trip",
    },
    {
      label: "Completed trips",
      value: completedRideCount,
      detail: completedRideCount > 0 ? "All-time trip archive" : "Your first ride starts today",
    },
    {
      label: "Total spend",
      value: formatCurrency(totalSpend),
      detail: "Transparent fare history",
    },
  ];
  const isDarkTheme = theme === "dark";
  const heroShellClass = isDarkTheme
    ? "relative overflow-hidden rounded-[2rem] border border-white/10 bg-[linear-gradient(145deg,rgba(2,6,23,0.94),rgba(15,23,42,0.94),rgba(14,23,42,0.9))] px-6 py-6 shadow-[0_32px_70px_-42px_rgba(2,6,23,0.92)] backdrop-blur-2xl sm:px-7"
    : "relative overflow-hidden rounded-[2rem] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.9),rgba(255,243,238,0.92),rgba(254,239,245,0.9))] px-6 py-6 shadow-[0_32px_70px_-42px_rgba(15,23,42,0.22)] backdrop-blur-2xl sm:px-7";
  const heroGlowClass = isDarkTheme
    ? "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.14),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(59,130,246,0.18),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.14),transparent_32%)]"
    : "pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,154,158,0.22),transparent_34%),radial-gradient(circle_at_78%_18%,rgba(254,207,239,0.32),transparent_28%),radial-gradient(circle_at_50%_100%,rgba(255,226,213,0.24),transparent_32%)]";
  const heroBadgeClass = isDarkTheme
    ? "inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-300"
    : "inline-flex rounded-full border border-white/80 bg-white/72 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-500";
  const heroGreetingClass = isDarkTheme ? "mt-5 text-sm font-semibold text-slate-400" : "mt-5 text-sm font-semibold text-slate-500";
  const heroTitleClass = isDarkTheme
    ? "mt-2 text-[2.35rem] font-semibold tracking-[-0.05em] text-slate-50 sm:text-[2.8rem]"
    : "mt-2 text-[2.35rem] font-semibold tracking-[-0.05em] text-slate-950 sm:text-[2.8rem]";
  const heroBodyClass = isDarkTheme
    ? "mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base"
    : "mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base";
  const heroStatCardClass = isDarkTheme
    ? "rounded-[1.5rem] border border-white/10 bg-white/[0.06] px-4 py-4 shadow-[0_20px_45px_-34px_rgba(2,6,23,0.85)] backdrop-blur-xl"
    : "rounded-[1.5rem] border border-white/75 bg-white/70 px-4 py-4 shadow-[0_20px_45px_-34px_rgba(15,23,42,0.18)] backdrop-blur-xl";
  const heroStatLabelClass = isDarkTheme
    ? "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400"
    : "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500";
  const heroStatValueClass = isDarkTheme
    ? "mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-50"
    : "mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950";
  const heroStatDetailClass = isDarkTheme ? "mt-2 text-sm text-slate-300" : "mt-2 text-sm text-slate-600";
  const dashboardPanelClass = isDarkTheme
    ? "rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.76))] p-5 shadow-[0_28px_60px_-40px_rgba(2,6,23,0.86)] backdrop-blur-2xl"
    : "rounded-[2rem] border border-white/80 bg-white/76 p-5 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.18)] backdrop-blur-2xl";
  const rideShellClass = isDarkTheme
    ? "rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.82),rgba(15,23,42,0.76))] p-4 shadow-[0_28px_60px_-40px_rgba(2,6,23,0.86)] backdrop-blur-2xl sm:p-5"
    : "rounded-[2rem] border border-white/80 bg-white/74 p-4 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:p-5";
  const rideEyebrowClass = isDarkTheme
    ? "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400"
    : "text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500";
  const rideTitleClass = isDarkTheme
    ? "mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-50"
    : "mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950";
  const rideBodyClass = isDarkTheme ? "mt-2 text-sm text-slate-400" : "mt-2 text-sm text-slate-500";
  const pickupStatusClass = isDarkTheme
    ? "inline-flex rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs font-semibold text-slate-300 shadow-[0_12px_32px_-26px_rgba(2,6,23,0.7)]"
    : "inline-flex rounded-full border border-white/80 bg-white/80 px-3 py-1.5 text-xs font-semibold text-slate-600 shadow-[0_12px_32px_-26px_rgba(15,23,42,0.22)]";

  return (
    <section className="dashboard-view rider-dashboard-view">
      <LiveUpdateToast toast={liveToast} />
      <div className="mx-auto max-w-7xl space-y-5 px-1 pb-8">
        <motion.header
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
          className={heroShellClass}
        >
          <div className={heroGlowClass} />
          <div className="relative z-10 grid gap-6 lg:grid-cols-[1.08fr,0.92fr] lg:items-end">
            <div>
              <span className={heroBadgeClass}>
                Rider dashboard
              </span>
              <p className={heroGreetingClass}>
                {greeting}, {String(riderName).trim()}
              </p>
              <h1 className={heroTitleClass}>
                Premium trips with clear live feedback.
              </h1>
              <p className={heroBodyClass}>
                Book your next ride, watch ETA updates, and keep every fare, route, and safety checkpoint in one calm workspace.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
              {heroStats.map((item) => (
                <article
                  key={item.label}
                  className={heroStatCardClass}
                >
                  <p className={heroStatLabelClass}>{item.label}</p>
                  <p className={heroStatValueClass}>{item.value}</p>
                  <p className={heroStatDetailClass}>{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </motion.header>

        {loading ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.28fr)_minmax(320px,0.72fr)]">
            <section className={dashboardPanelClass}>
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
            <aside className={dashboardPanelClass}>
              <div className="loading-shimmer h-5 w-24 rounded-full" />
              <div className="mt-4 loading-shimmer h-14 rounded-[1.1rem]" />
              <div className="mt-3 loading-shimmer h-14 rounded-[1.1rem]" />
              <div className="mt-4 loading-shimmer h-36 rounded-[1.25rem]" />
            </aside>
          </div>
        ) : activeRide ? (
          <RiderActiveTripPage ride={activeRide} onRideUpdated={fetchRides} theme={theme} />
        ) : (
          <>
            <motion.section
              key="ride-tab"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className={rideShellClass}
            >
              <div className="mb-4 flex flex-wrap items-start justify-between gap-3 px-1">
                <div>
                  <p className={rideEyebrowClass}>Plan next ride</p>
                  <h2 className={rideTitleClass}>Ride</h2>
                  <p className={rideBodyClass}>Pickup, match, and go.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="premium-button premium-button--ghost premium-button--sm">
                    Activity
                  </button>
                  <span className={pickupStatusClass}>
                    {currentLocation ? "Live pickup ready" : "Location optional"}
                  </span>
                </div>
              </div>
              <BookingPanel onBooked={fetchRides} currentLocation={currentLocation} onCurrentLocationChange={setCurrentLocation} theme={theme} />
            </motion.section>
            <RideHistory rides={orderedRides} title="Recent rides" emptyMessage="No rides yet." autoRefresh={false} loadingOverride={loading} theme={theme} />
          </>
        )}
      </div>
    </section>
  );
}
