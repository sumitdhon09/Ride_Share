import { forwardRef } from "react";
import { motion as Motion } from "motion/react";

const DATE_RANGES = ["Today", "Week", "Month"];

const AdminHeader = forwardRef(function AdminHeader(
  {
    searchValue,
    onSearchChange,
    dateRange,
    onDateRangeChange,
    alertsOnly,
    onToggleAlerts,
    isDark = true,
    title = "Platform overview",
    subtitle = "Operations dashboard",
    breadcrumbs = ["Admin", "Overview"],
    updatedAt = "",
    onExport,
    onToggleSidebar,
  },
  ref
) {
  return (
    <Motion.header
      ref={ref}
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
      className={`sticky top-3 z-20 rounded-[2rem] border p-5 shadow-[0_30px_70px_-46px_rgba(7,14,28,0.95)] backdrop-blur-xl ${
        isDark
          ? "border-[rgba(45,60,87,0.78)] bg-[linear-gradient(180deg,rgba(6,13,25,0.92),rgba(10,19,36,0.9))]"
          : "border-slate-200 bg-white/96"
      }`}
    >
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            {onToggleSidebar ? (
              <button type="button" onClick={onToggleSidebar} className={`rounded-full border px-3 py-2 text-xs font-semibold ${isDark ? "border-slate-700/70 bg-[#0d1728]/82 text-slate-300 xl:hidden" : "border-slate-200 text-slate-600 xl:hidden"}`}>
                Menu
              </button>
            ) : null}
            <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{breadcrumbs.join(" / ")}</p>
          </div>
          <div>
            <h1 className={`text-3xl font-semibold ${isDark ? "text-slate-50" : "text-slate-900"}`}>{title}</h1>
            <p className={`mt-1 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>{subtitle}</p>
          </div>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(16rem,1fr)_auto_auto_auto] lg:items-center">
          <input
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search riders, drivers, rides, payouts"
            className={`rounded-[1.2rem] border px-4 py-3 text-sm outline-none transition ${
              isDark
                ? "border-slate-700/70 bg-[#0d1729]/88 text-slate-100 placeholder:text-slate-500 focus:border-cyan-400/32 focus:bg-[#101d33]"
                : "border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:border-sky-300 focus:ring-1 focus:ring-sky-200"
            }`}
          />
          <div className="flex flex-wrap gap-2">
            {DATE_RANGES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onDateRangeChange(item)}
                className={`rounded-[1.2rem] border px-4 py-3 text-sm font-semibold transition ${
                  dateRange === item
                    ? isDark
                      ? "border-cyan-400/24 bg-cyan-400/[0.08] text-cyan-100 shadow-[inset_0_0_0_1px_rgba(34,211,238,0.14)]"
                      : "border-sky-300 bg-sky-100 text-sky-700 shadow-sm"
                    : isDark
                      ? "border-slate-700/70 bg-[#0f1a2d]/82 text-slate-300 hover:border-slate-600 hover:text-slate-100"
                      : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onToggleAlerts}
            className={`relative rounded-[1.2rem] border px-4 py-3 text-sm font-semibold transition ${
              alertsOnly
                ? isDark
                  ? "border-amber-400/24 bg-amber-400/[0.08] text-amber-100 shadow-[inset_0_0_0_1px_rgba(251,191,36,0.12)]"
                  : "border-amber-300 bg-amber-100 text-amber-700 shadow-sm"
                : isDark
                  ? "border-slate-700/70 bg-[#0f1a2d]/82 text-slate-300 hover:border-slate-600 hover:text-slate-100"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            Alerts
            <Motion.span
              animate={{ scale: [1, 1.15, 1], opacity: [0.75, 1, 0.75] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-amber-400"
            />
          </button>
          <div className="flex items-center gap-3">
            {onExport ? (
              <button type="button" onClick={onExport} className={`rounded-[1.2rem] border px-4 py-3 text-sm font-semibold ${isDark ? "border-slate-700/70 bg-[#0f1a2d]/82 text-slate-200 hover:border-slate-600" : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"}`}>
                Export CSV
              </button>
            ) : null}
          </div>
        </div>
      </div>
      {updatedAt ? (
        <div className={`mt-3 text-right text-[11px] uppercase tracking-[0.18em] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
          Last sync {new Date(updatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </div>
      ) : null}
    </Motion.header>
  );
});

AdminHeader.displayName = "AdminHeader";

export default AdminHeader;

