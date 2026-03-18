import { useEffect, useRef } from "react";
import * as THREE from "three";

const THEME_COLORS = {
  amber: 0xf59e0b,
  ocean: 0x0284c7,
  forest: 0x15803d,
  rapido: 0xfacc15,
  ola: 0x16a34a,
  uber: 0x111827,
  lyft: 0xec4899,
};

export default function ThreeBackdrop({ theme = "amber" }) {
  const hostRef = useRef(null);
  const materialRef = useRef(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(50, host.clientWidth / host.clientHeight, 0.1, 100);
    camera.position.z = 16;

    const renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(host.clientWidth, host.clientHeight);
    renderer.domElement.setAttribute("aria-hidden", "true");
    host.appendChild(renderer.domElement);

    const count = window.innerWidth < 768 ? 420 : 820;
    const positions = new Float32Array(count * 3);
    for (let index = 0; index < count; index += 1) {
      const radius = 5 + Math.random() * 10;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
      positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
      positions[index * 3 + 2] = radius * Math.cos(phi);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const material = new THREE.PointsMaterial({
      color: THEME_COLORS.amber,
      size: 0.08,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    materialRef.current = material;

    const points = new THREE.Points(geometry, material);
    scene.add(points);

    let rafId = null;
    let running = true;
    const clock = new THREE.Clock();
    let previousFrameTime = 0;
    const targetFrameMs = 1000 / 45;

    const animate = (frameTime = 0) => {
      if (!running) {
        return;
      }
      if (frameTime - previousFrameTime < targetFrameMs) {
        rafId = window.requestAnimationFrame(animate);
        return;
      }
      previousFrameTime = frameTime;
      const elapsed = clock.getElapsedTime();
      points.rotation.y = elapsed * 0.05;
      points.rotation.x = Math.sin(elapsed * 0.25) * 0.12;
      renderer.render(scene, camera);
      rafId = window.requestAnimationFrame(animate);
    };

    const resize = () => {
      if (!host.isConnected) {
        return;
      }
      camera.aspect = host.clientWidth / Math.max(host.clientHeight, 1);
      camera.updateProjectionMatrix();
      renderer.setSize(host.clientWidth, host.clientHeight);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        running = false;
        if (rafId) {
          window.cancelAnimationFrame(rafId);
          rafId = null;
        }
      } else if (!running) {
        running = true;
        animate();
      }
    };

    animate();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      running = false;
      if (rafId) {
        window.cancelAnimationFrame(rafId);
      }
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("resize", resize);
      scene.remove(points);
      geometry.dispose();
      material.dispose();
      materialRef.current = null;
      renderer.dispose();
      if (renderer.domElement.parentElement === host) {
        host.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (!materialRef.current) {
      return;
    }
    materialRef.current.color.setHex(THEME_COLORS[theme] || THEME_COLORS.amber);
  }, [theme]);

  return <div className="three-backdrop" ref={hostRef} />;
}
