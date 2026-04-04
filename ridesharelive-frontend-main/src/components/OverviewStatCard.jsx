import { memo } from "react";
import { motion as Motion } from "motion/react";
import CountUpNumber from "./CountUpNumber";

function defaultFormatter(value) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: value >= 100 ? 0 : 1 }).format(value);
}

function OverviewStatCard({
  label,
  value,
  tone = "default",
  delay = 0,
  isDark = true,
  delta,
  sparkline = [],
  formatter = defaultFormatter,
  suffix,
  compact = false,
}) {
  const tones = {
    default: {
      wrapper: isDark
        ? "border-[rgba(42,58,87,0.82)] bg-[linear-gradient(180deg,rgba(5,12,24,0.96),rgba(9,18,33,0.92))] text-slate-50 shadow-[0_24px_54px_-42px_rgba(8,15,31,0.96)]"
        : "border-slate-200 bg-white/96 text-slate-900",
      spark: isDark ? "rgba(125,211,252,0.75)" : "rgba(14,165,233,0.85)",
    },
    cyan: {
      wrapper: isDark
        ? "border-cyan-400/16 bg-[radial-gradient(circle_at_top_right,rgba(34,211,238,0.12),transparent_44%),linear-gradient(180deg,rgba(5,12,24,0.96),rgba(10,20,37,0.94))] text-cyan-50 shadow-[0_24px_54px_-42px_rgba(8,15,31,0.96)]"
        : "border-sky-200 bg-sky-50 text-sky-700",
      spark: isDark ? "rgba(34,211,238,0.88)" : "rgba(14,165,233,0.85)",
    },
    green: {
      wrapper: isDark
        ? "border-teal-400/16 bg-[radial-gradient(circle_at_top_right,rgba(45,212,191,0.11),transparent_44%),linear-gradient(180deg,rgba(5,12,24,0.96),rgba(8,19,35,0.94))] text-teal-50 shadow-[0_24px_54px_-42px_rgba(8,15,31,0.96)]"
        : "border-emerald-200 bg-emerald-50 text-emerald-700",
      spark: isDark ? "rgba(45,212,191,0.84)" : "rgba(16,185,129,0.82)",
    },
    amber: {
      wrapper: isDark
        ? "border-amber-400/14 bg-[radial-gradient(circle_at_top_right,rgba(251,191,36,0.1),transparent_46%),linear-gradient(180deg,rgba(5,12,24,0.96),rgba(12,19,31,0.94))] text-amber-50 shadow-[0_24px_54px_-42px_rgba(8,15,31,0.96)]"
        : "border-amber-200 bg-amber-50 text-amber-700",
      spark: isDark ? "rgba(251,191,36,0.82)" : "rgba(245,158,11,0.82)",
    },
    rose: {
      wrapper: isDark
        ? "border-rose-400/14 bg-[radial-gradient(circle_at_top_right,rgba(244,114,182,0.09),transparent_46%),linear-gradient(180deg,rgba(5,12,24,0.96),rgba(14,18,33,0.94))] text-rose-50 shadow-[0_24px_54px_-42px_rgba(8,15,31,0.96)]"
        : "border-rose-200 bg-rose-50 text-rose-700",
      spark: isDark ? "rgba(244,114,182,0.78)" : "rgba(244,63,94,0.82)",
    },
  };
  const toneConfig = tones[tone] || tones.default;
  const chartPoints = sparkline.length > 1 ? sparkline : [0, Number(value) || 0];
  const max = Math.max(...chartPoints, 1);
  const min = Math.min(...chartPoints, 0);
  const range = Math.max(max - min, 1);
  const path = chartPoints
    .map((point, index) => {
      const x = (index / (chartPoints.length - 1 || 1)) * 100;
      const y = 100 - ((point - min) / range) * 100;
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
  const deltaTone = delta > 0 ? (isDark ? "text-teal-300" : "text-emerald-500") : delta < 0 ? (isDark ? "text-rose-300" : "text-rose-500") : isDark ? "text-slate-400" : "text-slate-500";

  return (
    <Motion.article
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2, scale: 1.01 }}
      transition={{ duration: 0.22, delay }}
      className={`rounded-[1.5rem] border ${compact ? "p-3" : "p-4"} ${toneConfig.wrapper}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className={`${compact ? "text-[9px] tracking-[0.16em]" : "text-[10px] tracking-[0.18em]"} font-semibold uppercase ${isDark ? "text-slate-400" : "text-slate-500"}`}>{label}</p>
          <p className={`mt-1.5 font-semibold ${compact ? "text-xl" : "text-2xl"}`}>
            <CountUpNumber value={Number(value) || 0} formatter={(next) => `${formatter(next)}${suffix || ""}`} />
          </p>
        </div>
        <div className={compact ? "h-8 w-16" : "h-10 w-20"}>
          <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible">
            <path
              d={path}
              fill="none"
              stroke={toneConfig.spark}
              strokeWidth="5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
      <p className={`${compact ? "mt-2 text-[11px]" : "mt-3 text-xs"} font-medium ${deltaTone}`}>
        {typeof delta === "number" ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)}% vs yesterday` : "Live metric"}
      </p>
    </Motion.article>
  );
}

export default memo(OverviewStatCard);
