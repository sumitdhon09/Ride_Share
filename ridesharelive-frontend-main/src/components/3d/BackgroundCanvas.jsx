import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { AdaptiveDpr, AdaptiveEvents, OrbitControls } from "@react-three/drei";
import { AnimatePresence, motion } from "motion/react";
import { Suspense, useMemo, useRef } from "react";
import * as THREE from "three";
import GradientWave from "./GradientWave";
import Particles from "./Particles";
import RouteLines from "./RouteLines";
import useTheme3D from "./useTheme3D";

function SceneController({ heroActive, isDarkTheme, pointer, scrollDepth, reducedMotion, particleCount }) {
  const darkMixRef = useRef(isDarkTheme ? 1 : 0);
  const pulseRef = useRef(heroActive ? 1 : 0.35);
  const sweepLightRef = useRef(null);
  const fogColor = useMemo(() => new THREE.Color("#020617"), []);
  const fogLightColor = useMemo(() => new THREE.Color("#dbeafe"), []);
  const { scene } = useThree();

  useFrame((state, delta) => {
    const target = isDarkTheme ? 1 : 0;
    darkMixRef.current = THREE.MathUtils.damp(darkMixRef.current, target, 3.6, delta);
    pulseRef.current = THREE.MathUtils.damp(pulseRef.current, heroActive ? 1 : 0.32, 2.8, delta);
    const orbit = reducedMotion ? 0 : state.clock.elapsedTime * 0.08;

    const cameraTargetX = pointer.x * (reducedMotion ? 0.4 : 0.95) + Math.cos(orbit) * 0.22;
    const cameraTargetY = pointer.y * (reducedMotion ? -0.28 : -0.64) + scrollDepth * 0.7 + Math.sin(orbit * 1.2) * 0.14;
    const cameraTargetZ = 9.2 + scrollDepth * 1.3 - pulseRef.current * 0.18;

    state.camera.position.x = THREE.MathUtils.damp(state.camera.position.x, cameraTargetX, 2.6, delta);
    state.camera.position.y = THREE.MathUtils.damp(state.camera.position.y, cameraTargetY, 2.6, delta);
    state.camera.position.z = THREE.MathUtils.damp(state.camera.position.z, cameraTargetZ, 2.6, delta);
    state.camera.lookAt(0, 0, -1.6);

    if (sweepLightRef.current) {
      sweepLightRef.current.position.x = Math.sin(orbit * 2) * 7;
      sweepLightRef.current.position.y = 1.6 + Math.cos(orbit * 1.4) * 1.8;
      sweepLightRef.current.intensity = 0.08 + darkMixRef.current * 0.22 + pulseRef.current * 0.05;
    }

    if (scene.fog) {
      scene.fog.near = THREE.MathUtils.lerp(8, 18, 1 - darkMixRef.current);
      scene.fog.far = THREE.MathUtils.lerp(26, 44, 1 - darkMixRef.current);
      scene.fog.color.copy(fogColor).lerp(fogLightColor, 1 - darkMixRef.current);
    }
  });

  return (
    <>
      <fog attach="fog" args={["#020617", 8, 26]} />
      <ambientLight intensity={0.22 + (1 - darkMixRef.current) * 0.7} color={isDarkTheme ? "#9ca3af" : "#ffffff"} />
      <pointLight
        position={[-4, 3, 4]}
        intensity={0.8 + darkMixRef.current * 0.55}
        color={isDarkTheme ? "#38BDF8" : "#93C5FD"}
      />
      <pointLight
        position={[5, -2, 6]}
        intensity={0.65 + darkMixRef.current * 0.42}
        color={isDarkTheme ? "#F59E0B" : "#FDE68A"}
      />
      <pointLight
        ref={sweepLightRef}
        position={[0, 2, 3]}
        intensity={0.12}
        color={isDarkTheme ? "#38BDF8" : "#FFFFFF"}
        distance={22}
      />
      <GradientWave
        lightMix={1 - darkMixRef.current}
        pointer={pointer}
        pulseRef={pulseRef}
        reducedMotion={reducedMotion}
        scrollDepth={scrollDepth}
      />
      <Particles
        count={particleCount}
        darkMix={darkMixRef.current}
        pointer={pointer}
        pulseRef={pulseRef}
        scrollDepth={scrollDepth}
        reducedMotion={reducedMotion}
      />
      <RouteLines
        darkMix={darkMixRef.current}
        pointer={pointer}
        pulseRef={pulseRef}
        reducedMotion={reducedMotion}
        scrollDepth={scrollDepth}
      />
      <OrbitControls enableZoom={false} enableRotate={false} enablePan={false} />
    </>
  );
}

export default function BackgroundCanvas({ theme = "urban-transport" }) {
  const { heroActive, isDarkTheme, particleCount, pointer, reducedMotion, scrollDepth } = useTheme3D(theme);

  return (
    <div className="three-backdrop">
      <Canvas
        camera={{ position: [0, 0, 9.2], fov: 46, near: 0.1, far: 60 }}
        gl={{
          alpha: true,
          antialias: !reducedMotion,
          powerPreference: reducedMotion ? "default" : "high-performance",
        }}
        dpr={[1, reducedMotion ? 1 : Math.min(window.devicePixelRatio || 1, 1.5)]}
      >
        <AdaptiveDpr pixelated />
        <AdaptiveEvents />
        <Suspense fallback={null}>
          <SceneController
            heroActive={heroActive}
            isDarkTheme={isDarkTheme}
            pointer={pointer}
            scrollDepth={scrollDepth}
            reducedMotion={reducedMotion}
            particleCount={particleCount}
          />
        </Suspense>
      </Canvas>

      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={isDarkTheme ? "dark-overlay" : "light-overlay"}
          className="three-backdrop__overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: isDarkTheme ? 0.74 : 0.42 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
          style={{
            background: isDarkTheme
              ? "radial-gradient(circle at 20% 20%, rgba(56, 189, 248, 0.1), transparent 28%), radial-gradient(circle at 82% 16%, rgba(245, 158, 11, 0.08), transparent 26%)"
              : "linear-gradient(180deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))",
          }}
        />
      </AnimatePresence>
    </div>
  );
}
