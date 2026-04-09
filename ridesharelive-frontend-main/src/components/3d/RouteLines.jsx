import { Line } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import { useMemo, useRef } from "react";
import * as THREE from "three";

function buildRoutePoints(anchor, depth = -5.8) {
  const curve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(anchor[0] - 3.8, anchor[1] - 0.7, depth - 1),
      new THREE.Vector3(anchor[0] - 1.2, anchor[1] + 1.1, depth + 0.2),
      new THREE.Vector3(anchor[0] + 0.8, anchor[1] - 0.5, depth + 0.4),
      new THREE.Vector3(anchor[0] + 3.4, anchor[1] + 0.45, depth - 0.8),
    ],
    false,
    "catmullrom",
    0.25
  );
  return curve.getPoints(72);
}

function RouteTrail({ points, color, offset, darkMix, pulseRef }) {
  const beadRef = useRef(null);
  const lineRef = useRef(null);
  const curve = useMemo(() => new THREE.CatmullRomCurve3(points), [points]);

  useFrame((state) => {
    const pulse = pulseRef.current;
    const travel = (state.clock.elapsedTime * (0.045 + pulse * 0.018) + offset) % 1;
    const position = curve.getPointAt(travel);
    if (beadRef.current) {
      beadRef.current.position.copy(position);
      const scale = 0.085 + pulse * 0.02 + Math.sin(state.clock.elapsedTime * 2.2 + offset * 8) * 0.01;
      beadRef.current.scale.setScalar(scale);
    }
    if (lineRef.current?.material) {
      lineRef.current.material.opacity = 0.08 + darkMix * 0.2 + pulse * 0.06;
    }
  });

  return (
    <group>
      <Line ref={lineRef} points={points} color={color} transparent lineWidth={1.15} depthWrite={false} />
      <mesh ref={beadRef}>
        <sphereGeometry args={[1, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} toneMapped={false} />
      </mesh>
    </group>
  );
}

export default function RouteLines({ darkMix = 1, pointer, scrollDepth = 0, pulseRef, reducedMotion = false }) {
  const groupRef = useRef(null);
  const routes = useMemo(
    () => [
      { points: buildRoutePoints([-2.8, 1.25], -5.4), color: "#38BDF8", offset: 0.06 },
      { points: buildRoutePoints([0.2, -0.15], -6.8), color: "#F59E0B", offset: 0.38 },
      { points: buildRoutePoints([2.4, 1.9], -8.2), color: "#E0F2FE", offset: 0.7 },
    ],
    []
  );

  useFrame((state) => {
    if (!groupRef.current) {
      return;
    }

    const orbit = reducedMotion ? 0 : state.clock.elapsedTime * 0.08;
    groupRef.current.rotation.z = THREE.MathUtils.lerp(
      groupRef.current.rotation.z,
      Math.sin(orbit) * 0.04 + pointer.x * 0.08,
      0.03
    );
    groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, pointer.y * -0.05, 0.03);
    groupRef.current.position.x = THREE.MathUtils.lerp(
      groupRef.current.position.x,
      pointer.x * 0.55 + Math.cos(orbit) * 0.22,
      0.03
    );
    groupRef.current.position.y = THREE.MathUtils.lerp(
      groupRef.current.position.y,
      pointer.y * -0.38 - scrollDepth * 0.7,
      0.03
    );
    groupRef.current.visible = darkMix > 0.04;
  });

  return (
    <group ref={groupRef}>
      {routes.map((route) => (
        <RouteTrail key={route.offset} {...route} darkMix={darkMix} pulseRef={pulseRef} />
      ))}
    </group>
  );
}
