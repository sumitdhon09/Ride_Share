import { motion } from "motion/react";

export default function RevenueChartCard({ title, data, isDark = true }) {
  const max = Math.max(...data, 1);
  return (
    <section className={`rounded-[1.75rem] border p-5 ${isDark ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))] shadow-[0_26px_60px_-46px_rgba(8,15,31,0.96)]" : "border-slate-200 bg-white/96"}`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>{title}</p>
      <div className="mt-5 flex h-48 items-end gap-3">
        {data.map((value, index) => (
          <motion.div
            key={`${title}-${index}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: `${(value / max) * 100}%`, opacity: 1 }}
            transition={{ duration: 0.35, delay: index * 0.04 }}
            className={`flex-1 rounded-t-2xl ${isDark ? "bg-[linear-gradient(180deg,#22d3ee,#0f172a)]" : "bg-[linear-gradient(180deg,#38bdf8,#e0f2fe)]"}`}
          />
        ))}
      </div>
    </section>
  );
}
