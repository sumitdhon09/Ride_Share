import { motion } from "motion/react";
import { useSettingsThemeClasses } from "./useSettingsTheme";

const MotionButton = motion.button;
const MotionSpan = motion.span;

export default function ToggleSwitch({ checked, onChange, label, description, disabled = false, id }) {
  const { theme } = useSettingsThemeClasses();

  return (
    <div
      className={`settings-toggle-row flex items-center justify-between gap-4 rounded-[1.15rem] border px-4 py-3.5 transition-colors ${theme.toggleRow}`}
      data-settings-row=""
    >
      <div className="min-w-0">
        <p className={`truncate text-sm font-semibold ${theme.toggleLabel}`}>{label}</p>
        {description ? <p className={`mt-1 text-xs leading-5 ${theme.toggleDescription}`}>{description}</p> : null}
      </div>
      <MotionButton
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={id || label}
        disabled={disabled}
        whileTap={{ scale: 0.96 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        onClick={onChange}
        data-toggle-glow={checked ? "active" : "idle"}
        className={`settings-toggle relative inline-flex h-8 w-[3.4rem] items-center rounded-full border p-1 transition ${
          checked ? theme.toggleOn : theme.toggleOff
        } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
      >
        <MotionSpan
          layout
          transition={{ type: "spring", stiffness: 520, damping: 34 }}
          className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${checked ? theme.toggleThumbOn : theme.toggleThumbOff}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-current" />
        </MotionSpan>
      </MotionButton>
    </div>
  );
}
