import { memo } from "react";

function PaymentSummaryCard({ metrics = [], isDark = true }) {
  return (
    <section className={`rounded-[1.75rem] border p-5 ${
      isDark
        ? "border-[rgba(45,60,87,0.76)] bg-[linear-gradient(180deg,rgba(5,12,24,0.95),rgba(9,18,34,0.92))] shadow-[0_26px_60px_-46px_rgba(8,15,31,0.96)]"
        : "border-slate-200 bg-white/96"
    }`}>
      <p className={`text-[11px] font-semibold uppercase tracking-[0.22em] ${isDark ? "text-slate-400" : "text-slate-500"}`}>Payments</p>
      <div className="mt-4 grid gap-3">
        {metrics.length === 0 ? (
          <div className={`rounded-[1.2rem] border px-4 py-6 text-center text-sm ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86 text-slate-400" : "border-slate-200 bg-slate-50 text-slate-500"}`}>
            No payment metrics.
          </div>
        ) : metrics.map(([label, value]) => (
          <div key={label} className={`flex items-center justify-between rounded-[1.2rem] border px-4 py-3 ${isDark ? "border-[rgba(41,56,83,0.82)] bg-[#0d182b]/86" : "border-slate-200 bg-slate-50"}`}>
            <span className="text-sm text-slate-500">{label}</span>
            <span className={`text-sm font-semibold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{value}</span>
          </div>
        ))}
      </div>
    </section>
  );
}

export default memo(PaymentSummaryCard);
