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
    let cursorActive = false;
    let interactiveElements = [];
    const magneticStates = new Map();
    /** Only explicit `[data-magnetic]` targets — applying pull to every button breaks clicks. */
    const interactiveSelector = "[data-magnetic]:not([disabled])";

    const resolveCursorNodes = () => {
      if (!cursor) {
        cursor = document.querySelector("[data-premium-cursor='dot']");
      }
      if (!follower) {
        follower = document.querySelector("[data-premium-cursor='ring']");
      }
    };

    const resetMagneticElement = (element) => {
      if (!element) {
        return;
      }
      element.style.removeProperty("translate");
      element.style.removeProperty("scale");
      element.style.removeProperty("--cursor-proximity");
      element.classList.remove("cursor-proximity");
      magneticStates.delete(element);
    };

    const refreshInteractiveElements = () => {
      interactiveElements = Array.from(document.querySelectorAll(interactiveSelector)).filter(
        (element) => !element.closest("[data-no-cursor-magnetic]")
      );

      Array.from(magneticStates.keys()).forEach((element) => {
        if (!interactiveElements.includes(element)) {
          resetMagneticElement(element);
        }
      });
    };

    const updateMagneticElement = (element) => {
      if (!element.isConnected) {
        resetMagneticElement(element);
        return;
      }

      const rect = element.getBoundingClientRect();
      if (
        rect.width < 12 ||
        rect.height < 12 ||
        rect.bottom < -40 ||
        rect.top > window.innerHeight + 40 ||
        rect.right < -40 ||
        rect.left > window.innerWidth + 40
      ) {
        resetMagneticElement(element);
        return;
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const dx = targetX - centerX;
      const dy = targetY - centerY;
      const distance = Math.hypot(dx, dy);
      const range =
        Number(element.dataset.magneticRange) ||
        Math.max(88, Math.min(180, Math.max(rect.width, rect.height) * 1.4));
      const strengthRaw = element.dataset.magneticStrength;
      const strength = strengthRaw === undefined || strengthRaw === "" ? 10 : Number(strengthRaw);
      if (!Number.isFinite(strength) || strength === 0) {
        resetMagneticElement(element);
        return;
      }
      const state = magneticStates.get(element) || {
        tx: 0,
        ty: 0,
        scale: 1,
        proximity: 0,
        targetTx: 0,
        targetTy: 0,
        targetScale: 1,
        targetProximity: 0,
      };

      if (cursorActive && distance < range) {
        const proximity = 1 - distance / range;
        state.targetTx = (dx / range) * strength * proximity;
        state.targetTy = (dy / range) * strength * proximity;
        state.targetScale = 1 + proximity * 0.024;
        state.targetProximity = proximity;
      } else {
        state.targetTx = 0;
        state.targetTy = 0;
        state.targetScale = 1;
        state.targetProximity = 0;
      }

      state.tx += (state.targetTx - state.tx) * 0.2;
      state.ty += (state.targetTy - state.ty) * 0.2;
      state.scale += (state.targetScale - state.scale) * 0.18;
      state.proximity += (state.targetProximity - state.proximity) * 0.18;

      if (
        Math.abs(state.tx) < 0.08 &&
        Math.abs(state.ty) < 0.08 &&
        Math.abs(state.scale - 1) < 0.004 &&
        state.proximity < 0.015
      ) {
        resetMagneticElement(element);
        return;
      }

      element.style.translate = `${state.tx.toFixed(2)}px ${state.ty.toFixed(2)}px`;
      element.style.scale = state.scale.toFixed(3);
      element.style.setProperty("--cursor-proximity", state.proximity.toFixed(3));
      element.classList.toggle("cursor-proximity", state.proximity > 0.02);
      magneticStates.set(element, state);
    };

    const syncEnabled = () => {
      cursorActive = mediaQuery.matches && !reduceMotionQuery.matches;
      setEnabled(cursorActive);
      document.documentElement.classList.toggle("cursor-enhanced", cursorActive);

      if (!cursorActive) {
        interactiveElements.forEach((element) => resetMagneticElement(element));
      } else {
        refreshInteractiveElements();
      }
    };

    const render = () => {
      resolveCursorNodes();

      if (cursor) {
        cursor.style.opacity = cursorActive ? "1" : "0";
        cursor.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }
      if (follower) {
        follower.style.opacity = cursorActive ? "1" : "0";
        follower.style.transform = `translate3d(${targetX}px, ${targetY}px, 0)`;
      }

      interactiveElements.forEach((element) => updateMagneticElement(element));

      rafId = window.requestAnimationFrame(render);
    };

    const handlePointerMove = (event) => {
      targetX = event.clientX;
      targetY = event.clientY;
    };

    const handlePointerOver = (event) => {
      let interactiveTarget = event.target.closest("[data-cursor='highlight'], button, a, [data-magnetic]");
      if (interactiveTarget?.closest("[data-static-site-header]")) {
        interactiveTarget = null;
      }
      document.documentElement.classList.toggle("cursor-highlight", Boolean(interactiveTarget));
    };

    const mutationObserver = new MutationObserver(() => {
      refreshInteractiveElements();
    });

    syncEnabled();
    refreshInteractiveElements();
    mutationObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("resize", refreshInteractiveElements);
    document.addEventListener("pointerover", handlePointerOver);
    mediaQuery.addEventListener("change", syncEnabled);
    reduceMotionQuery.addEventListener("change", syncEnabled);
    rafId = window.requestAnimationFrame(render);

    return () => {
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", refreshInteractiveElements);
      document.removeEventListener("pointerover", handlePointerOver);
      mediaQuery.removeEventListener("change", syncEnabled);
      reduceMotionQuery.removeEventListener("change", syncEnabled);
      mutationObserver.disconnect();
      interactiveElements.forEach((element) => resetMagneticElement(element));
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
