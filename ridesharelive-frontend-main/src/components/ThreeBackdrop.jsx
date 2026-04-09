import { useEffect, useMemo, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const LAYERS = Array.from({ length: 7 }, (_, index) => ({
  id: `layer-${index}`,
  size: 220 + index * 48,
  left: 8 + ((index * 13) % 72),
  top: 10 + ((index * 11) % 68),
  opacity: 0.14 - index * 0.012,
  duration: 14 + index * 2.6,
  delay: index * 0.24,
}));

const ROUTES = [
  "M-10,220 C180,100 320,260 540,140 S900,80 1120,210",
  "M-20,420 C190,300 350,480 620,340 S980,220 1240,390",
  "M140,620 C320,500 460,700 720,560 S1060,420 1320,610",
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export default function ThreeBackdrop({ theme = "urban-transport" }) {
  const rootRef = useRef(null);
  const layerRefs = useRef([]);
  const routeRefs = useRef([]);
  const glowRef = useRef(null);
  const pulseRef = useRef(null);
  const isDarkTheme = theme.startsWith("dark-");
  const modeClass = isDarkTheme ? "gsap-backdrop--dark" : "gsap-backdrop--light";
  const particles = useMemo(
    () =>
      Array.from({ length: isDarkTheme ? 18 : 12 }, (_, index) => ({
        id: `particle-${index}`,
        size: 4 + (index % 5) * 2.5,
        left: 4 + ((index * 7.5) % 92),
        top: 6 + ((index * 9) % 82),
        delay: index * 0.18,
        duration: 6 + (index % 4) * 1.2,
      })),
    [isDarkTheme]
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) {
      return undefined;
    }

    if (prefersReducedMotion()) {
      gsap.set(root, { opacity: 1 });
      return undefined;
    }

    const ctx = gsap.context(() => {
      gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.9, ease: "power2.out" });

      layerRefs.current.forEach((element, index) => {
        if (!element) {
          return;
        }

        gsap.to(element, {
          xPercent: index % 2 === 0 ? 6 : -6,
          yPercent: index % 3 === 0 ? -8 : 8,
          rotation: index % 2 === 0 ? 10 : -10,
          duration: LAYERS[index].duration,
          delay: LAYERS[index].delay,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      });

      routeRefs.current.forEach((element, index) => {
        if (!element) {
          return;
        }

        const path = element.querySelector("path");
        const pulse = element.querySelector("circle");
        if (path) {
          gsap.fromTo(
            path,
            { strokeDashoffset: 320 },
            {
              strokeDashoffset: 0,
              duration: 8 + index * 1.4,
              repeat: -1,
              ease: "none",
            }
          );
        }
        if (pulse) {
          gsap.to(pulse, {
            attr: { cx: 1080 },
            duration: 7 + index * 1.2,
            repeat: -1,
            ease: "power1.inOut",
          });
        }
      });

      if (glowRef.current) {
        gsap.to(glowRef.current, {
          backgroundPosition: "140% 50%",
          duration: 16,
          repeat: -1,
          ease: "none",
        });
      }

      if (pulseRef.current) {
        gsap.to(pulseRef.current, {
          scale: 1.06,
          opacity: isDarkTheme ? 0.42 : 0.34,
          duration: 3.4,
          repeat: -1,
          yoyo: true,
          ease: "sine.inOut",
        });
      }

      gsap.to(root, {
        y: isDarkTheme ? -24 : -16,
        scrollTrigger: {
          trigger: document.body,
          start: "top top",
          end: "bottom bottom",
          scrub: 1.2,
        },
      });
    }, root);

    const handlePointerMove = (event) => {
      const x = (event.clientX / window.innerWidth - 0.5) * 28;
      const y = (event.clientY / window.innerHeight - 0.5) * 18;

      gsap.to(layerRefs.current.filter(Boolean), {
        x,
        y,
        duration: 1.6,
        ease: "power3.out",
        stagger: 0.02,
        overwrite: true,
      });

      gsap.to(routeRefs.current.filter(Boolean), {
        x: x * 0.4,
        y: y * 0.5,
        duration: 1.4,
        ease: "power3.out",
        overwrite: true,
      });
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      ctx.revert();
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, [isDarkTheme]);

  return (
    <div
      ref={rootRef}
      aria-hidden="true"
      className={`three-backdrop gsap-backdrop ${modeClass}`}
    >
      <div className="gsap-backdrop__base" />
      <div ref={glowRef} className="gsap-backdrop__gradient-line" />
      <div ref={pulseRef} className="gsap-backdrop__pulse" />
      <div className="gsap-backdrop__grid" />
      <div className="gsap-backdrop__routes">
        {ROUTES.map((route, index) => (
          <svg
            key={route}
            ref={(node) => {
              routeRefs.current[index] = node;
            }}
            className="gsap-backdrop__route"
            viewBox="0 0 1320 720"
            preserveAspectRatio="none"
          >
            <path d={route} pathLength="320" />
            <circle cy={index === 1 ? 390 : index === 2 ? 610 : 210} r="5.5" />
          </svg>
        ))}
      </div>
      <div className="gsap-backdrop__layers">
        {LAYERS.map((layer, index) => (
          <span
            key={layer.id}
            ref={(node) => {
              layerRefs.current[index] = node;
            }}
            className="gsap-backdrop__layer"
            style={{
              width: `${layer.size}px`,
              height: `${layer.size}px`,
              left: `${layer.left}%`,
              top: `${layer.top}%`,
              opacity: layer.opacity,
            }}
          />
        ))}
      </div>
      <div className="gsap-backdrop__particles">
        {particles.map((particle) => (
          <span
            key={particle.id}
            className="gsap-backdrop__particle"
            style={{
              width: `${particle.size}px`,
              height: `${particle.size}px`,
              left: `${particle.left}%`,
              top: `${particle.top}%`,
              animationDelay: `${particle.delay}s`,
              animationDuration: `${particle.duration}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
