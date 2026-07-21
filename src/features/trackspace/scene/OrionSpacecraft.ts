import * as THREE from "three";

export type OrionSpacecraft = {
  group: THREE.Group;
  dispose: () => void;
};

/**
 * A lightweight, self-contained approximation of the Artemis Orion stack.
 * The model points along local +Z so the scene can align it to the flight path
 * with Object3D.lookAt(). Dimensions are intentionally exaggerated just enough
 * for the capsule, service module, and four solar wings to read at system scale.
 */
export function createOrionSpacecraft(): OrionSpacecraft {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();
  const group = new THREE.Group();
  const model = new THREE.Group();
  group.name = "Artemis Orion spacecraft";
  model.name = "Orion crew and service module";
  model.rotation.z = Math.PI / 4;
  model.scale.setScalar(0.85);
  group.add(model);

  const material = (
    color: THREE.ColorRepresentation,
    options: {
      metalness?: number;
      roughness?: number;
      emissive?: THREE.ColorRepresentation;
      emissiveIntensity?: number;
      side?: THREE.Side;
    } = {},
  ) => {
    const next = new THREE.MeshStandardMaterial({
      color,
      metalness: options.metalness ?? 0.35,
      roughness: options.roughness ?? 0.62,
      emissive: options.emissive ?? 0x000000,
      emissiveIntensity: options.emissiveIntensity ?? 0,
      side: options.side ?? THREE.FrontSide,
    });
    materials.add(next);
    return next;
  };

  const white = material(0xdfe6e8, {
    metalness: 0.55,
    roughness: 0.36,
    emissive: 0x233039,
    emissiveIntensity: 0.25,
  });
  const silver = material(0x8d9aa0, { metalness: 0.76, roughness: 0.3 });
  const dark = material(0x111920, { metalness: 0.62, roughness: 0.42 });
  const foil = material(0xa77836, {
    metalness: 0.7,
    roughness: 0.44,
    emissive: 0x2a1605,
    emissiveIntensity: 0.22,
  });
  const solar = material(0x123f74, {
    metalness: 0.3,
    roughness: 0.48,
    emissive: 0x061b38,
    emissiveIntensity: 0.72,
    side: THREE.DoubleSide,
  });
  const solarGrid = material(0x77a7cb, {
    metalness: 0.35,
    roughness: 0.4,
    emissive: 0x173b59,
    emissiveIntensity: 0.55,
  });
  const navigationLight = new THREE.MeshBasicMaterial({
    color: 0xbfefff,
    toneMapped: false,
  });
  materials.add(navigationLight);

  function mesh(
    geometry: THREE.BufferGeometry,
    meshMaterial: THREE.Material,
    name: string,
  ) {
    geometries.add(geometry);
    const next = new THREE.Mesh(geometry, meshMaterial);
    next.name = name;
    return next;
  }

  function alignCylinder(next: THREE.Mesh, z: number) {
    next.rotation.x = Math.PI / 2;
    next.position.z = z;
    return next;
  }

  // Orion crew module: shallow conic pressure vessel, heat shield, and the
  // forward docking/hatch hardware at the nose.
  const crewModule = alignCylinder(
    mesh(
      new THREE.CylinderGeometry(0.024, 0.071, 0.092, 16, 2, false),
      white,
      "Orion crew module",
    ),
    0.067,
  );
  model.add(crewModule);

  const heatShield = alignCylinder(
    mesh(
      new THREE.CylinderGeometry(0.071, 0.068, 0.012, 16),
      dark,
      "Crew module heat shield",
    ),
    0.015,
  );
  model.add(heatShield);

  const dockingRing = alignCylinder(
    mesh(
      new THREE.CylinderGeometry(0.018, 0.022, 0.025, 12),
      silver,
      "Forward docking ring",
    ),
    0.124,
  );
  model.add(dockingRing);

  // European Service Module with the gold-toned thermal blanket, adapter
  // bands, and the prominent main-engine bell.
  const serviceModule = alignCylinder(
    mesh(
      new THREE.CylinderGeometry(0.061, 0.061, 0.13, 16),
      foil,
      "European service module",
    ),
    -0.056,
  );
  model.add(serviceModule);

  for (const [z, radius] of [
    [0.004, 0.064],
    [-0.116, 0.061],
  ] as const) {
    model.add(
      alignCylinder(
        mesh(
          new THREE.CylinderGeometry(radius, radius, 0.012, 16),
          silver,
          "Service module structural ring",
        ),
        z,
      ),
    );
  }

  const engineBell = alignCylinder(
    mesh(
      new THREE.CylinderGeometry(0.016, 0.036, 0.046, 14, 1, true),
      dark,
      "Orion main engine",
    ),
    -0.145,
  );
  model.add(engineBell);

  const engineThroat = alignCylinder(
    mesh(
      new THREE.CylinderGeometry(0.014, 0.014, 0.008, 12),
      navigationLight,
      "Engine throat",
    ),
    -0.17,
  );
  model.add(engineThroat);

  // Orion flies with four X-shaped solar wings. Each wing is split into three
  // blue cells with pale structural seams so it stays legible from a distance.
  const boomGeometry = new THREE.CylinderGeometry(0.004, 0.004, 0.05, 8);
  const panelGeometry = new THREE.BoxGeometry(0.052, 0.049, 0.005);
  const seamGeometry = new THREE.BoxGeometry(0.0018, 0.051, 0.006);
  geometries.add(boomGeometry);
  geometries.add(panelGeometry);
  geometries.add(seamGeometry);

  for (let wingIndex = 0; wingIndex < 4; wingIndex += 1) {
    const wing = new THREE.Group();
    wing.name = `Solar wing ${wingIndex + 1}`;
    wing.rotation.z = wingIndex * (Math.PI / 2);

    const boom = new THREE.Mesh(boomGeometry, silver);
    boom.name = "Solar wing boom";
    boom.rotation.z = Math.PI / 2;
    boom.position.x = 0.085;
    boom.position.z = -0.045;
    wing.add(boom);

    for (let cellIndex = 0; cellIndex < 3; cellIndex += 1) {
      const cell = new THREE.Mesh(panelGeometry, solar);
      cell.name = "Solar array panel";
      cell.position.set(0.126 + cellIndex * 0.055, 0, -0.045);
      wing.add(cell);

      if (cellIndex < 2) {
        const seam = new THREE.Mesh(seamGeometry, solarGrid);
        seam.name = "Solar array hinge";
        seam.position.set(0.1535 + cellIndex * 0.055, 0, -0.045);
        wing.add(seam);
      }
    }
    model.add(wing);
  }

  // Small RCS pods and a cool forward light add enough silhouette/detail to
  // distinguish the stack without turning it into a high-poly hero asset.
  const thrusterGeometry = new THREE.ConeGeometry(0.009, 0.022, 8);
  geometries.add(thrusterGeometry);
  for (let index = 0; index < 4; index += 1) {
    const angle = index * (Math.PI / 2);
    const thruster = new THREE.Mesh(thrusterGeometry, dark);
    thruster.name = "Reaction-control thruster";
    thruster.position.set(
      Math.cos(angle) * 0.064,
      Math.sin(angle) * 0.064,
      -0.087,
    );
    thruster.rotation.z = angle - Math.PI / 2;
    model.add(thruster);
  }

  const beacon = mesh(
    new THREE.SphereGeometry(0.008, 10, 8),
    navigationLight,
    "Forward navigation light",
  );
  beacon.position.set(0, 0, 0.14);
  model.add(beacon);

  return {
    group,
    dispose() {
      for (const geometry of geometries) geometry.dispose();
      for (const currentMaterial of materials) currentMaterial.dispose();
    },
  };
}
