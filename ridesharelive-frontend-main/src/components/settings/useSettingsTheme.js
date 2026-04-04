import { useSettingsPanelStore } from "../../stores/useSettingsPanelStore";

const LIGHT_THEME = {
  overlay: "bg-[rgba(226,232,240,0.44)] backdrop-blur-xl",
  drawerShell:
    "overflow-hidden border-l border-white/70 bg-[linear-gradient(180deg,rgba(252,253,255,0.94),rgba(242,247,255,0.93),rgba(231,239,249,0.9))] shadow-[0_34px_90px_-42px_rgba(15,23,42,0.38)]",
  drawerGlow:
    "bg-[radial-gradient(circle_at_top_right,var(--settings-accent-soft),transparent_28%),radial-gradient(circle_at_12%_0%,rgba(255,255,255,0.86),transparent_24%),radial-gradient(circle_at_90%_24%,rgba(14,165,233,0.08),transparent_18%)]",
  header:
    "border-slate-200/75 bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(243,247,252,0.74))]",
  eyebrow: "text-slate-500",
  title: "text-slate-900",
  closeButton:
    "border-slate-200/80 bg-white/82 text-slate-600 transition hover:border-sky-300/55 hover:bg-white",
  notice: "border-emerald-400/22 bg-emerald-400/10 text-emerald-900",
  footerShell:
    "border-slate-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.28),rgba(241,246,252,0.86)_42%,rgba(231,239,249,0.96))]",
  footerCard:
    "border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(243,248,255,0.96))] shadow-[0_26px_52px_-38px_rgba(15,23,42,0.24)]",
  footerTitle: "text-slate-900",
  footerDescription: "text-slate-500",
  footerStatus: "border-sky-200/80 bg-sky-50/90 text-sky-700",
  resetButton:
    "border-slate-200/80 bg-slate-100/80 text-slate-700 transition hover:border-slate-300/75 hover:bg-white",
  toastSuccess:
    "border-emerald-300/45 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(236,253,245,0.96))] text-emerald-950",
  toastError:
    "border-rose-300/45 bg-[linear-gradient(145deg,rgba(255,255,255,0.92),rgba(255,241,242,0.96))] text-rose-950",
  toastIcon: "border-slate-200/75 bg-white/85",
  sectionShell:
    "border-slate-200/75 bg-[linear-gradient(145deg,rgba(255,255,255,0.84),rgba(243,248,255,0.92),rgba(233,242,252,0.9))]",
  sectionIcon: "border-sky-200/70 bg-white/85 text-sky-600",
  sectionTitle: "text-slate-700",
  sectionUnderline: "bg-[linear-gradient(90deg,rgba(14,165,233,0.55),transparent)]",
  sectionDescription: "text-slate-500",
  card: "border-slate-200/75 bg-white/78",
  strongCard:
    "border-slate-200/80 bg-[linear-gradient(145deg,rgba(255,255,255,0.88),rgba(239,246,255,0.94))]",
  label: "text-slate-500",
  textPrimary: "text-slate-900",
  textSecondary: "text-slate-600",
  textMuted: "text-slate-500",
  iconAccent: "text-sky-500",
  chip: "border-slate-200/75 bg-white/78 text-slate-600",
  badge: "border-slate-200/80 bg-slate-100/90 text-slate-700",
  accentButton:
    "border-sky-300/40 bg-[linear-gradient(135deg,rgba(125,211,252,0.18),rgba(56,189,248,0.24))] text-sky-700 shadow-[0_18px_34px_-26px_rgba(56,189,248,0.42)]",
  subtleButton:
    "border-slate-200/80 bg-white/80 text-slate-700 transition hover:border-sky-200/60 hover:bg-white",
  input:
    "border-slate-200/80 bg-white/84 text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-sky-400/55 focus:bg-white",
  inputGroup: "border-slate-200/80 bg-white/84",
  activeChip: "border-sky-300/45 bg-sky-100/85 text-sky-700 shadow-[0_0_0_1px_rgba(56,189,248,0.18)]",
  inactiveChip: "border-slate-200/80 bg-white/74 text-slate-600",
  toggleRow: "border-slate-200/80 bg-white/76",
  toggleLabel: "text-slate-800",
  toggleDescription: "text-slate-500",
  toggleOn:
    "border-sky-300/45 bg-[linear-gradient(135deg,rgba(125,211,252,0.32),rgba(59,130,246,0.18))]",
  toggleOff: "border-slate-200 bg-slate-100/90",
  toggleThumbOn:
    "translate-x-[1.3rem] bg-[linear-gradient(135deg,#ffffff,#dbeafe)] text-sky-600 shadow-[0_0_0_1px_rgba(96,165,250,0.28),0_10px_24px_-12px_rgba(96,165,250,0.45)]",
  toggleThumbOff:
    "translate-x-0 bg-white text-slate-700 shadow-[0_10px_24px_-14px_rgba(148,163,184,0.35)]",
  successCallout: "border-emerald-400/20 bg-emerald-400/10 text-emerald-900",
  warningCard:
    "border-amber-300/35 bg-[linear-gradient(145deg,rgba(255,251,235,0.94),rgba(255,247,237,0.96))] text-amber-950",
  warningSubtle: "text-amber-900/70",
  logoutButton:
    "border-rose-300/40 bg-[linear-gradient(135deg,rgba(253,164,175,0.18),rgba(251,113,133,0.16))] text-rose-700",
  deleteButton:
    "border-slate-200/80 bg-white/80 text-slate-700 transition hover:border-slate-300/75 hover:bg-white",
};

const DARK_THEME = {
  overlay: "bg-[rgba(2,6,23,0.76)] backdrop-blur-md",
  drawerShell:
    "overflow-hidden border-l border-white/12 bg-[linear-gradient(180deg,rgba(4,9,22,0.96),rgba(8,15,29,0.95),rgba(12,20,36,0.93))] shadow-[0_34px_90px_-40px_rgba(2,6,23,0.92)]",
  drawerGlow:
    "bg-[radial-gradient(circle_at_top_right,var(--settings-accent-soft),transparent_28%),radial-gradient(circle_at_20%_0%,rgba(255,255,255,0.05),transparent_24%)]",
  header: "border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.88),rgba(4,10,24,0.78))]",
  eyebrow: "text-slate-400",
  title: "text-slate-50",
  closeButton:
    "border-white/10 bg-white/[0.06] text-slate-100 transition hover:border-cyan-300/25 hover:bg-white/[0.08]",
  notice: "border-emerald-400/18 bg-emerald-400/10 text-emerald-100",
  footerShell:
    "border-white/10 bg-[linear-gradient(180deg,rgba(2,6,23,0.28),rgba(2,6,23,0.92)_40%)]",
  footerCard:
    "border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(15,23,42,0.68))] shadow-[0_20px_45px_-34px_rgba(2,6,23,0.92)]",
  footerTitle: "text-slate-100",
  footerDescription: "text-slate-400",
  footerStatus: "border-white/10 bg-slate-950/60 text-slate-300",
  resetButton:
    "border-white/10 bg-white/[0.04] text-slate-200 transition hover:border-white/15 hover:bg-white/[0.08]",
  toastSuccess: "border-emerald-400/20 bg-emerald-400/12 text-emerald-100",
  toastError: "border-rose-400/20 bg-rose-400/12 text-rose-100",
  toastIcon: "border-white/10 bg-white/10",
  sectionShell: "border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.06),rgba(10,18,34,0.82))]",
  sectionIcon: "border-white/10 bg-slate-950/60 text-cyan-200",
  sectionTitle: "text-slate-200",
  sectionUnderline: "bg-[linear-gradient(90deg,rgba(34,211,238,0.8),transparent)]",
  sectionDescription: "text-slate-400",
  card: "border-white/10 bg-white/[0.04]",
  strongCard:
    "border-white/10 bg-[linear-gradient(145deg,rgba(255,255,255,0.05),rgba(15,23,42,0.58))]",
  label: "text-slate-400",
  textPrimary: "text-slate-50",
  textSecondary: "text-slate-300",
  textMuted: "text-slate-400",
  iconAccent: "text-cyan-200",
  chip: "border-white/10 bg-white/[0.06] text-slate-300",
  badge: "border-white/10 bg-slate-950/60 text-slate-200",
  accentButton:
    "border-cyan-300/20 bg-cyan-400/10 text-cyan-100 shadow-[0_12px_30px_-20px_rgba(34,211,238,0.5)]",
  subtleButton:
    "border-white/10 bg-white/[0.06] text-slate-200 transition hover:border-white/15 hover:bg-white/[0.08]",
  input:
    "border-white/10 bg-white/[0.04] text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-300/35 focus:bg-white/[0.06]",
  inputGroup: "border-white/10 bg-white/[0.04]",
  activeChip:
    "border-cyan-300/30 bg-cyan-400/10 text-cyan-100 shadow-[0_0_0_1px_rgba(34,211,238,0.2)]",
  inactiveChip: "border-white/10 bg-white/[0.04] text-slate-300",
  toggleRow: "border-white/10 bg-white/[0.04]",
  toggleLabel: "text-slate-100",
  toggleDescription: "text-slate-400",
  toggleOn:
    "border-cyan-300/35 bg-[linear-gradient(135deg,rgba(34,211,238,0.18),rgba(14,165,233,0.26))]",
  toggleOff: "border-white/10 bg-white/[0.06]",
  toggleThumbOn:
    "translate-x-[1.3rem] bg-[linear-gradient(135deg,#ecfeff,#67e8f9)] text-slate-950 shadow-[0_0_0_1px_rgba(34,211,238,0.35),0_10px_24px_-12px_rgba(34,211,238,0.8)]",
  toggleThumbOff:
    "translate-x-0 bg-white text-slate-900 shadow-[0_10px_24px_-14px_rgba(15,23,42,0.6)]",
  successCallout: "border-emerald-400/15 bg-emerald-400/10 text-emerald-100",
  warningCard:
    "border-amber-300/18 bg-[linear-gradient(145deg,rgba(217,119,6,0.14),rgba(15,23,42,0.72))] text-amber-50",
  warningSubtle: "text-amber-100/80",
  logoutButton:
    "border-rose-400/18 bg-[linear-gradient(135deg,rgba(248,113,113,0.16),rgba(127,29,29,0.26))] text-rose-100",
  deleteButton:
    "border-white/10 bg-white/[0.06] text-slate-200 transition hover:border-white/15 hover:bg-white/[0.08]",
};

export function useSettingsThemeClasses() {
  const isLightTheme = useSettingsPanelStore((state) => state.draft.appearance?.theme === "peach-glow");

  return {
    isLightTheme,
    theme: isLightTheme ? LIGHT_THEME : DARK_THEME,
  };
}
