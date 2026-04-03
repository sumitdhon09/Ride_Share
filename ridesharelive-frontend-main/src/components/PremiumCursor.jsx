import { useEffect, useState } from "react";

export default function PremiumCursor() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const mediaQuery = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

    let cursor = null;
    let follower = null;
    let rafId = null;
    let targetX = window.innerWidth / 2;
    let targetY = window.innerHeight / 2;
    let currentX = targetX;
    let currentY = targetY;

    const syncEnabled = () => {
      const active = mediaQuery.matches && !reduceMotionQuery.matches;
      setEnabled(active);
      document.documentElement.classList.toggle("cursor-enhanced", active);
    };

    const render = () => {
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;

      if (cursor) {
        cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      if (follower) {
        follower.style.transform = `translate3d(${currentX}px, ${currentY}px, 0)`;
      }

      rafId = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const handlePointerOver = (event) => {
      const interactiveTarget = event.target.closest("[data-cursor='highlight'], button, a, [data-magnetic]");
      document.documentElement.classList.toggle("cursor-highlight", Boolean(interactiveTarget));
    };

    syncEnabled();
    cursor = document.querySelector("[data-premium-cursor='dot']");
    follower = document.querySelector("[data-premium-cursor='ring']");

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    document.addEventListener("pointerover", handlePointerOver);
    mediaQuery.addEventListener("change", syncEnabled);
    reduceMotionQuery.addEventListener("change", syncEnabled);
    rafId = window.requestAnimationFrame(render);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      document.removeEventListener("pointerover", handlePointerOver);
      mediaQuery.removeEventListener("change", syncEnabled);
      reduceMotionQuery.removeEventListener("change", syncEnabled);
      document.documentElement.classList.remove("cursor-enhanced", "cursor-highlight");
    };
  }, []);

  if (!enabled) {
    return null;
  }

  return (
    <>
      <div data-premium-cursor="ring" className="premium-cursor premium-cursor--ring" aria-hidden="true" />
      <div data-premium-cursor="dot" className="premium-cursor premium-cursor--dot" aria-hidden="true" />
    </>
  );
}
