import { AnimatePresence, motion } from "motion/react";

const TOAST_TONE_CLASS = {
  info: "border-cyan-200 bg-cyan-50 text-cyan-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-900",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
};
const MotionDiv = motion.div;

export default function LiveUpdateToast({ toast }) {
  const tone = toast?.tone || "info";
  const toneClass = TOAST_TONE_CLASS[tone] || TOAST_TONE_CLASS.info;

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[70] sm:right-6">
      <AnimatePresence>
        {toast?.message ? (
          <MotionDiv
            key={toast.id || toast.message}
            initial={{ opacity: 0, x: 18, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 14, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={`w-[18rem] max-w-[88vw] rounded-2xl border px-3 py-2 shadow-lg backdrop-blur ${toneClass}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80">Live update</p>
            <p className="mt-1 text-sm font-semibold">{toast.message}</p>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
