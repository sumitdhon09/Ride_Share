import { AnimatePresence, motion } from "motion/react";
import { Plus, Shield, ShieldCheck, Users, X } from "lucide-react";
import { useState } from "react";
import SettingsSection from "../SettingsSection";
import ToggleSwitch from "../ToggleSwitch";
import { useSettingsPanelStore } from "../../../stores/useSettingsPanelStore";
import { useSettingsThemeClasses } from "../useSettingsTheme";

const MotionButton = motion.button;
const MotionDiv = motion.div;

export default function SafetySection() {
  const safety = useSettingsPanelStore((state) => state.draft.safety);
  const expanded = useSettingsPanelStore((state) => state.expanded.trustedContacts);
  const toggleExpanded = useSettingsPanelStore((state) => state.toggleExpanded);
  const toggleField = useSettingsPanelStore((state) => state.toggleField);
  const addListItem = useSettingsPanelStore((state) => state.addListItem);
  const removeListItem = useSettingsPanelStore((state) => state.removeListItem);
  const [contactInput, setContactInput] = useState("");
  const { theme } = useSettingsThemeClasses();

  const addTrustedContact = () => {
    addListItem("safety", "trustedContacts", contactInput);
    setContactInput("");
  };

  return (
    <SettingsSection
      title="Safety"
      description="Keep emergency sharing, OTP flow, and night safeguards ready before every ride."
      icon={ShieldCheck}
      index={3}
    >
      <div className={`rounded-[1.2rem] border p-4 ${theme.card}`}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className={`text-sm font-semibold ${theme.textPrimary}`}>Trusted contacts</p>
            <p className={`mt-1 text-xs leading-5 ${theme.textMuted}`}>People who receive your live trip and SOS status.</p>
          </div>
          <MotionButton
            type="button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => toggleExpanded("trustedContacts")}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold ${theme.subtleButton}`}
            data-settings-row=""
          >
            <Users className={`h-3.5 w-3.5 ${theme.iconAccent}`} aria-hidden="true" />
            Manage
          </MotionButton>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {safety.trustedContacts.map((contact, index) => (
            <span
              key={`${contact}-${index}`}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${theme.badge}`}
              data-settings-row=""
            >
              {contact}
              <button
                type="button"
                aria-label={`Remove ${contact}`}
                className={`inline-flex h-4 w-4 items-center justify-center rounded-full transition ${theme.textMuted} hover:text-rose-500`}
                onClick={() => removeListItem("safety", "trustedContacts", index)}
              >
                <X className="h-3 w-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {expanded ? (
            <MotionDiv
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="mt-4 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  value={contactInput}
                  onChange={(event) => setContactInput(event.target.value)}
                  placeholder="Add name and phone"
                  className={`w-full rounded-2xl border px-4 py-3 text-sm ${theme.input}`}
                />
                <MotionButton
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  whileHover={{ scale: 1.01 }}
                  onClick={addTrustedContact}
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl border px-4 py-3 text-sm font-semibold ${theme.accentButton}`}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add contact
                </MotionButton>
              </div>
            </MotionDiv>
          ) : null}
        </AnimatePresence>
      </div>

      <ToggleSwitch
        id="live-trip-sharing"
        checked={safety.liveTripSharing}
        onChange={() => toggleField("safety", "liveTripSharing")}
        label="Live trip sharing"
        description="Send your route and status to trusted contacts automatically."
      />
      <ToggleSwitch
        id="otp-verification"
        checked={safety.otpVerification}
        onChange={() => toggleField("safety", "otpVerification")}
        label="OTP verification"
        description="Keep OTP confirmation enabled during pickup and trip close."
      />
      <ToggleSwitch
        id="night-safety-mode"
        checked={safety.nightSafetyMode}
        onChange={() => toggleField("safety", "nightSafetyMode")}
        label="Night safety mode"
        description="Stronger monitoring and fast safety nudges after dark."
      />

      <div
        className={`flex items-center gap-3 rounded-[1.15rem] border px-4 py-3 text-sm ${theme.successCallout}`}
        data-settings-row=""
      >
        <Shield className="h-4 w-4 shrink-0" aria-hidden="true" />
        <span>Security stack stays active across OTP, trip sharing, and after-hours routing.</span>
      </div>
    </SettingsSection>
  );
}
