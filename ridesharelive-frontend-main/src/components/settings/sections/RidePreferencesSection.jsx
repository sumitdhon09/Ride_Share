import { CarFront, PawPrint, ShieldCheck, Snowflake, VolumeX } from "lucide-react";
import SettingsSection from "../SettingsSection";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsPanelStore } from "../../../stores/useSettingsPanelStore";
import { useSettingsThemeClasses } from "../useSettingsTheme";

const RIDE_OPTIONS = [
  { value: "bike", label: "Bike" },
  { value: "mini", label: "Mini" },
  { value: "sedan", label: "Sedan" },
  { value: "auto", label: "Auto" },
];

export default function RidePreferencesSection() {
  const ridePreferences = useSettingsPanelStore((state) => state.draft.ridePreferences);
  const setField = useSettingsPanelStore((state) => state.setField);
  const toggleField = useSettingsPanelStore((state) => state.toggleField);
  const { isLightTheme, theme } = useSettingsThemeClasses();

  return (
    <SettingsSection
      title="Ride Preferences"
      description="Set your default vehicle behavior before the next request goes live."
      icon={CarFront}
      index={1}
    >
      <label className="block" data-settings-row="">
        <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>
          Preferred ride type
        </span>
        <select
          value={ridePreferences.preferredRideType}
          onChange={(event) => setField("ridePreferences", "preferredRideType", event.target.value)}
          className={`w-full rounded-2xl border px-4 py-3 text-sm ${theme.input}`}
        >
          {RIDE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      <ToggleSwitch
        id="silent-ride-mode"
        checked={ridePreferences.silentRideMode}
        onChange={() => toggleField("ridePreferences", "silentRideMode")}
        label="Silent ride mode"
        description="Default to a quieter cabin and fewer interruptions."
      />
      <ToggleSwitch
        id="female-driver-preference"
        checked={ridePreferences.femaleDriverPreference}
        onChange={() => toggleField("ridePreferences", "femaleDriverPreference")}
        label="Female driver preference"
        description="Prefer a female captain when supply is available."
      />
      <ToggleSwitch
        id="ac-default"
        checked={ridePreferences.acRideDefault}
        onChange={() => toggleField("ridePreferences", "acRideDefault")}
        label="AC ride default"
        description="Always start fare estimates with AC enabled."
      />
      <ToggleSwitch
        id="pet-friendly"
        checked={ridePreferences.petFriendly}
        onChange={() => toggleField("ridePreferences", "petFriendly")}
        label="Pet-friendly"
        description="Keep pet-ready rides in your suggestion stack."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { icon: VolumeX, label: "Silent ready" },
          { icon: ShieldCheck, label: "Safer match" },
          { icon: PawPrint, label: "Pet option" },
          { icon: Snowflake, label: "AC default" },
        ].map((item) => (
          <div
            key={item.label}
            className={`inline-flex items-center gap-2 rounded-2xl border px-3 py-3 text-sm ${
              isLightTheme ? theme.card : theme.inactiveChip
            }`}
            data-settings-row=""
          >
            <item.icon className={`h-4 w-4 ${theme.iconAccent}`} aria-hidden="true" />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </SettingsSection>
  );
}
