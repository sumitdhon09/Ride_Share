import { useEffect, useRef, useState } from "react";
import gsap from "gsap";

export function useSwipeToClose({ enabled, onClose }) {
  const startXRef = useRef(0);
  const [dragOffset, setDragOffset] = useState(0);

  const handlers = {
    onTouchStart(event) {
      if (!enabled) {
        return;
      }
      startXRef.current = event.touches[0]?.clientX || 0;
    },
    onTouchMove(event) {
      if (!enabled) {
        return;
      }
      const currentX = event.touches[0]?.clientX || 0;
      const delta = Math.max(0, currentX - startXRef.current);
      setDragOffset(Math.min(delta, 180));
    },
    onTouchEnd() {
      if (!enabled) {
        return;
      }
      if (dragOffset > 90) {
        onClose?.();
      }
      setDragOffset(0);
    },
  };

  useEffect(() => {
    if (!enabled && dragOffset !== 0) {
      setDragOffset(0);
    }
  }, [dragOffset, enabled]);

  return { dragOffset, handlers };
}

export function useSettingsDrawerEffects({ rootRef, isOpen, reduceMotion, accentGlow, saveCounter }) {
  useEffect(() => {
    if (!isOpen || reduceMotion || !rootRef.current) {
      return undefined;
    }

    const cleanups = [];
    const ctx = gsap.context(() => {
      gsap.fromTo(
        rootRef.current.querySelectorAll("[data-settings-underline]"),
        { scaleX: 0, opacity: 0.4 },
        { scaleX: 1, opacity: 1, duration: 0.6, stagger: 0.06, ease: "power3.out", transformOrigin: "left center" }
      );

      rootRef.current.querySelectorAll("[data-icon-rotate]").forEach((node) => {
        const handleEnter = () => {
          gsap.fromTo(node, { rotate: 0 }, { rotate: 18, duration: 0.22, ease: "power2.out", yoyo: true, repeat: 1 });
        };
        node.addEventListener("pointerenter", handleEnter);
        cleanups.push(() => node.removeEventListener("pointerenter", handleEnter));
      });

      rootRef.current.querySelectorAll("[data-settings-row]").forEach((node) => {
        const handleMove = (event) => {
          const rect = node.getBoundingClientRect();
          const moveX = ((event.clientX - (rect.left + rect.width / 2)) / rect.width) * 8;
          const moveY = ((event.clientY - (rect.top + rect.height / 2)) / rect.height) * 6;
          gsap.to(node, { x: moveX, y: moveY, duration: 0.28, ease: "power3.out", overwrite: true });
        };
        const handleLeave = () => {
          gsap.to(node, { x: 0, y: 0, duration: 0.36, ease: "power3.out", overwrite: true });
        };
        node.addEventListener("pointermove", handleMove);
        node.addEventListener("pointerleave", handleLeave);
        cleanups.push(() => {
          node.removeEventListener("pointermove", handleMove);
          node.removeEventListener("pointerleave", handleLeave);
        });
      });

      rootRef.current.querySelectorAll("[data-toggle-glow='active']").forEach((node) => {
        const tween = gsap.to(node, {
          boxShadow: `0 0 0 1px rgba(34,211,238,0.28), 0 0 24px ${accentGlow}`,
          repeat: -1,
          yoyo: true,
          duration: 1.2,
          ease: "sine.inOut",
        });
        cleanups.push(() => tween.kill());
      });

      rootRef.current.querySelectorAll("[data-logout-warning]").forEach((node) => {
        const handleEnter = () => {
          gsap.fromTo(
            node,
            { x: 0 },
            {
              x: 4,
              duration: 0.08,
              repeat: 5,
              yoyo: true,
              ease: "sine.inOut",
            }
          );
        };
        node.addEventListener("pointerenter", handleEnter);
        cleanups.push(() => node.removeEventListener("pointerenter", handleEnter));
      });
    }, rootRef);

    return () => {
      ctx.revert();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [accentGlow, isOpen, reduceMotion, rootRef]);

  useEffect(() => {
    if (!saveCounter || !rootRef.current) {
      return;
    }
    const tick = rootRef.current.querySelector("[data-save-tick]");
    if (!tick) {
      return;
    }
    gsap.fromTo(
      tick,
      { scale: 0.5, opacity: 0 },
      { scale: 1, opacity: 1, duration: 0.34, ease: "back.out(2.6)" }
    );
  }, [rootRef, saveCounter]);
}
