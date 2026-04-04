export default function DriverStatusCard({ online, currentLocationLabel, shiftDuration, autoAssignEnabled, isDark = true }) {
  return (
    <article className={`rounded-[1.75rem] border p-5 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))]" : "border-slate-200 bg-white/96"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Active status</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <div className={`rounded-[1.3rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Mode</p>
          <p className={`mt-2 text-lg font-semibold ${online ? (isDark ? "text-cyan-300" : "text-sky-700") : (isDark ? "text-slate-300" : "text-slate-700")}`}>{online ? "Online" : "Offline"}</p>
        </div>
        <div className={`rounded-[1.3rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Location</p>
          <p className={`mt-2 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{currentLocationLabel}</p>
        </div>
        <div className={`rounded-[1.3rem] border p-4 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/82" : "border-slate-200 bg-slate-50"}`}>
          <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Shift</p>
          <p className={`mt-2 text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{shiftDuration}</p>
          <p className="mt-1 text-xs text-slate-500">{autoAssignEnabled ? "Auto assign on" : "Manual assign"}</p>
        </div>
      </div>
    </article>
  );
}
