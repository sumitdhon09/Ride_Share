import { memo } from "react";
import { AlertTriangle, CheckCircle2, UserPlus } from "lucide-react";
import OpsActionButton from "./OpsActionButton";

function ComplaintsTable({ rows, onResolve, onEscalate, onAssign, isDark = true, loading = false }) {
  return (
    <section className={`rounded-[1.75rem] border p-5 ${
      isDark
        ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))] shadow-[0_26px_60px_-46px_rgba(8,15,31,0.96)]"
        : "border-slate-200 bg-white/96"
    }`}>
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Complaints</p>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${isDark ? "border border-slate-700/70 bg-[#0f1a2d] text-slate-300" : "bg-slate-100 text-slate-700"}`}>{rows.length} items</span>
      </div>
      <div className="mt-4 space-y-2">
        {loading ? (
          [...Array.from({ length: 4 })].map((_, index) => (
            <div key={`complaint-skeleton-${index}`} className={`h-20 animate-pulse rounded-[1.2rem] ${isDark ? "bg-[#0d182b]" : "bg-slate-100"}`} />
          ))
        ) : rows.length === 0 ? (
          <div className={`rounded-[1.2rem] border px-4 py-6 text-center text-sm ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            No complaints found.
          </div>
        ) : rows.map((row) => (
          <div key={row.id} className={`rounded-[1.2rem] border px-4 py-3 text-sm ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"}`}>
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className={`font-medium ${isDark ? "text-slate-100" : "text-slate-900"}`}>{row.subject}</p>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border border-rose-400/18 bg-rose-400/[0.08] text-rose-100" : "bg-rose-500/10 text-rose-700"}`}>{row.status}</span>
                  <span className={`rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "border border-amber-400/18 bg-amber-400/[0.08] text-amber-100" : "bg-amber-500/10 text-amber-700"}`}>{row.severity}</span>
                </div>
                <p className="mt-1 text-slate-500">{row.owner}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <OpsActionButton compact icon={CheckCircle2} variant="success" isDark={isDark} onClick={() => onResolve?.(row)}>
                  Resolve
                </OpsActionButton>
                <OpsActionButton compact icon={AlertTriangle} variant="warning" isDark={isDark} onClick={() => onEscalate?.(row)}>
                  Escalate
                </OpsActionButton>
                <OpsActionButton compact icon={UserPlus} isDark={isDark} onClick={() => onAssign?.(row)}>
                  Assign
                </OpsActionButton>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

export default memo(ComplaintsTable);
