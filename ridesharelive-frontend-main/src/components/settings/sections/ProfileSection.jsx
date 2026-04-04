import { AnimatePresence, motion } from "motion/react";
import { Mail, MapPin, PencilLine, Phone, UserRound } from "lucide-react";
import SettingsSection from "../SettingsSection";
import { useSettingsPanelStore } from "../../../stores/useSettingsPanelStore";
import { useSettingsThemeClasses } from "../useSettingsTheme";

const MotionButton = motion.button;
const MotionDiv = motion.div;

function getInitials(name) {
  const parts = String(name || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2);
  if (parts.length === 0) {
    return "RS";
  }
  return parts.map((part) => part[0]?.toUpperCase() || "").join("");
}

export default function ProfileSection() {
  const profile = useSettingsPanelStore((state) => state.draft.profile);
  const expanded = useSettingsPanelStore((state) => state.expanded.profileEditor);
  const setField = useSettingsPanelStore((state) => state.setField);
  const toggleExpanded = useSettingsPanelStore((state) => state.toggleExpanded);
  const { isLightTheme, theme } = useSettingsThemeClasses();

  return (
    <SettingsSection
      title="Profile"
      description="Your rider identity, saved pickup points, and quick account details."
      icon={UserRound}
      index={0}
    >
      <div className={`rounded-[1.35rem] border p-4 ${theme.strongCard}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-[1.4rem] border text-lg font-semibold shadow-[0_18px_38px_-28px_rgba(34,211,238,0.32)] ${
                isLightTheme
                  ? "border-sky-200/75 bg-[radial-gradient(circle_at_top,rgba(125,211,252,0.32),rgba(255,255,255,0.95))] text-slate-800"
                  : "border-cyan-300/20 bg-[radial-gradient(circle_at_top,rgba(34,211,238,0.26),rgba(15,23,42,0.92))] text-cyan-50"
              }`}
            >
              {getInitials(profile.fullName)}
            </div>
            <div className="min-w-0">
              <p className={`truncate text-base font-semibold ${theme.textPrimary}`}>{profile.fullName}</p>
              <p className={`mt-1 flex items-center gap-2 text-sm ${theme.textMuted}`}>
                <Phone className={`h-3.5 w-3.5 ${theme.iconAccent}`} aria-hidden="true" />
                <span className="truncate">{profile.phone}</span>
              </p>
              <p className={`mt-1 flex items-center gap-2 text-sm ${theme.textMuted}`}>
                <Mail className={`h-3.5 w-3.5 ${theme.iconAccent}`} aria-hidden="true" />
                <span className="truncate">{profile.email}</span>
              </p>
            </div>
          </div>
          <MotionButton
            type="button"
            whileTap={{ scale: 0.97 }}
            whileHover={{ scale: 1.01 }}
            onClick={() => toggleExpanded("profileEditor")}
            className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold ${theme.accentButton}`}
            data-settings-row=""
            data-icon-rotate=""
          >
            <PencilLine className="h-3.5 w-3.5" aria-hidden="true" />
            Edit profile
          </MotionButton>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {profile.savedAddresses.map((address) => (
            <span
              key={address}
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium ${theme.chip}`}
              data-settings-row=""
            >
              <MapPin className={`h-3.5 w-3.5 ${theme.iconAccent}`} aria-hidden="true" />
              {address}
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
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>Full name</span>
                  <input
                    type="text"
                    value={profile.fullName}
                    onChange={(event) => setField("profile", "fullName", event.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm ${theme.input}`}
                  />
                </label>
                <label className="block">
                  <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>Phone</span>
                  <input
                    type="text"
                    value={profile.phone}
                    onChange={(event) => setField("profile", "phone", event.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm ${theme.input}`}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <span className={`mb-2 block text-xs font-semibold uppercase tracking-[0.18em] ${theme.label}`}>Email</span>
                  <input
                    type="email"
                    value={profile.email}
                    onChange={(event) => setField("profile", "email", event.target.value)}
                    className={`w-full rounded-2xl border px-4 py-3 text-sm ${theme.input}`}
                  />
                </label>
              </div>
            </MotionDiv>
          ) : null}
        </AnimatePresence>
      </div>
    </SettingsSection>
  );
}
