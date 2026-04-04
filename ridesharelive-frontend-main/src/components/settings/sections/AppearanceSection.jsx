import { Gauge, Map, MoonStar, Palette, SunMedium } from "lucide-react";
import SettingsSection from "../SettingsSection";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsPanelStore } from "../../../stores/useSettingsPanelStore";
import { ACCENT_THEMES } from "../../../utils/settingsDrawerState";
import { useSettingsThemeClasses } from "../useSettingsTheme";

const MAP_STYLE_OPTIONS = ["standard", "satellite", "terrain"];

export default function AppearanceSection() {
  const appearance = useSettingsPanelStore((state) => state.draft.appearance);
  const setField = useSettingsPanelStore((state) => state.setField);
  const { isLightTheme, theme } = useSettingsThemeClasses();

  return (
    <SettingsSection
      title="Appearance"
      description="Tune visual density, motion, map presentation, and your preferred interface theme."
      icon={Palette}
      index={5}
    >
      <div className={`rounded-[1.2rem] border p-4 ${theme.card}`} data-settings-row="">
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>Dark / Light</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setField("appearance", "theme", "dark-theme")}
            className={`flex items-center justify-center gap-2 rounded-[1rem] border px-3 py-3 text-sm font-semibold transition ${
              appearance.theme === "dark-theme" ? theme.activeChip : theme.inactiveChip
            }`}
          >
            <MoonStar className="h-4 w-4" aria-hidden="true" />
            Dark
          </button>
          <button
            type="button"
            onClick={() => setField("appearance", "theme", "peach-glow")}
            className={`flex items-center justify-center gap-2 rounded-[1rem] border px-3 py-3 text-sm font-semibold transition ${
              appearance.theme === "peach-glow" ? theme.activeChip : theme.inactiveChip
            }`}
          >
            <SunMedium className="h-4 w-4" aria-hidden="true" />
            Light
          </button>
        </div>
      </div>

      <div className={`rounded-[1.2rem] border p-4 ${theme.card}`} data-settings-row="">
        <p className={`text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>Accent theme</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {Object.values(ACCENT_THEMES).map((accent) => {
            const active = appearance.accentTheme === accent.id;
            return (
              <button
                key={accent.id}
                type="button"
                onClick={() => setField("appearance", "accentTheme", accent.id)}
                className={`rounded-[1rem] border px-3 py-3 text-sm font-semibold transition ${
                  active
                    ? isLightTheme
                      ? "border-sky-300/45 bg-white/88 text-slate-800 shadow-[0_0_0_1px_rgba(56,189,248,0.16)]"
                      : "border-cyan-300/25 bg-white/[0.08] text-slate-50 shadow-[0_0_0_1px_rgba(34,211,238,0.18)]"
                    : theme.inactiveChip
                }`}
              >
                <span
                  className="mx-auto mb-2 block h-7 w-7 rounded-full border border-white/10"
                  style={{ background: `linear-gradient(135deg, ${accent.accent}, ${accent.accentStrong})` }}
                />
                {accent.label}
              </button>
            );
          })}
        </div>
      </div>

      <ToggleSwitch
        id="compact-mode"
        checked={appearance.compactMode}
        onChange={() => setField("appearance", "compactMode", !appearance.compactMode)}
        label="Compact mode"
        description="Reduce panel density and tighten control spacing."
      />

      <div className={`rounded-[1.2rem] border p-4 ${theme.card}`} data-settings-row="">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${theme.textPrimary}`}>Animation intensity</p>
            <p className={`mt-1 text-xs ${theme.textMuted}`}>Control motion softness and glow energy.</p>
          </div>
          <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold ${theme.badge}`}>
            <Gauge className={`h-3.5 w-3.5 ${theme.iconAccent}`} aria-hidden="true" />
            {appearance.animationIntensity}%
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          value={appearance.animationIntensity}
          onChange={(event) => setField("appearance", "animationIntensity", Number(event.target.value))}
          className="mt-4 w-full accent-cyan-400"
          aria-label="Animation intensity"
        />
      </div>

      <label className="block" data-settings-row="">
        <span className={`mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>
          <Map className={`h-3.5 w-3.5 ${theme.iconAccent}`} aria-hidden="true" />
          Map style
        </span>
        <select
          value={appearance.mapStyle}
          onChange={(event) => setField("appearance", "mapStyle", event.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm ${theme.input}`}
        >
          {MAP_STYLE_OPTIONS.map((option) => (
            <option key={option} value={option}>
              {option.charAt(0).toUpperCase() + option.slice(1)}
            </option>
          ))}
        </select>
      </label>
    </SettingsSection>
  );
}
