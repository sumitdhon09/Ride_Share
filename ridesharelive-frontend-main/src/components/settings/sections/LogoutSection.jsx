import { motion } from "motion/react";
import { AlertTriangle, LogOut, Trash2 } from "lucide-react";
import SettingsSection from "../SettingsSection";
import { useSettingsThemeClasses } from "../useSettingsTheme";

const MotionButton = motion.button;

export default function LogoutSection({ onLogout, onDeleteAccount }) {
  const { theme } = useSettingsThemeClasses();

  return (
    <SettingsSection
      title="Logout"
      description="Account exit controls live in a dedicated danger zone."
      icon={LogOut}
      index={6}
    >
      <div
        className={`rounded-[1.25rem] border p-4 text-sm ${theme.warningCard}`}
        data-logout-warning=""
      >
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-200" aria-hidden="true" />
          <div>
            <p className="font-semibold">Leaving this device?</p>
            <p className={`mt-1 leading-6 ${theme.warningSubtle}`}>
              Logging out removes your active session from this browser. Delete request flags your account for review.
            </p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <MotionButton
          type="button"
          whileTap={{ scale: 0.97 }}
          whileHover={{
            scale: 1.01,
            boxShadow: "0 0 0 1px rgba(250,204,21,0.18), 0 18px 34px -24px rgba(248,113,113,0.42)",
          }}
          onClick={onLogout}
          className={`inline-flex items-center justify-center gap-2 rounded-[1.15rem] border px-4 py-3.5 text-sm font-semibold ${theme.logoutButton}`}
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          Logout
        </MotionButton>
        <MotionButton
          type="button"
          whileTap={{ scale: 0.97 }}
          whileHover={{ scale: 1.01 }}
          onClick={onDeleteAccount}
          className={`inline-flex items-center justify-center gap-2 rounded-[1.15rem] border px-4 py-3.5 text-sm font-semibold ${theme.deleteButton}`}
        >
          <Trash2 className="h-4 w-4" aria-hidden="true" />
          Delete account
        </MotionButton>
      </div>
    </SettingsSection>
  );
}
