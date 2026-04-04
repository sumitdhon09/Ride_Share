import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const MotionDiv = motion.div;

function resolveToastTheme() {
  if (typeof document === "undefined") {
    return "light";
  }
  return document.documentElement.dataset.theme === "dark-theme" ? "dark" : "light";
}

function toastToneClass(tone, theme) {
  const lightMap = {
    info: "border-rose-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,236,230,0.92),rgba(254,234,244,0.94))] text-rose-950 shadow-[0_24px_60px_-36px_rgba(251,113,133,0.35)]",
    success: "border-emerald-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(240,253,244,0.94),rgba(255,244,239,0.92))] text-emerald-950 shadow-[0_24px_60px_-36px_rgba(16,185,129,0.28)]",
    warning: "border-amber-200/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,251,235,0.94),rgba(255,236,230,0.92))] text-amber-950 shadow-[0_24px_60px_-36px_rgba(245,158,11,0.26)]",
  };
  const darkMap = {
    info: "border-rose-300/20 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(30,27,39,0.95))] text-rose-100 shadow-[0_28px_80px_-42px_rgba(251,113,133,0.34)]",
    success: "border-emerald-300/20 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(19,37,31,0.95))] text-emerald-100 shadow-[0_28px_80px_-42px_rgba(16,185,129,0.3)]",
    warning: "border-amber-300/20 bg-[linear-gradient(145deg,rgba(15,23,42,0.95),rgba(53,37,23,0.95))] text-amber-100 shadow-[0_28px_80px_-42px_rgba(245,158,11,0.28)]",
  };
  const map = theme === "dark" ? darkMap : lightMap;
  return map[tone] || map.info;
}

export default function LiveUpdateToast({ toast }) {
  const [visibleToast, setVisibleToast] = useState(toast);
  const [theme, setTheme] = useState(resolveToastTheme);
  const tone = visibleToast?.tone || "info";
  const toneClass = toastToneClass(tone, theme);

  useEffect(() => {
    setVisibleToast(toast);
  }, [toast]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return undefined;
    }
    const root = document.documentElement;
    const syncTheme = () => setTheme(resolveToastTheme());
    syncTheme();
    const observer = new MutationObserver(syncTheme);
    observer.observe(root, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!visibleToast?.message) {
      return undefined;
    }

    const timerId = window.setTimeout(() => {
      setVisibleToast(null);
    }, 5000);

    return () => window.clearTimeout(timerId);
  }, [visibleToast]);

  return (
    <div className="pointer-events-none fixed right-4 top-24 z-[70] sm:right-6">
      <AnimatePresence>
        {visibleToast?.message ? (
          <MotionDiv
            key={visibleToast.id || visibleToast.message}
            initial={{ opacity: 0, x: 18, y: 8 }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, x: 14, y: -6 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className={`w-[18rem] max-w-[88vw] rounded-2xl border px-3 py-2.5 backdrop-blur-xl ${toneClass}`}
          >
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-75">Live update</p>
            <p className="mt-1 text-sm font-semibold">{visibleToast.message}</p>
          </MotionDiv>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
