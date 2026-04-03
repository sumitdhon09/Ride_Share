import { motion } from "motion/react";

export default function DriverHeader({
  driverName,
  vehicleLabel,
  online,
  earningsToday,
  notifications = 3,
  onToggleOnline,
  onOpenNotifications,
  isDark = true,
}) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-[2rem] border p-5 shadow-[0_32px_90px_-48px_rgba(8,145,178,0.2)] ${
        isDark ? "border-slate-800 bg-slate-950/92" : "border-slate-200 bg-white/96 shadow-[0_28px_70px_-42px_rgba(14,165,233,0.22)]"
      }`}
    >
      <div className={`pointer-events-none absolute inset-0 ${isDark ? "bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(132,204,22,0.08),transparent_24%)]" : "bg-[radial-gradient(circle_at_top_right,rgba(14,165,233,0.1),transparent_32%),radial-gradient(circle_at_bottom_left,rgba(16,185,129,0.08),transparent_26%)]"}`} />
      <div className="relative flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex items-center gap-4">
          <div className={`grid h-14 w-14 place-items-center rounded-2xl text-lg font-bold ring-1 ${isDark ? "bg-cyan-400/12 text-cyan-300 ring-cyan-400/20" : "bg-sky-100 text-sky-700 ring-sky-200"}`}>
            {String(driverName || "D").slice(0, 1)}
          </div>
          <div>
            <h1 className={`text-2xl font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>Welcome back, {driverName}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border-slate-700 bg-slate-900 text-slate-300" : "border-slate-200 bg-slate-50 text-slate-700"}`}>
                {vehicleLabel}
              </span>
            </div>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[auto_auto_auto] sm:items-center">
          <motion.button
            type="button"
            whileTap={{ scale: 0.98 }}
            onClick={onToggleOnline}
            className={`flex items-center gap-3 rounded-full border px-4 py-3 text-sm font-semibold transition ${
              online
                ? isDark
                  ? "border-cyan-400/30 bg-cyan-400/10 text-cyan-200 shadow-[0_0_24px_rgba(34,211,238,0.18)]"
                  : "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_0_24px_rgba(14,165,233,0.14)]"
                : isDark
                  ? "border-slate-700 bg-slate-900 text-slate-300"
                  : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
          >
            <motion.span
              animate={online ? { boxShadow: ["0 0 0 0 rgba(34,211,238,0.4)", "0 0 0 8px rgba(34,211,238,0)"] } : { boxShadow: "0 0 0 0 rgba(0,0,0,0)" }}
              transition={online ? { duration: 1.6, repeat: Infinity, ease: "easeOut" } : { duration: 0.2 }}
              className={`h-2.5 w-2.5 rounded-full ${online ? (isDark ? "bg-cyan-300" : "bg-sky-500") : (isDark ? "bg-slate-500" : "bg-slate-400")}`}
            />
            {online ? "Online" : "Offline"}
          </motion.button>

          <div className={`rounded-[1.35rem] border px-4 py-3 ${isDark ? "border-slate-800 bg-slate-900" : "border-slate-200 bg-slate-50"}`}>
            <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Today</p>
            <p className={`mt-1 text-lg font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>INR {earningsToday}</p>
          </div>

          <button
            type="button"
            onClick={onOpenNotifications}
            className={`relative grid h-12 w-12 place-items-center rounded-2xl border ${isDark ? "border-slate-800 bg-slate-900 text-slate-200" : "border-slate-200 bg-slate-50 text-slate-700"}`}
          >
            <span className="text-lg">N</span>
            <motion.span
              animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="absolute right-2 top-2 grid h-5 min-w-[1.25rem] place-items-center rounded-full bg-amber-400 px-1 text-[10px] font-bold text-slate-950"
            >
              {notifications}
            </motion.span>
          </button>
        </div>
      </div>
    </motion.header>
  );
}
