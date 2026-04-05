import { useState } from "react";
import { motion } from "motion/react";

export default function ConfirmButton({ label, disabled, type = "button", onClick, className = "w-full" }) {
  const [ripples, setRipples] = useState([]);

  const spawnRipple = (event) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    const ripple = {
      id: Date.now(),
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
    };
    setRipples((current) => [...current, ripple]);
    window.setTimeout(() => {
      setRipples((current) => current.filter((item) => item.id !== ripple.id));
    }, 320);
  };

  return (
    <motion.button
      type={type}
      disabled={disabled}
      whileTap={disabled ? undefined : { scale: 0.985 }}
      whileHover={disabled ? undefined : { y: -1 }}
      onClick={(event) => {
        if (disabled) {
          return;
        }
        spawnRipple(event);
        onClick?.(event);
      }}
      className={`relative flex items-center justify-center overflow-hidden rounded-[1.4rem] px-6 py-4 text-base font-semibold text-white transition ${className} ${
        disabled
          ? "cursor-not-allowed bg-slate-300"
          : "bg-slate-950 shadow-[0_24px_50px_-26px_rgba(15,23,42,0.45)]"
      }`}
    >
      {ripples.map((ripple) => (
        <motion.span
          key={ripple.id}
          initial={{ opacity: 0.35, scale: 0 }}
          animate={{ opacity: 0, scale: 8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="pointer-events-none absolute h-10 w-10 rounded-full bg-white/50"
          style={{ left: ripple.x - 20, top: ripple.y - 20 }}
        />
      ))}
      <span className="relative z-10">{label}</span>
    </motion.button>
  );
}
