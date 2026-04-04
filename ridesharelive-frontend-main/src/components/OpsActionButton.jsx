import { motion } from "motion/react";

const MotionButton = motion.button;

const VARIANT_STYLES = {
  neutral: {
    dark: "border-slate-700/70 bg-[#0f1a2d]/88 text-slate-200 hover:border-cyan-400/20 hover:text-slate-50",
    light: "border-slate-200 bg-white text-slate-700 hover:border-sky-300 hover:text-slate-900",
  },
  primary: {
    dark: "border-cyan-400/20 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(56,189,248,0.14))] text-cyan-100 shadow-[0_18px_34px_-24px_rgba(34,211,238,0.42)] hover:border-cyan-300/34",
    light: "border-sky-200 bg-sky-50 text-sky-700 shadow-[0_18px_34px_-24px_rgba(56,189,248,0.18)] hover:border-sky-300",
  },
  success: {
    dark: "border-teal-400/18 bg-[linear-gradient(135deg,rgba(45,212,191,0.16),rgba(34,197,94,0.08))] text-teal-100 shadow-[0_18px_34px_-24px_rgba(45,212,191,0.38)] hover:border-teal-300/30",
    light: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300",
  },
  warning: {
    dark: "border-amber-400/18 bg-[linear-gradient(135deg,rgba(251,191,36,0.14),rgba(245,158,11,0.08))] text-amber-100 shadow-[0_18px_34px_-24px_rgba(251,191,36,0.26)] hover:border-amber-300/30",
    light: "border-amber-200 bg-amber-50 text-amber-700 hover:border-amber-300",
  },
  danger: {
    dark: "border-rose-400/18 bg-[linear-gradient(135deg,rgba(244,114,182,0.12),rgba(251,113,133,0.08))] text-rose-100 shadow-[0_18px_34px_-24px_rgba(251,113,133,0.24)] hover:border-rose-300/30",
    light: "border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300",
  },
};

export default function OpsActionButton({
  children,
  icon: Icon,
  variant = "neutral",
  isDark = true,
  compact = false,
  className = "",
  disabled = false,
  ...props
}) {
  const mode = isDark ? "dark" : "light";
  const variantStyle = VARIANT_STYLES[variant]?.[mode] || VARIANT_STYLES.neutral[mode];
  const sizeClass = compact
    ? "min-h-[2.2rem] rounded-full px-3 py-1.5 text-[11px]"
    : "min-h-[3rem] rounded-[1rem] px-4 py-3 text-sm";

  return (
    <MotionButton
      type="button"
      whileHover={disabled ? undefined : { y: -1, scale: 1.01 }}
      whileTap={disabled ? undefined : { scale: 0.98 }}
      transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 border font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 ${sizeClass} ${variantStyle} ${className}`.trim()}
      {...props}
    >
      {Icon ? <Icon className={compact ? "h-3.5 w-3.5" : "h-4 w-4"} aria-hidden="true" /> : null}
      <span>{children}</span>
    </MotionButton>
  );
}
