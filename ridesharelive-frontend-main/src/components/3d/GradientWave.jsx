import { shaderMaterial } from "@react-three/drei";
import { extend, useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

const GradientWaveMaterial = shaderMaterial(
  {
    uTime: 0,
    uOpacity: 1,
    uPointer: new THREE.Vector2(0, 0),
    uPulse: 0,
    uColorA: new THREE.Color("#93C5FD"),
    uColorB: new THREE.Color("#E0F2FE"),
    uColorC: new THREE.Color("#FFFFFF"),
  },
  `
    uniform float uTime;
    uniform vec2 uPointer;
    uniform float uPulse;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      vUv = uv;
      vec3 transformed = position;
      float waveA = sin((position.x * 0.55) + uTime * 0.65) * (0.22 + uPulse * 0.06);
      float waveB = cos((position.y * 0.8) + uTime * 0.48) * (0.14 + uPulse * 0.04);
      float waveC = sin((position.x + position.y) * 0.28 + uTime * 0.35) * 0.1;
      vec2 pointerOffset = vec2(position.x * 0.05, position.y * 0.05) - uPointer;
      float rippleDistance = length(pointerOffset);
      float ripple = sin(rippleDistance * 16.0 - uTime * 2.2) * exp(-rippleDistance * 4.5);
      transformed.z += waveA + waveB + waveC + ripple * (0.18 + uPulse * 0.08);
      vElevation = transformed.z;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(transformed, 1.0);
    }
  `,
  `
    uniform float uOpacity;
    uniform vec3 uColorA;
    uniform vec3 uColorB;
    uniform vec3 uColorC;
    varying vec2 vUv;
    varying float vElevation;

    void main() {
      float mixA = smoothstep(0.0, 1.0, vUv.x);
      float mixB = smoothstep(0.0, 1.0, vUv.y);
      vec3 base = mix(uColorA, uColorB, mixA);
      vec3 accent = mix(base, uColorC, mixB * 0.45 + clamp(vElevation * 0.8, -0.08, 0.16));
      float alpha = (0.28 + mixB * 0.3 + vElevation * 0.28) * uOpacity;
      gl_FragColor = vec4(accent, clamp(alpha, 0.0, 0.72));
    }
  `
);

extend({ GradientWaveMaterial });

export default function GradientWave({
  lightMix = 1,
  pointer,
  scrollDepth = 0,
  pulseRef,
  reducedMotion = false,
}) {
  const meshRef = useRef(null);
  const secondaryRef = useRef(null);
  const groupRef = useRef(null);
  const planeArgs = useMemo(() => [26, 18, 120, 120], []);

  useFrame((state) => {
    const elapsed = state.clock.elapsedTime;
    const pulse = pulseRef.current;
    const orbit = reducedMotion ? 0 : elapsed * 0.08;

    if (groupRef.current) {
      groupRef.current.position.x = THREE.MathUtils.lerp(groupRef.current.position.x, pointer.x * 0.3, 0.03);
      groupRef.current.position.y = THREE.MathUtils.lerp(
        groupRef.current.position.y,
        pointer.y * -0.2 - scrollDepth * 0.45 + Math.sin(orbit) * 0.08,
        0.03
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, Math.sin(orbit) * 0.025, 0.03);
    }

    if (meshRef.current?.material) {
      meshRef.current.material.uTime = reducedMotion ? 0 : elapsed;
      meshRef.current.material.uOpacity = THREE.MathUtils.lerp(
        meshRef.current.material.uOpacity,
        lightMix,
        0.06
      );
      meshRef.current.material.uPulse = THREE.MathUtils.lerp(meshRef.current.material.uPulse, pulse, 0.05);
      meshRef.current.material.uPointer.lerp(new THREE.Vector2(pointer.x * 1.4, pointer.y * -1.2), 0.08);
      meshRef.current.rotation.z = THREE.MathUtils.lerp(meshRef.current.rotation.z, pointer.x * 0.12, 0.03);
      meshRef.current.position.x = THREE.MathUtils.lerp(meshRef.current.position.x, pointer.x * 0.6, 0.03);
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, pointer.y * -0.45 - scrollDepth * 0.35, 0.03);
      meshRef.current.scale.setScalar(1 + pulse * 0.025);
    }

    if (secondaryRef.current?.material) {
      secondaryRef.current.material.uTime = reducedMotion ? 0 : elapsed * 0.72 + 4.0;
      secondaryRef.current.material.uOpacity = THREE.MathUtils.lerp(
        secondaryRef.current.material.uOpacity,
        lightMix * 0.76,
        0.06
      );
      secondaryRef.current.material.uPulse = THREE.MathUtils.lerp(secondaryRef.current.material.uPulse, pulse * 0.75, 0.05);
      secondaryRef.current.material.uPointer.lerp(new THREE.Vector2(pointer.x * -1.1, pointer.y * 0.9), 0.08);
      secondaryRef.current.rotation.z = THREE.MathUtils.lerp(secondaryRef.current.rotation.z, pointer.x * -0.08, 0.03);
      secondaryRef.current.position.y = THREE.MathUtils.lerp(
        secondaryRef.current.position.y,
        -2.6 - scrollDepth * 0.7,
        0.03
      );
      secondaryRef.current.scale.setScalar(0.94 + pulse * 0.018);
    }
  });

  return (
    <group ref={groupRef} visible={lightMix > 0.02}>
      <mesh ref={meshRef} rotation={[-0.62, 0.18, -0.12]} position={[0, -0.3, -5.2]}>
        <planeGeometry args={planeArgs} />
        <gradientWaveMaterial transparent depthWrite={false} />
      </mesh>
      <mesh ref={secondaryRef} rotation={[-0.48, -0.2, 0.18]} position={[0.8, -2.6, -6.8]} scale={0.94}>
        <planeGeometry args={[24, 14, 90, 90]} />
        <gradientWaveMaterial
          transparent
          depthWrite={false}
          uColorA={new THREE.Color("#DBEAFE")}
          uColorB={new THREE.Color("#FEF3C7")}
          uColorC={new THREE.Color("#FFFFFF")}
        />
      </mesh>
    </group>
  );
}
