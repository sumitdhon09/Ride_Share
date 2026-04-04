import { motion } from "motion/react";
import RideStatus from "../components/RideStatus";

export default function RiderActiveTripPage({ ride, onRideUpdated, theme = "light" }) {
  const isDarkTheme = theme === "dark";
  const shellClass = isDarkTheme
    ? "rounded-[2rem] border border-white/10 bg-[linear-gradient(180deg,rgba(15,23,42,0.88),rgba(15,23,42,0.78))] p-5 shadow-[0_28px_60px_-40px_rgba(2,6,23,0.86)] backdrop-blur-2xl sm:p-7"
    : "rounded-[2rem] border border-white/80 bg-white/80 p-5 shadow-[0_28px_60px_-40px_rgba(15,23,42,0.18)] backdrop-blur-2xl sm:p-7";
  const eyebrowClass = isDarkTheme
    ? "text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/90"
    : "text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-700";
  const titleClass = isDarkTheme
    ? "mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-50 sm:text-3xl"
    : "mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950 sm:text-3xl";
  const bodyClass = isDarkTheme ? "mt-2 max-w-2xl text-sm leading-relaxed text-slate-400" : "mt-2 max-w-2xl text-sm leading-relaxed text-slate-600";

  const routeLabel = [ride?.pickupLocation, ride?.dropLocation].filter(Boolean).join(" → ") || "Your trip";

  return (
    <motion.section
      key={`active-trip-${ride?.id}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="mx-auto max-w-4xl"
      aria-label="Current ride"
    >
      <div className={shellClass}>
        <header
          className={`mb-6 border-b pb-5 ${isDarkTheme ? "border-white/10" : "border-slate-200/90"}`}
        >
          <p className={eyebrowClass}>Live trip</p>
          <h1 className={titleClass}>Track your ride</h1>
          <p className={bodyClass}>
            Status, driver OTP, and route updates stay on this screen until your trip ends. You can book again after this ride is
            completed or cancelled.
          </p>
          <p className={`mt-3 text-sm font-medium ${isDarkTheme ? "text-slate-300" : "text-slate-700"}`}>{routeLabel}</p>
        </header>
        <RideStatus ride={ride} onComplete={onRideUpdated} theme={theme} />
      </div>
    </motion.section>
  );
}
