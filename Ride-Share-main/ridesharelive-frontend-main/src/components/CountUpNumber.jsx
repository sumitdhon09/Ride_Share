import { useEffect, useRef, useState } from "react";

function prefersReducedMotion() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function easeOutCubic(value) {
  return 1 - Math.pow(1 - value, 3);
}

export default function CountUpNumber({
  value = 0,
  duration = 650,
  formatter,
  className = "",
  ariaLabel,
}) {
  const numericValue = Number(value);
  const safeTarget = Number.isFinite(numericValue) ? numericValue : 0;
  const [displayValue, setDisplayValue] = useState(safeTarget);
  const displayValueRef = useRef(safeTarget);
  const frameRef = useRef(null);
  const startAtRef = useRef(0);
  const fromValueRef = useRef(safeTarget);

  useEffect(() => {
    displayValueRef.current = displayValue;
  }, [displayValue]);

  useEffect(() => {
    if (frameRef.current) {
      cancelAnimationFrame(frameRef.current);
      frameRef.current = null;
    }

    if (prefersReducedMotion() || duration <= 0) {
      fromValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return undefined;
    }

    const startValue = Number.isFinite(displayValueRef.current) ? displayValueRef.current : fromValueRef.current;
    const delta = safeTarget - startValue;
    if (Math.abs(delta) < 0.001) {
      fromValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      return undefined;
    }

    fromValueRef.current = startValue;
    startAtRef.current = 0;

    const tick = (timestamp) => {
      if (!startAtRef.current) {
        startAtRef.current = timestamp;
      }

      const elapsed = timestamp - startAtRef.current;
      const progress = Math.min(1, elapsed / duration);
      const eased = easeOutCubic(progress);
      const nextValue = startValue + delta * eased;

      displayValueRef.current = nextValue;
      setDisplayValue(nextValue);

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(tick);
        return;
      }

      fromValueRef.current = safeTarget;
      displayValueRef.current = safeTarget;
      setDisplayValue(safeTarget);
      frameRef.current = null;
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) {
        cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [safeTarget, duration]);

  const text = formatter
    ? formatter(displayValue)
    : new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(Math.round(displayValue));

  return (
    <span className={className} aria-label={ariaLabel}>
      {text}
    </span>
  );
}
