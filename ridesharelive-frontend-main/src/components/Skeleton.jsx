import React from "react";

export function Skeleton({ className = "", style = {} }) {
  return (
    <div
      className={`skeleton-box ${className}`}
      style={{
        background: "rgba(0, 0, 0, 0.05)",
        borderRadius: "0.5rem",
        position: "relative",
        overflow: "hidden",
        ...style,
      }}
    >
      <div className="skeleton-shimmer" />
    </div>
  );
}

export function SkeletonCircle({ size = "2.5rem", className = "" }) {
  return (
    <Skeleton
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
      }}
    />
  );
}

export function SkeletonText({ lines = 1, gap = "0.5rem", className = "" }) {
  return (
    <div className={`space-y-[${gap}] ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          style={{
            height: "0.85rem",
            width: i === lines - 1 && lines > 1 ? "60%" : "100%",
          }}
        />
      ))}
    </div>
  );
}
