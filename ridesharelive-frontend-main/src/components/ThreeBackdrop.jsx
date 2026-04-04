import { useEffect, useRef } from "react";
import * as THREE from "three";
import gsap from "gsap";

const THEME_STYLES = {
  "peach-glow": {
    primary: "#93c5fd",
    secondary: "#c4b5fd",
    accent: "#f8fbff",
    haze: "#bfdbfe",
    background: "#edf4fb",
  },
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
    primary: "#38bdf8",
    secondary: "#1d4ed8",
    accent: "#dbeafe",
    haze: "#22d3ee",
    background: "#020817",
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
  "driver-ops": {
    primary: "#67e8f9",
    secondary: "#22c55e",
    accent: "#e0f2fe",
    haze: "#38bdf8",
    background: "#04101e",
  },
  "admin-ops": {
    primary: "#7dd3fc",
    secondary: "#818cf8",
    accent: "#dbeafe",
    haze: "#38bdf8",
    background: "#040d1b",
  },
  lyft: {
    primary: "#f472b6",
    secondary: "#818cf8",
    accent: "#fbcfe8",
    haze: "#ec4899",
    background: "#120817",
  },
};

function rgbaFromHex(hex, alpha) {
  const color = new THREE.Color(hex);
  return `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${alpha})`;
}

function createRadialTexture(innerHex, outerHex) {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const gradient = context.createRadialGradient(128, 128, 8, 128, 128, 128);
  gradient.addColorStop(0, rgbaFromHex(innerHex, 0.95));
  gradient.addColorStop(0.28, rgbaFromHex(outerHex, 0.4));
  gradient.addColorStop(0.62, rgbaFromHex(outerHex, 0.14));
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  context.fillStyle = gradient;
  context.fillRect(0, 0, canvas.width, canvas.height);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export default function ThreeBackdrop({ theme = "peach-glow" }) {
  const hostRef = useRef(null);
  const canvasRef = useRef(null);
  const style = THEME_STYLES[theme] || THEME_STYLES["peach-glow"];

  useEffect(() => {
    const host = hostRef.current;
    const canvas = canvasRef.current;
    if (!host || !canvas) {
      return undefined;
    }

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isDark = ["dark-theme", "ocean", "uber", "driver-ops", "admin-ops", "forest", "rapido", "ola", "lyft", "amber", "urban-transport"].includes(theme);
    const isOpsTheme = theme === "driver-ops" || theme === "admin-ops";
    let cleanupThree = () => {};

    if (!reduceMotion) {
      try {
        const renderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: "high-performance",
        });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.6));
        renderer.setClearColor(0x000000, 0);

        const scene = new THREE.Scene();
        const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
        camera.position.set(0, 0, 18);

        const group = new THREE.Group();
        scene.add(group);

        const particleTexture = createRadialTexture(style.accent, style.secondary);
        const haloTexture = createRadialTexture(style.primary, style.haze);

        const particleCount = isOpsTheme ? 280 : 210;
        const particleGeometry = new THREE.BufferGeometry();
        const particlePositions = new Float32Array(particleCount * 3);
        const particleColors = new Float32Array(particleCount * 3);
        const particleSeeds = new Float32Array(particleCount * 3);
        const primaryColor = new THREE.Color(style.primary);
        const secondaryColor = new THREE.Color(style.secondary);
        const accentColor = new THREE.Color(style.accent);

        for (let index = 0; index < particleCount; index += 1) {
          const x = (Math.random() - 0.5) * 26;
          const y = (Math.random() - 0.5) * 18;
          const z = (Math.random() - 0.5) * 7;
          const baseOffset = index * 3;
          const blendTarget = Math.random() > 0.5 ? secondaryColor : accentColor;
          const color = primaryColor.clone().lerp(blendTarget, 0.35 + Math.random() * 0.45);

          particlePositions[baseOffset] = x;
          particlePositions[baseOffset + 1] = y;
          particlePositions[baseOffset + 2] = z;
          particleSeeds[baseOffset] = x;
          particleSeeds[baseOffset + 1] = y;
          particleSeeds[baseOffset + 2] = z;
          particleColors[baseOffset] = color.r;
          particleColors[baseOffset + 1] = color.g;
          particleColors[baseOffset + 2] = color.b;
        }

        particleGeometry.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
        particleGeometry.setAttribute("color", new THREE.BufferAttribute(particleColors, 3));

        const particleMaterial = new THREE.PointsMaterial({
          size: isOpsTheme ? 0.33 : isDark ? 0.26 : 0.21,
          map: particleTexture,
          transparent: true,
          opacity: isOpsTheme ? 0.68 : isDark ? 0.56 : 0.54,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          vertexColors: true,
          sizeAttenuation: true,
        });

        const particles = new THREE.Points(particleGeometry, particleMaterial);
        particles.position.z = -1;
        group.add(particles);

        const gridLines = [];
        const gridWidth = 18;
        const gridHeight = 11;
        const gridStep = 2.4;
        for (let x = -gridWidth; x <= gridWidth; x += gridStep) {
          gridLines.push(x, -gridHeight, -5, x, gridHeight, -5);
        }
        for (let y = -gridHeight; y <= gridHeight; y += gridStep) {
          gridLines.push(-gridWidth, y, -5, gridWidth, y, -5);
        }

        const gridGeometry = new THREE.BufferGeometry();
        gridGeometry.setAttribute("position", new THREE.Float32BufferAttribute(gridLines, 3));
        const gridMaterial = new THREE.LineBasicMaterial({
          color: style.secondary,
          transparent: true,
          opacity: isOpsTheme ? 0.12 : isDark ? 0.07 : 0.08,
          blending: THREE.AdditiveBlending,
        });
        const grid = new THREE.LineSegments(gridGeometry, gridMaterial);
        grid.rotation.x = THREE.MathUtils.degToRad(69);
        grid.position.set(0, 1.2, -4.5);
        grid.scale.set(1.1, 1, 1);
        group.add(grid);

        const accentGridMaterial = new THREE.LineBasicMaterial({
          color: style.primary,
          transparent: true,
          opacity: isOpsTheme ? 0.06 : isDark ? 0.035 : 0.04,
          blending: THREE.AdditiveBlending,
        });
        const accentGrid = new THREE.LineSegments(gridGeometry.clone(), accentGridMaterial);
        accentGrid.rotation.x = THREE.MathUtils.degToRad(69);
        accentGrid.rotation.z = THREE.MathUtils.degToRad(8);
        accentGrid.position.set(0, -0.8, -6.5);
        accentGrid.scale.set(1.28, 1.08, 1);
        group.add(accentGrid);

        const haloSprites = [
          { x: -9, y: 5, z: -2, scale: isOpsTheme ? 12.5 : 10.5, opacity: isOpsTheme ? 0.18 : isDark ? 0.12 : 0.12 },
          { x: 8, y: -2, z: -3, scale: isOpsTheme ? 9.6 : 7.8, opacity: isOpsTheme ? 0.15 : isDark ? 0.1 : 0.11 },
          { x: 2, y: 6, z: -5, scale: isOpsTheme ? 8.5 : 6.8, opacity: isOpsTheme ? 0.12 : isDark ? 0.07 : 0.08 },
        ].map((config) => {
          const material = new THREE.SpriteMaterial({
            map: haloTexture,
            color: style.primary,
            transparent: true,
            opacity: config.opacity,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const sprite = new THREE.Sprite(material);
          sprite.position.set(config.x, config.y, config.z);
          sprite.scale.set(config.scale, config.scale, 1);
          group.add(sprite);
          return sprite;
        });

        const pointer = { x: 0, y: 0 };
        const clock = new THREE.Clock();
        let frameId = 0;

        const resize = () => {
          const width = Math.max(host.clientWidth, window.innerWidth);
          const height = Math.max(host.clientHeight, window.innerHeight);
          renderer.setSize(width, height, false);
          camera.aspect = width / height;
          camera.updateProjectionMatrix();
        };

        const handlePointerMove = (event) => {
          pointer.x = ((event.clientX / window.innerWidth) * 2 - 1) * 1.8;
          pointer.y = -((event.clientY / window.innerHeight) * 2 - 1) * 1.2;
        };

        const animate = () => {
          const elapsed = clock.getElapsedTime();
          const positions = particleGeometry.attributes.position.array;

          for (let index = 0; index < particleCount; index += 1) {
            const baseOffset = index * 3;
            const originX = particleSeeds[baseOffset];
            const originY = particleSeeds[baseOffset + 1];
            const originZ = particleSeeds[baseOffset + 2];

            positions[baseOffset] = originX + Math.sin(elapsed * 0.22 + originY * 0.16) * 0.18;
            positions[baseOffset + 1] =
              originY +
              Math.sin(elapsed * 0.48 + originX * 0.13 + index * 0.03) * 0.28 +
              Math.cos(elapsed * 0.36 + originZ * 0.24) * 0.14;
            positions[baseOffset + 2] = originZ + Math.sin(elapsed * 0.42 + originX * 0.17) * 0.26;
          }

          particleGeometry.attributes.position.needsUpdate = true;

          group.rotation.y = THREE.MathUtils.lerp(group.rotation.y, pointer.x * 0.06, 0.025);
          group.rotation.x = THREE.MathUtils.lerp(group.rotation.x, pointer.y * 0.04, 0.025);

          particles.rotation.z = elapsed * 0.02;
          particles.position.x = THREE.MathUtils.lerp(particles.position.x, pointer.x * 0.34, 0.03);
          particles.position.y = THREE.MathUtils.lerp(particles.position.y, pointer.y * 0.28, 0.03);

          grid.rotation.z = Math.sin(elapsed * 0.16) * 0.08 + pointer.x * 0.02;
          grid.position.x = THREE.MathUtils.lerp(grid.position.x, pointer.x * 0.66, 0.02);
          accentGrid.rotation.z = -Math.sin(elapsed * 0.14) * 0.06 - pointer.x * 0.016;
          accentGrid.position.y = THREE.MathUtils.lerp(accentGrid.position.y, -0.8 + pointer.y * 0.22, 0.02);

          haloSprites[0].position.x = -9 + Math.sin(elapsed * 0.2) * 1.2;
          haloSprites[0].position.y = 5 + Math.cos(elapsed * 0.17) * 0.7;
          haloSprites[1].position.x = 8 + Math.cos(elapsed * 0.24) * 1.1;
          haloSprites[1].position.y = -2 + Math.sin(elapsed * 0.18) * 0.8;
          haloSprites[2].position.x = 2 + Math.sin(elapsed * 0.14) * 1.4;
          haloSprites[2].position.y = 6 + Math.sin(elapsed * 0.19) * 0.6;

          renderer.render(scene, camera);
          frameId = window.requestAnimationFrame(animate);
        };

        resize();
        animate();
        window.addEventListener("resize", resize);
        window.addEventListener("pointermove", handlePointerMove, { passive: true });

        cleanupThree = () => {
          window.cancelAnimationFrame(frameId);
          window.removeEventListener("resize", resize);
          window.removeEventListener("pointermove", handlePointerMove);
          particleGeometry.dispose();
          gridGeometry.dispose();
          accentGrid.geometry.dispose();
          particleMaterial.dispose();
          gridMaterial.dispose();
          accentGridMaterial.dispose();
          haloSprites.forEach((sprite) => {
            sprite.material.dispose();
          });
          particleTexture?.dispose();
          haloTexture?.dispose();
          renderer.dispose();
        };
      } catch {
        cleanupThree = () => {};
      }
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

    return () => {
      cleanupThree();
      ctx.revert();
    };
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
      <canvas ref={canvasRef} className="three-backdrop__canvas" />
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
