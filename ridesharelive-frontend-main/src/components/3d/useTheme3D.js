import { useEffect, useMemo, useState } from "react";

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function resolveParticleCount() {
  if (typeof window === "undefined") {
    return 160;
  }

  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  const saveData = navigator.connection?.saveData === true;
  const memory = navigator.deviceMemory || 8;
  const width = window.innerWidth || 1440;

  if (reducedMotion || saveData) {
    return 90;
  }
  if (memory <= 4) {
    return width < 768 ? 110 : 150;
  }
  return width < 768 ? 160 : 240;
}

export default function useTheme3D(theme = "urban-transport") {
  const [particleCount, setParticleCount] = useState(() => resolveParticleCount());
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [scrollDepth, setScrollDepth] = useState(0);
  const [heroActive, setHeroActive] = useState(true);

  const isDarkTheme = String(theme || "").startsWith("dark-");
  const reducedMotion = useMemo(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches || false;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return undefined;
    }

    const updateParticleCount = () => {
      setParticleCount(resolveParticleCount());
    };

    const handlePointerMove = (event) => {
      const nextX = window.innerWidth > 0 ? event.clientX / window.innerWidth - 0.5 : 0;
      const nextY = window.innerHeight > 0 ? event.clientY / window.innerHeight - 0.5 : 0;
      setPointer({
        x: clamp(nextX, -0.5, 0.5),
        y: clamp(nextY, -0.5, 0.5),
      });
    };

    const handleScroll = () => {
      const maxScrollable = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      setScrollDepth(clamp(window.scrollY / maxScrollable, 0, 1));
    };

    window.addEventListener("resize", updateParticleCount);
    window.addEventListener("pointermove", handlePointerMove, { passive: true });
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    const heroNode = document.querySelector(".landing-stage");
    const observer =
      heroNode && "IntersectionObserver" in window
        ? new IntersectionObserver(
            ([entry]) => {
              setHeroActive(entry.isIntersecting && entry.intersectionRatio > 0.3);
            },
            { threshold: [0.15, 0.3, 0.55] }
          )
        : null;

    observer?.observe(heroNode);

    return () => {
      window.removeEventListener("resize", updateParticleCount);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("scroll", handleScroll);
      observer?.disconnect();
    };
  }, []);

  return {
    heroActive,
    isDarkTheme,
    particleCount,
    pointer,
    reducedMotion,
    scrollDepth,
  };
}
