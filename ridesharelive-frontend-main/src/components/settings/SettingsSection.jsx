import { motion } from "motion/react";
import { useSettingsThemeClasses } from "./useSettingsTheme";

const MotionSection = motion.section;

export default function SettingsSection({ title, description, icon, children, index = 0 }) {
  const SectionIcon = icon;
  const { theme } = useSettingsThemeClasses();

  return (
    <MotionSection
      variants={{
        hidden: { opacity: 0, y: 18 },
        visible: {
          opacity: 1,
          y: 0,
          transition: { duration: 0.28, delay: index * 0.04, ease: [0.22, 1, 0.36, 1] },
        },
      }}
      className={`settings-section rounded-[1.55rem] border p-4 sm:p-5 ${theme.sectionShell}`}
      data-settings-section=""
    >
      <div className="settings-section__header flex items-start gap-3">
        <span
          className={`inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] ${theme.sectionIcon}`}
          data-icon-rotate=""
        >
          <SectionIcon className="h-[1.05rem] w-[1.05rem]" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h3 className={`text-sm font-semibold uppercase tracking-[0.22em] ${theme.sectionTitle}`}>{title}</h3>
            <span className={`settings-section__underline h-px flex-1 origin-left ${theme.sectionUnderline}`} data-settings-underline="" />
          </div>
          {description ? <p className={`mt-2 text-sm leading-6 ${theme.sectionDescription}`}>{description}</p> : null}
        </div>
      </div>
      <div className="mt-4 space-y-3">{children}</div>
    </MotionSection>
  );
}
