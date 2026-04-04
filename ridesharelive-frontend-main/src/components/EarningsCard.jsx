import { motion } from "motion/react";

export default function EarningsCard({ label, value, tone = "default", delay = 0, isDark = true }) {
  const toneClasses = {
    default: isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.9))] text-slate-50" : "border-slate-200 bg-white/96 text-slate-900",
    success: isDark ? "border-teal-400/18 bg-[linear-gradient(135deg,rgba(45,212,191,0.16),rgba(34,197,94,0.08))] text-teal-100" : "border-emerald-200 bg-emerald-50 text-emerald-700",
    cyan: isDark ? "border-cyan-400/18 bg-[linear-gradient(135deg,rgba(34,211,238,0.16),rgba(56,189,248,0.08))] text-cyan-100" : "border-sky-200 bg-sky-50 text-sky-700",
    amber: isDark ? "border-amber-400/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),rgba(245,158,11,0.08))] text-amber-100" : "border-amber-200 bg-amber-50 text-amber-700",
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22, delay }}
      className={`rounded-[1.5rem] border p-4 ${toneClasses[tone] || toneClasses.default}`}
    >
      <p className={`text-[10px] font-semibold uppercase tracking-[0.18em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </motion.article>
  );
}
