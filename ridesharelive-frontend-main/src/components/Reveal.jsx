import React from "react";
import { motion } from "motion/react";

// Reusable Reveal component
// Props:
// - direction: "bottom" | "left" | "right" | "none" (default "bottom")
// - stagger: number (seconds between child animations)
// - threshold: viewport amount to trigger (0-1)
// - once: boolean - trigger only once
// - className: additional wrapper classes
// - children: React nodes (can be single or a list)
// - style: extra styles

export default function Reveal({
  children,
  direction = "bottom",
  stagger = 0.08,
  threshold = 0.16,
  once = true,
  className = "",
  style = {},
  delay = 0,
}) {
  const reduceMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const childHidden = (dir) => {
    const base = { opacity: 0, scale: 0.95, filter: "blur(6px)" };
    if (dir === "left") return { ...base, x: -40, y: 0 };
    if (dir === "right") return { ...base, x: 40, y: 0 };
    if (dir === "none") return { opacity: 0, y: 20, x: 0, scale: 0.97, filter: "blur(4px)" };
    // bottom
    return { ...base, x: 0, y: 60 };
  };

  const childVisible = { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" };

  const parentVariants = {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: stagger,
        delayChildren: delay,
        ease: [0.22, 1, 0.36, 1],
      },
    },
  };

  const childTransition = {
    duration: 0.34, // keeps under 0.4s
    ease: [0.22, 1, 0.36, 1],
  };

  // Safe mapping: wrap each child in a motion.div so we can stagger even non-motion children
  const items = React.Children.toArray(children).map((child, index) => {
    // single item - animate as child
    return (
      <motion.div
        key={index}
        className="reveal-item"
        initial={reduceMotion ? { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" } : childHidden(direction)}
        whileInView={reduceMotion ? undefined : childVisible}
        viewport={{ once, amount: Math.max(0.05, Math.min(1, threshold)) }}
        transition={reduceMotion ? { duration: 0 } : childTransition}
        style={{ willChange: "transform, opacity, filter", ...style }}
      >
        {child}
      </motion.div>
    );
  });

  // If there is only a single child, we still want the same behaviour but without staggering overhead
  if (React.Children.count(children) === 1) {
    return (
      <motion.div
        className={`reveal-wrap ${className}`.trim()}
        initial={reduceMotion ? { opacity: 1, x: 0, y: 0, scale: 1, filter: "blur(0px)" } : childHidden(direction)}
        whileInView={reduceMotion ? undefined : childVisible}
        viewport={{ once, amount: Math.max(0.05, Math.min(1, threshold)) }}
        transition={reduceMotion ? { duration: 0 } : { duration: 0.36, ease: [0.22, 1, 0.36, 1], delay }}
        style={{ willChange: "transform, opacity, filter", ...style }}
      >
        {children}
      </motion.div>
    );
  }

  // multiple children -> parent controls stagger
  return (
    <motion.div
      className={`reveal-wrap ${className}`.trim()}
      variants={parentVariants}
      initial="hidden"
      whileInView={reduceMotion ? undefined : "visible"}
      viewport={{ once, amount: Math.max(0.05, Math.min(1, threshold)) }}
      style={{ willChange: "transform, opacity, filter", ...style }}
    >
      {items}
    </motion.div>
  );
}

// Usage notes (keep in project docs):
// <Reveal direction="left" stagger={0.06} threshold={0.14} once>
//   <Card />
//   <Card />
//   <Card />
// </Reveal>

// For single element:
// <Reveal direction="bottom"><Hero /></Reveal>
