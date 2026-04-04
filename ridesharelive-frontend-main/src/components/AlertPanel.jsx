import { memo } from "react";
import { AnimatePresence, motion as Motion } from "motion/react";
import { AlertTriangle, CheckCircle2, Eye } from "lucide-react";
import OpsActionButton from "./OpsActionButton";

function AlertPanel({
  alerts,
  onAcknowledge,
  onResolve,
  onEscalate,
  onOpen,
  isDark = true,
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Alerts</p>
        <span className={`rounded-full px-3 py-1 text-[11px] font-semibold ${isDark ? "bg-slate-900 text-slate-300" : "bg-slate-100 text-slate-700"}`}>{alerts.length} live</span>
      </div>
      <AnimatePresence initial={false}>
        {alerts.length === 0 ? (
          <Motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`rounded-[1.4rem] border p-4 text-sm ${
              isDark
                ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))] text-slate-400"
                : "border-slate-200 bg-white/96 text-slate-500"
            }`}
          >
            No live alerts.
          </Motion.div>
        ) : alerts.map((alert, index) => (
          <Motion.article
            key={alert.id}
            layout
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0, boxShadow: alert.severity === "CRITICAL" ? ["0 0 0 rgba(251,191,36,0)", "0 0 0 1px rgba(251,191,36,0.18)", "0 0 0 rgba(251,191,36,0)"] : "none" }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, delay: index * 0.04, boxShadow: { duration: 1.8, repeat: Infinity } }}
            className={`rounded-[1.4rem] border p-4 ${
              alert.severity === "CRITICAL"
                ? isDark
                  ? "border-amber-400/18 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.08),transparent_42%),linear-gradient(180deg,rgba(5,12,24,0.95),rgba(12,19,31,0.92))]"
                  : "border-amber-200 bg-amber-50"
                : isDark
                  ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))]"
                  : "border-slate-200 bg-white/96"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{alert.title}</p>
                <p className="mt-1 text-sm text-slate-500">{alert.subtitle}</p>
              </div>
              <span className={`rounded-full px-2 py-1 text-[10px] font-semibold uppercase ${alert.severity === "CRITICAL" ? (isDark ? "border border-amber-400/18 bg-amber-400/[0.08] text-amber-100" : "bg-amber-100 text-amber-700") : isDark ? "border border-slate-700/70 bg-[#0f1a2d] text-slate-300" : "bg-slate-100 text-slate-700"}`}>{alert.severity}</span>
            </div>
            <div className="mt-3 flex flex-wrap justify-end gap-2">
              <OpsActionButton compact icon={Eye} isDark={isDark} onClick={() => onOpen?.(alert)}>
                Details
              </OpsActionButton>
              <OpsActionButton compact icon={AlertTriangle} variant="warning" isDark={isDark} onClick={() => onEscalate?.(alert)}>
                Escalate
              </OpsActionButton>
              <OpsActionButton compact icon={CheckCircle2} variant="success" isDark={isDark} onClick={() => onResolve?.(alert)}>
                Resolve
              </OpsActionButton>
              <OpsActionButton compact isDark={isDark} onClick={() => onAcknowledge?.(alert)}>
                Acknowledge
              </OpsActionButton>
            </div>
          </Motion.article>
        ))}
      </AnimatePresence>
    </section>
  );
}

export default memo(AlertPanel);
