import { useFrame } from "@react-three/fiber";
import { RoundedBox } from "@react-three/drei";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function createParticleData(count) {
  return new Array(count).fill(null).map(() => ({
    origin: new THREE.Vector3(
      (Math.random() - 0.5) * 18,
      (Math.random() - 0.5) * 14,
      -8 + Math.random() * 16
    ),
    phase: Math.random() * Math.PI * 2,
    speed: 0.22 + Math.random() * 0.42,
    radius: 0.018 + Math.random() * 0.06,
    sway: 0.12 + Math.random() * 0.35,
    tone: Math.random() > 0.5 ? new THREE.Color("#38BDF8") : new THREE.Color("#F59E0B"),
  }));
}

function FloatingCards({ darkMix = 1, pointer, scrollDepth = 0, pulseRef, reducedMotion = false }) {
  const cards = useMemo(
    () => [
      { position: [-3.4, 1.8, -4.5], rotation: [0.3, -0.4, 0.16], scale: [1.1, 0.7, 0.06] },
      { position: [3.6, -1.2, -6], rotation: [-0.26, 0.35, -0.2], scale: [1.35, 0.82, 0.06] },
      { position: [1.2, 2.8, -7.4], rotation: [0.18, 0.22, 0.08], scale: [0.86, 0.58, 0.05] },
    ],
    []
  );

  const groupRef = useRef(null);

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }
    const t = state.clock.elapsedTime;
    const pulse = pulseRef.current;
    const orbit = reducedMotion ? 0 : t * 0.07;
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      pointer.x * 0.35 + Math.cos(orbit) * 0.25,
      0.04
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      pointer.y * -0.24 - scrollDepth * 0.55 + Math.sin(orbit) * 0.14,
      0.04
    );
    groupRef.current.children.forEach((child, index) => {
      child.position.y = cards[index].position[1] + Math.sin(t * 0.45 + index) * (0.08 + pulse * 0.025);
      child.position.x = cards[index].position[0] + Math.cos(t * 0.22 + index) * 0.05;
      child.rotation.x = cards[index].rotation[0] + pointer.y * -0.24 + Math.sin(t * 0.32 + index) * 0.03;
      child.rotation.y = cards[index].rotation[1] + pointer.x * 0.36 + Math.cos(t * 0.28 + index) * 0.04;
      child.rotation.z = cards[index].rotation[2] + Math.sin(t * 0.28 + index) * 0.04;
      child.visible = darkMix > 0.06;
      const material = child.material;
      if (material) {
        material.emissiveIntensity = 0.08 + darkMix * 0.1 + pulse * 0.12;
        material.opacity = 0.05 + darkMix * 0.12 + pulse * 0.03;
      }
    });
  });

  return (
    <group ref={groupRef}>
      {cards.map((card, index) => (
        <RoundedBox
          // Subtle premium depth cards that stay behind the UI.
          key={`${card.position.join("-")}-${index}`}
          args={card.scale}
          position={card.position}
          rotation={card.rotation}
          radius={0.12}
          smoothness={4}
        >
          <meshPhysicalMaterial
            color={index % 2 === 0 ? "#0F172A" : "#082F49"}
            transparent
            opacity={0.06 + darkMix * 0.12}
            transmission={0.55}
            roughness={0.18}
            metalness={0.2}
            emissive={index % 2 === 0 ? "#38BDF8" : "#F59E0B"}
            emissiveIntensity={0.1 + darkMix * 0.14}
          />
        </RoundedBox>
      ))}
    </group>
  );
}

export default function Particles({
  count = 160,
  darkMix = 1,
  pointer,
  scrollDepth = 0,
  pulseRef,
  reducedMotion = false,
}) {
  const meshRef = useRef(null);
  const groupRef = useRef(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const data = useMemo(() => createParticleData(count), [count]);
  const pointerField = useRef(new THREE.Vector2());
  const orbitalOffset = useRef(new THREE.Vector2());

  useFrame((state, delta) => {
    const mesh = meshRef.current;
    if (!mesh || !groupRef.current) {
      return;
    }

    const elapsed = state.clock.elapsedTime;
    const pulse = pulseRef.current;
    const orbit = reducedMotion ? 0 : elapsed * 0.06;
    pointerField.current.lerp(new THREE.Vector2(pointer.x, pointer.y), 1 - Math.exp(-delta * 4.5));
    orbitalOffset.current.set(Math.cos(orbit) * 0.42, Math.sin(orbit * 1.2) * 0.24);

    const offsetX = pointerField.current.x * 0.62 + orbitalOffset.current.x;
    const offsetY = pointerField.current.y * -0.42 + scrollDepth * 0.9 + orbitalOffset.current.y;

    for (let index = 0; index < data.length; index += 1) {
      const particle = data[index];
      const t = reducedMotion ? 0 : elapsed * particle.speed + particle.phase;
      const localX = particle.origin.x * 0.07 - pointerField.current.x * 1.1;
      const localY = particle.origin.y * 0.07 + pointerField.current.y * 1.1;
      const rippleDistance = Math.sqrt(localX * localX + localY * localY);
      const rippleWave = Math.sin(rippleDistance * 9 - elapsed * 2.4) * Math.exp(-rippleDistance * 2.8);
      dummy.position.set(
        particle.origin.x + Math.sin(t * 1.3) * particle.sway + offsetX + rippleWave * 0.18,
        particle.origin.y + Math.cos(t * 1.1) * particle.sway + offsetY + rippleWave * 0.12,
        particle.origin.z + Math.sin(t * 0.8) * particle.sway * 1.6 + rippleWave * (0.35 + pulse * 0.1)
      );
      const scale = particle.radius * (0.8 + Math.sin(t * 1.8) * 0.12 + darkMix * 0.2 + pulse * 0.08);
      dummy.scale.setScalar(Math.max(scale, 0.01));
      dummy.rotation.x = t * 0.15;
      dummy.rotation.y = t * 0.22;
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      if (mesh.instanceColor) {
        mesh.setColorAt(index, particle.tone);
      }
    }

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) {
      mesh.instanceColor.needsUpdate = true;
    }

    groupRef.current.position.z = THREE.MathUtils.lerp(groupRef.current.position.z, -scrollDepth * 1.4, 0.03);
    groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, Math.sin(orbit) * 0.035, 0.03);
    mesh.rotation.y = THREE.MathUtils.lerp(mesh.rotation.y, pointerField.current.x * 0.18, 0.02);
    mesh.rotation.x = THREE.MathUtils.lerp(mesh.rotation.x, pointerField.current.y * -0.08, 0.02);
    mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity, 0.04 + darkMix * 0.72 + pulse * 0.08, 0.06);
    mesh.material.emissiveIntensity = THREE.MathUtils.lerp(mesh.material.emissiveIntensity, 0.8 + pulse * 0.16, 0.05);
    groupRef.current.visible = darkMix > 0.02;
  });

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[null, null, data.length]} frustumCulled={false}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshStandardMaterial
          transparent
          opacity={0.72}
          emissive="#38BDF8"
          emissiveIntensity={0.86}
          color="#E0F2FE"
          roughness={0.3}
          metalness={0.14}
          toneMapped={false}
        />
      </instancedMesh>
      <FloatingCards
        darkMix={darkMix}
        pointer={pointerField.current}
        pulseRef={pulseRef}
        reducedMotion={reducedMotion}
        scrollDepth={scrollDepth}
      />
    </group>
  );
}
