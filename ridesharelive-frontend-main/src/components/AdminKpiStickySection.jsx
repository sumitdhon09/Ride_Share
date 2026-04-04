import gsap from "gsap";
import { memo, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion as Motion } from "motion/react";
import AdminOverviewCards from "./cards/AdminOverviewCards";

const STICKY_SCROLL_BAND_PX = 88;
const STICKY_TOP_GAP_PX = 16;
/** Matches `AdminHeader` `sticky top-3` (0.75rem). */
const HEADER_STICKY_TOP_PX = 12;

function useRafScroll(onScroll) {
  const ticking = useRef(false);
  const onScrollRef = useRef(onScroll);
  onScrollRef.current = onScroll;

  useEffect(() => {
    const handler = () => {
      if (ticking.current) {
        return;
      }
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        onScrollRef.current();
      });
    };
    window.addEventListener("scroll", handler, { passive: true });
    window.addEventListener("resize", handler, { passive: true });
    handler();
    return () => {
      window.removeEventListener("scroll", handler);
      window.removeEventListener("resize", handler);
    };
  }, []);
}

const KpiCards = memo(function KpiCards({ cards, isDark, compact }) {
  return <AdminOverviewCards cards={cards} isDark={isDark} compact={compact} />;
});

export default function AdminKpiStickySection({ cards, isDark, chartsRef, headerRef }) {
  const heroRef = useRef(null);
  const stickyShellRef = useRef(null);
  const glowRef = useRef(null);
  const [headerHeight, setHeaderHeight] = useState(72);
  const [chartsPastMid, setChartsPastMid] = useState(false);
  const [scrollPastBand, setScrollPastBand] = useState(false);
  const [isStuck, setIsStuck] = useState(false);
  const scrollSnapshot = useRef({ chartsPastMid: false, scrollPastBand: false, isStuck: false });

  const stickyTop = HEADER_STICKY_TOP_PX + headerHeight + STICKY_TOP_GAP_PX;

  useLayoutEffect(() => {
    const node = headerRef?.current;
    if (!node) {
      return undefined;
    }
    const ro = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect?.height;
      if (typeof next === "number" && next > 0) {
        setHeaderHeight(Math.round(next));
      }
    });
    ro.observe(node);
    setHeaderHeight(Math.round(node.getBoundingClientRect().height));
    return () => ro.disconnect();
  }, [headerRef]);

  const updateScrollState = useCallback(() => {
    const hero = heroRef.current;
    const charts = chartsRef?.current;
    if (!hero) {
      return;
    }

    const heroDocTop = hero.getBoundingClientRect().top + window.scrollY;
    const stickScrollStart = Math.max(0, heroDocTop - stickyTop);
    const pastBand = window.scrollY >= stickScrollStart + STICKY_SCROLL_BAND_PX;

    let chartsMid = false;
    if (charts) {
      chartsMid = charts.getBoundingClientRect().top < window.innerHeight * 0.5;
    }

    const stickyWindow = !chartsMid && !pastBand;
    const shell = stickyShellRef.current;
    let nextStuck = false;
    if (shell && stickyWindow) {
      const shellRect = shell.getBoundingClientRect();
      nextStuck = shellRect.top <= stickyTop + 2;
    }

    const snap = scrollSnapshot.current;
    if (snap.chartsPastMid !== chartsMid) {
      snap.chartsPastMid = chartsMid;
      setChartsPastMid(chartsMid);
    }
    if (snap.scrollPastBand !== pastBand) {
      snap.scrollPastBand = pastBand;
      setScrollPastBand(pastBand);
    }
    if (snap.isStuck !== nextStuck) {
      snap.isStuck = nextStuck;
      setIsStuck(nextStuck);
    }
  }, [chartsRef, stickyTop]);

  useRafScroll(updateScrollState);

  const stickyActive = !chartsPastMid && !scrollPastBand;
  const glassOn = stickyActive && isStuck;

  useEffect(() => {
    const el = glowRef.current;
    if (!el) {
      return;
    }
    gsap.killTweensOf(el);
    if (glassOn) {
      gsap.to(el, {
        boxShadow: isDark
          ? "0 22px 48px -18px rgba(0,0,0,0.65), 0 0 0 1px rgba(148,163,184,0.12), 0 0 42px -8px rgba(56,189,248,0.14)"
          : "0 20px 44px -16px rgba(15,23,42,0.18), 0 0 0 1px rgba(148,163,184,0.2), 0 0 36px -6px rgba(14,165,233,0.12)",
        duration: 0.38,
        ease: "power2.out",
      });
    } else {
      gsap.to(el, {
        boxShadow: isDark
          ? "0 12px 28px -20px rgba(0,0,0,0.45), 0 0 0 1px rgba(148,163,184,0.06)"
          : "0 10px 26px -18px rgba(15,23,42,0.12), 0 0 0 1px rgba(226,232,240,0.7)",
        duration: 0.42,
        ease: "power2.out",
      });
    }
  }, [glassOn, isDark]);

  return (
    <div
      ref={heroRef}
      className={stickyActive ? "pb-[5.5rem]" : "pb-0"}
      style={{ transition: "padding-bottom 0.45s cubic-bezier(0.22, 1, 0.36, 1)" }}
    >
      <Motion.div
        ref={stickyShellRef}
        className={`z-30 will-change-transform ${stickyActive ? "sticky" : "relative"}`}
        style={{ top: stickyActive ? stickyTop : undefined }}
        animate={{
          scale: glassOn ? 0.992 : 1,
          y: glassOn ? -3 : 0,
        }}
        transition={{ type: "spring", stiffness: 420, damping: 32, mass: 0.85 }}
      >
        <div
          ref={glowRef}
          className={[
            "rounded-[1.75rem] border transition-[border-color,background-color,backdrop-filter] duration-300 ease-out",
            glassOn
              ? isDark
                ? "border-white/[0.07] bg-[linear-gradient(180deg,rgba(255,255,255,0.06),rgba(12,20,36,0.82))] backdrop-blur-xl"
                : "border-slate-200/55 bg-white/78 backdrop-blur-xl"
              : isDark
                ? "border-transparent bg-transparent"
                : "border-transparent bg-transparent",
            glassOn ? "ring-1 ring-white/10" : "ring-0 ring-transparent",
          ].join(" ")}
        >
          {glassOn ? (
            <div
              className={`pointer-events-none mx-4 mt-3 h-px rounded-full ${isDark ? "bg-gradient-to-r from-transparent via-white/18 to-transparent" : "bg-gradient-to-r from-transparent via-slate-300/80 to-transparent"}`}
              aria-hidden
            />
          ) : null}
          <div className={glassOn ? "px-3 pb-3 pt-2 sm:px-4 sm:pb-3.5 sm:pt-2.5" : "p-0"}>
            <KpiCards cards={cards} isDark={isDark} compact={glassOn} />
          </div>
        </div>
      </Motion.div>
    </div>
  );
}
