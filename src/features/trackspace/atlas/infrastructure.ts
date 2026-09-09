import * as THREE from "three";
import type { AtlasInfrastructure } from "./model";

/** Diagram-scale symbols, not surveyed buildings or literal infrastructure dimensions. */
export function infrastructureSymbol(item: AtlasInfrastructure) {
  const group = new THREE.Group();
  const conceptual = item.stage === "conceptual";
  const material = new THREE.MeshStandardMaterial({
    color: conceptual
      ? "#8aa9bd"
      : item.stage === "demonstrated"
        ? "#95d9ba"
        : "#e4d5ac",
    roughness: 0.68,
    metalness: 0.22,
    wireframe: conceptual,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: "#1c3850",
    roughness: 0.55,
    metalness: 0.25,
    wireframe: conceptual,
  });
  const geometries: THREE.BufferGeometry[] = [];
  const add = (
    geometry: THREE.BufferGeometry,
    x: number,
    y: number,
    z: number,
    mat = material,
  ) => {
    geometries.push(geometry);
    const mesh = new THREE.Mesh(geometry, mat);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    return mesh;
  };
  if (item.capabilityId === "power") {
    add(new THREE.CylinderGeometry(0.04, 0.055, 0.16, 10), 0, 0.15, 0);
    add(new THREE.CylinderGeometry(0.065, 0.08, 0.025, 10), 0, 0.04, 0);
    for (const x of [-0.12, 0.12]) {
      add(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), x, 0.07, 0);
      add(new THREE.BoxGeometry(0.14, 0.009, 0.2), x, 0.15, 0, material);
    }
  } else if (item.capabilityId === "comms") {
    add(new THREE.CylinderGeometry(0.012, 0.02, 0.2, 8), 0, 0.1, 0);
    const dish = add(
      new THREE.SphereGeometry(0.085, 16, 8, 0, Math.PI * 2, 0, 0.9),
      0,
      0.2,
      0,
    );
    dish.rotation.x = 0.5;
  } else if (item.capabilityId === "hab" || item.capabilityId === "eclss") {
    const body = add(
      new THREE.CylinderGeometry(0.085, 0.085, 0.29, 16),
      0,
      0.12,
      0,
    );
    body.rotation.z = Math.PI / 2;
    for (const x of [-0.11, 0.11])
      add(new THREE.BoxGeometry(0.025, 0.065, 0.12), x, 0.035, 0);
    add(new THREE.BoxGeometry(0.05, 0.05, 0.015), 0.03, 0.13, 0.086, dark);
  } else if (item.capabilityId === "ltv" || item.capabilityId === "ice") {
    add(new THREE.BoxGeometry(0.19, 0.05, 0.11), 0, 0.07, 0);
    for (const x of [-0.07, 0.07])
      for (const z of [-0.08, 0.08]) {
        const wheel = add(
          new THREE.CylinderGeometry(0.035, 0.035, 0.03, 10),
          x,
          0.035,
          z,
          dark,
        );
        wheel.rotation.x = Math.PI / 2;
      }
    add(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 6), 0.05, 0.16, 0);
  } else {
    add(new THREE.CylinderGeometry(0.065, 0.085, 0.14, 8), 0, 0.1, 0);
    for (const x of [-0.09, 0.09])
      for (const z of [-0.09, 0.09])
        add(new THREE.CylinderGeometry(0.006, 0.01, 0.06, 6), x, 0.03, z);
    add(new THREE.BoxGeometry(0.22, 0.008, 0.1), 0, 0.18, 0, dark);
  }
  return {
    group,
    dispose() {
      geometries.forEach((g) => g.dispose());
      material.dispose();
      dark.dispose();
    },
  };
}
