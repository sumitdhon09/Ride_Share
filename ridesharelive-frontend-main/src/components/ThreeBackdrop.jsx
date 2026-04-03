import { useEffect, useRef } from "react";
import gsap from "gsap";

const THEME_STYLES = {
  amber: {
    primary: "#fb7185",
    secondary: "#38bdf8",
    accent: "#fef3c7",
    haze: "#f59e0b",
    background: "#070916",
  },
  "urban-transport": {
    primary: "#a78bfa",
    secondary: "#22d3ee",
    accent: "#f8fafc",
    haze: "#c084fc",
    background: "#060816",
  },
  "dark-theme": {
    primary: "#8b5cf6",
    secondary: "#38bdf8",
    accent: "#f8fafc",
    haze: "#a78bfa",
    background: "#040612",
  },
  ocean: {
    primary: "#67e8f9",
    secondary: "#6366f1",
    accent: "#e0f2fe",
    haze: "#0ea5e9",
    background: "#05111d",
  },
  forest: {
    primary: "#34d399",
    secondary: "#60a5fa",
    accent: "#ecfccb",
    haze: "#22c55e",
    background: "#06110e",
  },
  rapido: {
    primary: "#f59e0b",
    secondary: "#fb7185",
    accent: "#f8fafc",
    haze: "#fdba74",
    background: "#090b14",
  },
  ola: {
    primary: "#4ade80",
    secondary: "#38bdf8",
    accent: "#dcfce7",
    haze: "#22c55e",
    background: "#06110e",
  },
  uber: {
    primary: "#e2e8f0",
    secondary: "#8b5cf6",
    accent: "#38bdf8",
    haze: "#94a3b8",
    background: "#050814",
  },
  lyft: {
    primary: "#f472b6",
    secondary: "#818cf8",
    accent: "#fbcfe8",
    haze: "#ec4899",
    background: "#120817",
  },
};

export default function ThreeBackdrop({ theme = "urban-transport" }) {
  const hostRef = useRef(null);
  const style = THEME_STYLES[theme] || THEME_STYLES["urban-transport"];

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.to(".three-backdrop__glass-orb--one", {
        xPercent: 6,
        yPercent: 5,
        scale: 1.05,
        duration: 11,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".three-backdrop__glass-orb--two", {
        xPercent: -8,
        yPercent: 4,
        scale: 1.08,
        duration: 13,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".three-backdrop__glass-orb--three", {
        xPercent: 4,
        yPercent: -7,
        scale: 1.04,
        duration: 12,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".three-backdrop__glass-panel--one", {
        xPercent: 3,
        yPercent: -3,
        rotate: -7,
        duration: 15,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".three-backdrop__glass-panel--two", {
        xPercent: -4,
        yPercent: 3,
        rotate: 15,
        duration: 17,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
      gsap.to(".three-backdrop__mesh", {
        backgroundPosition: "64px 24px, 64px 24px",
        duration: 18,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }, host);

    return () => ctx.revert();
  }, [theme]);

  return (
    <div
      ref={hostRef}
      className="three-backdrop three-backdrop--glass"
      style={{
        "--three-primary": style.primary,
        "--three-secondary": style.secondary,
        "--three-accent": style.accent,
        "--three-haze": style.haze,
        "--three-background": style.background,
      }}
      aria-hidden="true"
    >
      <div className="three-backdrop__base" />
      <div className="three-backdrop__glass-orb three-backdrop__glass-orb--one" />
      <div className="three-backdrop__glass-orb three-backdrop__glass-orb--two" />
      <div className="three-backdrop__glass-orb three-backdrop__glass-orb--three" />
      <div className="three-backdrop__glass-panel three-backdrop__glass-panel--one" />
      <div className="three-backdrop__glass-panel three-backdrop__glass-panel--two" />
      <div className="three-backdrop__mesh" />
      <div className="three-backdrop__grain" />
      <div className="three-backdrop__veil" />
    </div>
  );
}
