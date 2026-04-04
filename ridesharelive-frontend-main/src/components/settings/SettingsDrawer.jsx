import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CheckCircle2, RotateCcw, Save, Sparkles, X } from "lucide-react";
import { useSettingsPanelStore } from "../../stores/useSettingsPanelStore";
import { ACCENT_THEMES } from "../../utils/settingsDrawerState";
import AppearanceSection from "./sections/AppearanceSection";
import LogoutSection from "./sections/LogoutSection";
import NotificationsSection from "./sections/NotificationsSection";
import PaymentsSection from "./sections/PaymentsSection";
import ProfileSection from "./sections/ProfileSection";
import RidePreferencesSection from "./sections/RidePreferencesSection";
import SafetySection from "./sections/SafetySection";
import { useSettingsThemeClasses } from "./useSettingsTheme";
import { useSettingsDrawerEffects, useSwipeToClose } from "./useSettingsDrawerEffects";

const MotionAside = motion.aside;
const MotionButton = motion.button;
const MotionDiv = motion.div;

const sectionVariants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.06,
    },
  },
};

function SettingsSkeleton({ isLightTheme }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: 6 }).map((_, index) => (
        <div
          key={`settings-skeleton-${index}`}
          className={`overflow-hidden rounded-[1.5rem] border p-5 ${
            isLightTheme ? "border-slate-200/70 bg-white/76" : "border-white/10 bg-white/[0.04]"
          }`}
        >
          <div className="loading-shimmer h-5 w-40 rounded-full" />
          <div className="mt-3 loading-shimmer h-4 w-full rounded-full" />
          <div className="mt-2 loading-shimmer h-4 w-4/5 rounded-full" />
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="loading-shimmer h-12 rounded-[1rem]" />
            <div className="loading-shimmer h-12 rounded-[1rem]" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SettingsDrawer({
  isOpen,
  onClose,
  snapshot,
  defaultSnapshot,
  onSave,
  onLogout,
  onDeleteAccount,
  notice = "",
}) {
  const rootRef = useRef(null);
  const openedRef = useRef(false);
  const hydrate = useSettingsPanelStore((state) => state.hydrate);
  const finishHydration = useSettingsPanelStore((state) => state.finishHydration);
  const draft = useSettingsPanelStore((state) => state.draft);
  const isHydrating = useSettingsPanelStore((state) => state.isHydrating);
  const isSaving = useSettingsPanelStore((state) => state.isSaving);
  const isDirty = useSettingsPanelStore((state) => state.isDirty);
  const toast = useSettingsPanelStore((state) => state.toast);
  const saveCounter = useSettingsPanelStore((state) => state.saveCounter);
  const setSaving = useSettingsPanelStore((state) => state.setSaving);
  const markSaved = useSettingsPanelStore((state) => state.markSaved);
  const markSaveError = useSettingsPanelStore((state) => state.markSaveError);
  const dismissToast = useSettingsPanelStore((state) => state.dismissToast);
  const resetToDefaults = useSettingsPanelStore((state) => state.resetToDefaults);
  const { isLightTheme, theme } = useSettingsThemeClasses();
  const reduceMotion = useMemo(
    () =>
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false,
    []
  );

  const accentPalette = ACCENT_THEMES[draft.appearance?.accentTheme] || ACCENT_THEMES.cyan;
  const accentStyle = {
    "--settings-accent": accentPalette.accent,
    "--settings-accent-strong": accentPalette.accentStrong,
    "--settings-accent-soft": accentPalette.accentSoft,
  };
  const { dragOffset, handlers } = useSwipeToClose({
    enabled: isOpen && typeof window !== "undefined" && window.innerWidth < 768,
    onClose,
  });

  useSettingsDrawerEffects({
    rootRef,
    isOpen,
    reduceMotion,
    accentGlow: accentPalette.accentSoft,
    saveCounter,
  });

  useEffect(() => {
    if (!isOpen) {
      openedRef.current = false;
      dismissToast();
      return undefined;
    }

    if (openedRef.current) {
      return undefined;
    }

    // Hydrate once per open cycle so external state updates do not wipe in-drawer animations or success toasts.
    openedRef.current = true;

    hydrate(snapshot, defaultSnapshot);
    const timeoutId = window.setTimeout(() => {
      finishHydration();
    }, 240);

    return () => window.clearTimeout(timeoutId);
  }, [defaultSnapshot, dismissToast, finishHydration, hydrate, isOpen, snapshot]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleEscape = (event) => {
      if (event.key !== "Escape") {
        return;
      }
      event.preventDefault();
      onClose?.();
    };

    document.addEventListener("keydown", handleEscape, true);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleEscape, true);
    };
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!toast) {
      return undefined;
    }
    const timeoutId = window.setTimeout(() => {
      dismissToast();
    }, 2600);
    return () => window.clearTimeout(timeoutId);
  }, [dismissToast, toast]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave?.(draft);
      markSaved(draft, "Settings saved");
    } catch (error) {
      markSaveError(error?.message || "Unable to save settings.");
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <>
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className={`fixed inset-0 z-[88] ${theme.overlay}`}
            onClick={onClose}
            aria-hidden="true"
          />

          <MotionAside
            initial={{ x: "100%" }}
            animate={{ x: dragOffset || 0 }}
            exit={{ x: "100%" }}
            transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 280, damping: 30, mass: 0.92 }}
            className="fixed inset-y-0 right-0 z-[89] w-full sm:max-w-[420px]"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-drawer-title"
            style={accentStyle}
            {...handlers}
          >
            <div
              ref={rootRef}
              className={`settings-drawer relative flex h-[100dvh] flex-col backdrop-blur-2xl sm:rounded-l-3xl ${theme.drawerShell}`}
            >
              <div className={`pointer-events-none absolute inset-0 ${theme.drawerGlow}`} />

              <header className={`sticky top-0 z-10 px-5 py-4 backdrop-blur-xl sm:px-6 ${theme.header}`}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className={`flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] ${theme.eyebrow}`}>
                      <Sparkles className={`h-3.5 w-3.5 ${isLightTheme ? "text-sky-500" : "text-cyan-200"}`} aria-hidden="true" />
                      RideShare preferences
                    </p>
                    <h2 id="settings-drawer-title" className={`mt-2 text-2xl font-semibold tracking-[-0.04em] ${theme.title}`}>
                      Settings
                    </h2>
                  </div>
                  <MotionButton
                    type="button"
                    aria-label="Close settings"
                    whileTap={{ scale: 0.94 }}
                    onClick={onClose}
                    className={`inline-flex h-11 w-11 items-center justify-center rounded-full border ${theme.closeButton}`}
                    data-icon-rotate=""
                  >
                    <X className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
                  </MotionButton>
                </div>
                {notice ? (
                  <div className={`mt-4 rounded-[1rem] border px-3 py-2 text-sm ${theme.notice}`}>
                    {notice}
                  </div>
                ) : null}
              </header>

              <div className="settings-drawer__scroll relative flex-1 overflow-y-auto px-5 pb-32 pt-5 sm:px-6">
                {isHydrating ? (
                  <SettingsSkeleton isLightTheme={isLightTheme} />
                ) : (
                  <motion.div variants={sectionVariants} initial="hidden" animate="visible" className="space-y-3.5">
                    <ProfileSection />
                    <RidePreferencesSection />
                    <NotificationsSection />
                    <SafetySection />
                    <PaymentsSection />
                    <AppearanceSection />
                    <LogoutSection onLogout={onLogout} onDeleteAccount={onDeleteAccount} />
                  </motion.div>
                )}
              </div>

              <div className={`sticky bottom-0 z-10 px-5 pb-5 pt-4 backdrop-blur-xl sm:px-6 ${theme.footerShell}`}>
                <div className={`rounded-[1.4rem] border p-3 ${theme.footerCard}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className={`text-sm font-semibold ${theme.footerTitle}`}>Save your workspace setup</p>
                      <p className={`mt-1 text-xs ${theme.footerDescription}`}>Reset to defaults or commit the current settings draft.</p>
                    </div>
                    <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] ${theme.footerStatus}`}>
                      {isDirty ? "Unsaved" : "Synced"}
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-[1fr,1.35fr] gap-3">
                    <MotionButton
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      disabled={isSaving}
                      onClick={resetToDefaults}
                      className={`inline-flex items-center justify-center gap-2 rounded-[1rem] border px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${theme.resetButton}`}
                    >
                      <RotateCcw className="h-4 w-4" aria-hidden="true" />
                      Reset
                    </MotionButton>
                    <MotionButton
                      type="button"
                      whileTap={{ scale: 0.97 }}
                      disabled={isSaving || isHydrating}
                      onClick={handleSave}
                      className="inline-flex items-center justify-center gap-2 rounded-[1rem] border border-cyan-300/20 bg-[linear-gradient(135deg,var(--settings-accent),var(--settings-accent-strong))] px-4 py-3 text-sm font-semibold text-slate-950 shadow-[0_18px_34px_-22px_var(--settings-accent-soft)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? (
                        <span className="inline-flex items-center gap-2">
                          <span className="loading-shimmer h-4 w-4 rounded-full" />
                          Saving...
                        </span>
                      ) : (
                        <>
                          <Save className="h-4 w-4" aria-hidden="true" />
                          Save settings
                        </>
                      )}
                    </MotionButton>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {toast ? (
                  <MotionDiv
                    initial={{ opacity: 0, y: 14, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.96 }}
                    transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    className={`pointer-events-none absolute bottom-28 left-5 right-5 z-20 rounded-[1.15rem] border px-4 py-3 shadow-[0_24px_60px_-34px_rgba(2,6,23,0.9)] sm:left-6 sm:right-6 ${
                      toast.tone === "error" ? theme.toastError : theme.toastSuccess
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-full border ${theme.toastIcon}`}
                        data-save-tick=""
                      >
                        <CheckCircle2 className="h-4.5 w-4.5" aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold">{toast.message}</p>
                        <p className="mt-1 text-xs opacity-80">
                          {toast.tone === "error" ? "Review the draft and try again." : "Your new settings are ready."}
                        </p>
                      </div>
                    </div>
                  </MotionDiv>
                ) : null}
              </AnimatePresence>
            </div>
          </MotionAside>
        </>
      ) : null}
    </AnimatePresence>
  );
}
