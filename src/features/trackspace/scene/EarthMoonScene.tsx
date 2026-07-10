"use client";

// Earth/Moon scene for the Command Center stage.
//
// Renders NASA-derived imagery (bundled under public/textures/, originally
// from the three.js examples): day/night Earth with city lights on the dark
// side, a drifting cloud layer, and the real lunar surface. The Moon runs an
// inclined elliptical orbit with Earth at the focus and stays tidally locked.
// Sizes are to scale (Moon ≈ 0.27 Earth radii); the orbital distance is
// compressed so both bodies stay in frame.

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import type { Location, LocationKind, SpatialBody, Status } from "../data/types";

const EARTH_RADIUS = 1.5;
const EARTH_TILT = 0.41; // 23.4°
const MOON_RADIUS = EARTH_RADIUS * 0.273;
const ORBIT_SEMI_MAJOR = 7.05;
const ORBIT_ECCENTRICITY = 0.055;
const ORBIT_INCLINATION = 0.09; // 5.1°
const ORBIT_SEMI_MINOR =
  ORBIT_SEMI_MAJOR * Math.sqrt(1 - ORBIT_ECCENTRICITY * ORBIT_ECCENTRICITY);
const ORBIT_FOCUS_OFFSET = ORBIT_SEMI_MAJOR * ORBIT_ECCENTRICITY;
const MARKER_DOT_RADIUS = 0.022;
const MARKER_RING_INNER_RADIUS = 0.046;
const MARKER_RING_OUTER_RADIUS = 0.064;
const MARKER_HIT_RADIUS_PX = 36;

type SceneFocus = "system" | "earth" | "moon";
type SceneLayer = "sites" | "trajectory" | "maneuvers";
type SimulationSpeed = 1 | 8 | 32;
type MissionPhase = "outbound" | "lunar-orbit" | "return";

type SceneTelemetry = {
  distanceKm: number;
  lightDelaySeconds: number;
  phasePercent: number;
  missionPhase: string;
  missionPercent: number;
  missionDetail: string;
};

const INITIAL_TELEMETRY: SceneTelemetry = {
  distanceKm: 384_400,
  lightDelaySeconds: 1.28,
  phasePercent: 23,
  missionPhase: "TLI coast",
  missionPercent: 12,
  missionDetail: "Moon intercept",
};
const SCENE_FOCUS_OPTIONS = ["system", "earth", "moon"] as const;
const SIMULATION_SPEED_OPTIONS = [1, 8, 32] as const;

const STATUS_COLORS: Record<Status, string> = {
  ready: "#8df0ad",
  watch: "#ffd166",
  blocker: "#ff5468",
  unknown: "#8fa2bd",
};

const LOCATION_KIND_LABEL: Record<LocationKind, string> = {
  "launch-site": "Launch site",
  "test-site": "Test site",
  "contractor-site": "Contractor site",
  "landing-region": "Landing region",
  "surface-site": "Surface site",
  orbit: "Orbit",
};

type SceneHover = {
  id: string;
  name: string;
  body: SpatialBody;
  kind: LocationKind;
  status: Status;
  x: number;
  y: number;
};

type TrackspaceCanvas = HTMLCanvasElement & {
  __trackspace?: {
    readonly focus: SceneFocus;
    readonly missionPhase: MissionPhase;
    earthScreen: () => { x: number; y: number };
    moonScreen: () => { x: number; y: number };
    locationScreens: () => Array<{
      id: string;
      x: number;
      y: number;
      visible: boolean;
    }>;
  };
};

type SceneCallbacks = {
  onLocationOpen: (id: string) => void;
  onHoverChange: (hover: SceneHover | null) => void;
  onFocusChange: (focus: SceneFocus) => void;
  onTelemetryChange: (telemetry: SceneTelemetry) => void;
};

type SceneController = {
  destroy: () => void;
  setFocus: (focus: SceneFocus) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: SimulationSpeed) => void;
  setLayer: (layer: SceneLayer, visible: boolean) => void;
  resetView: () => void;
};

function surfacePoint(radius: number, lat: number, lon: number): THREE.Vector3 {
  const phi = ((90 - lat) * Math.PI) / 180;
  // SphereGeometry's equirectangular UV seam sits at -180°, so geographic
  // longitude must be shifted before converting to local sphere coordinates.
  const theta = ((lon + 180) * Math.PI) / 180;
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta),
  );
}

function createEarthMoonScene(
  canvas: HTMLCanvasElement,
  locations: readonly Location[],
  callbacks: SceneCallbacks,
) {
  const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const target = new THREE.Vector3(0, 0, 0);
  const disposables: { dispose(): void }[] = [];

  const loader = new THREE.TextureLoader();
  const loadColor = (url: string) => {
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    disposables.push(tex);
    return tex;
  };
  const loadData = (url: string) => {
    const tex = loader.load(url);
    tex.anisotropy = 8;
    disposables.push(tex);
    return tex;
  };

  type NavigationPath = {
    root: THREE.Group;
    geometry: LineGeometry;
    coreMaterial: LineMaterial;
    haloMaterial: LineMaterial;
    coreBrightness: number;
    haloBrightness: number;
    startColor: THREE.Color;
    endColor: THREE.Color;
    usesGradient: boolean;
  };

  function setNavigationPathPoints(
    path: NavigationPath,
    points: readonly THREE.Vector3[],
  ) {
    const safePoints =
      points.length > 1
        ? points
        : [new THREE.Vector3(), new THREE.Vector3(0.0001, 0, 0)];
    const positions: number[] = [];
    const colors: number[] = [];
    const color = new THREE.Color();
    safePoints.forEach((point, index) => {
      positions.push(point.x, point.y, point.z);
      if (path.usesGradient) {
        color.lerpColors(
          path.startColor,
          path.endColor,
          index / Math.max(1, safePoints.length - 1),
        );
        colors.push(color.r, color.g, color.b);
      }
    });
    path.geometry.setPositions(positions);
    if (path.usesGradient) path.geometry.setColors(colors);
    path.geometry.computeBoundingSphere();
  }

  function setNavigationPathIntensity(path: NavigationPath, intensity: number) {
    const coreBrightness = path.coreBrightness * intensity;
    const haloBrightness = path.haloBrightness * intensity;
    if (path.usesGradient) {
      path.coreMaterial.color.setScalar(coreBrightness);
      path.haloMaterial.color.setScalar(haloBrightness);
    } else {
      path.coreMaterial.color
        .copy(path.startColor)
        .multiplyScalar(coreBrightness);
      path.haloMaterial.color
        .copy(path.startColor)
        .multiplyScalar(haloBrightness);
    }
  }

  function createNavigationPath({
    points = [],
    color,
    endColor = color,
    coreWidth,
    haloWidth,
    coreBrightness,
    haloBrightness,
  }: {
    points?: readonly THREE.Vector3[];
    color: THREE.ColorRepresentation;
    endColor?: THREE.ColorRepresentation;
    coreWidth: number;
    haloWidth: number;
    coreBrightness: number;
    haloBrightness: number;
  }): NavigationPath {
    const usesGradient = color !== endColor;
    const geometry = new LineGeometry();
    const coreMaterial = new LineMaterial({
      color: usesGradient ? 0xffffff : color,
      linewidth: coreWidth,
      vertexColors: usesGradient,
      transparent: false,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    });
    const haloMaterial = new LineMaterial({
      color: usesGradient ? 0xffffff : color,
      linewidth: haloWidth,
      vertexColors: usesGradient,
      transparent: false,
      opacity: 1,
      depthWrite: false,
      toneMapped: false,
    });
    const halo = new Line2(geometry, haloMaterial);
    const core = new Line2(geometry, coreMaterial);
    halo.frustumCulled = false;
    core.frustumCulled = false;
    halo.renderOrder = 1;
    core.renderOrder = 2;
    const root = new THREE.Group();
    root.add(halo, core);
    const path = {
      root,
      geometry,
      coreMaterial,
      haloMaterial,
      coreBrightness,
      haloBrightness,
      startColor: new THREE.Color(color),
      endColor: new THREE.Color(endColor),
      usesGradient,
    };
    setNavigationPathPoints(path, points);
    setNavigationPathIntensity(path, 1);
    disposables.push(geometry, coreMaterial, haloMaterial);
    return path;
  }

  function createManeuverLabel(
    code: string,
    detail: string,
    color: string,
  ) {
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const ctx = labelCanvas.getContext("2d")!;
    ctx.fillStyle = "rgba(3, 8, 13, 0.86)";
    ctx.fillRect(12, 12, 488, 94);
    ctx.strokeStyle = "rgba(106, 151, 183, 0.42)";
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 488, 94);
    ctx.fillStyle = color;
    ctx.fillRect(12, 12, 5, 94);
    ctx.font = "600 34px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#e4f2fb";
    ctx.textBaseline = "top";
    ctx.fillText(code, 34, 26);
    ctx.font = "500 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#7990a5";
    ctx.fillText(detail.toUpperCase(), 34, 70);

    const texture = new THREE.CanvasTexture(labelCanvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = THREE.LinearFilter;
    const material = new THREE.SpriteMaterial({
      map: texture,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      sizeAttenuation: false,
    });
    const sprite = new THREE.Sprite(material);
    sprite.center.set(1, 0);
    sprite.scale.set(0.12, 0.03, 1);
    disposables.push(texture, material);
    return sprite;
  }

  // Sun well off to the side so the terminator and night side stay visible.
  const sunDir = new THREE.Vector3(-6.5, 1.8, 2).normalize();
  const sun = new THREE.DirectionalLight(0xfff3e2, 4.6 * Math.PI);
  sun.position.copy(sunDir).multiplyScalar(50);
  scene.add(sun);
  // Faint cool fill so the night side reads as a silhouette, not a hole.
  scene.add(new THREE.AmbientLight(0x33415c, 0.16 * Math.PI));

  // Space is black — not the app's panel blue.
  scene.background = new THREE.Color(0x000103);

  const root = new THREE.Group();
  scene.add(root);

  // EARTH ------------------------------------------------------------------
  const earthGroup = new THREE.Group();
  root.add(earthGroup);
  earthGroup.rotation.z = EARTH_TILT;

  const earthGeo = new THREE.SphereGeometry(EARTH_RADIUS, 96, 64);
  disposables.push(earthGeo);

  const earthMat = new THREE.MeshPhongMaterial({
    map: loadColor("/textures/earth_atmos_2048.jpg"),
    specularMap: loadData("/textures/earth_specular_2048.jpg"),
    normalMap: loadData("/textures/earth_normal_2048.jpg"),
    normalScale: new THREE.Vector2(0.8, 0.8),
    specular: new THREE.Color(0x3a3f47),
    shininess: 18,
  });
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earthGroup.add(earth);
  disposables.push(earthMat);

  // City lights, masked to the night side of the terminator.
  const lightsMat = new THREE.ShaderMaterial({
    uniforms: {
      lightsMap: { value: loadColor("/textures/earth_lights_2048.png") },
      sunDir: { value: sunDir },
    },
    vertexShader: `
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        vUv = uv;
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform sampler2D lightsMap;
      uniform vec3 sunDir;
      varying vec2 vUv;
      varying vec3 vWorldNormal;
      void main() {
        float night = smoothstep(0.08, -0.18, dot(normalize(vWorldNormal), sunDir));
        vec3 lights = texture2D(lightsMap, vUv).rgb;
        gl_FragColor = vec4(lights * vec3(1.0, 0.88, 0.62) * night * 1.6, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  earth.add(new THREE.Mesh(earthGeo, lightsMat));
  disposables.push(lightsMat);

  // Cloud layer, drifting slightly faster than the surface.
  const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 96, 64);
  const cloudMat = new THREE.MeshLambertMaterial({
    map: loadColor("/textures/earth_clouds_1024.png"),
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  earthGroup.add(clouds);
  disposables.push(cloudGeo, cloudMat);

  // Atmosphere rim (fresnel on a back-side shell).
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      c: { value: new THREE.Color(0x6fb7ff) },
      p: { value: 3.6 },
      s: { value: 0.65 },
    },
    vertexShader: `varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader: `uniform vec3 c; uniform float p; uniform float s; varying vec3 vN;
      void main(){ float i = pow(max(s - dot(vN, vec3(0.0,0.0,1.0)), 0.0), p); gl_FragColor = vec4(c, clamp(i,0.0,1.0)); }`,
    blending: THREE.AdditiveBlending,
    side: THREE.BackSide,
    transparent: true,
    depthWrite: false,
  });
  const atmoGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.08, 64, 48);
  earthGroup.add(new THREE.Mesh(atmoGeo, atmoMat));
  disposables.push(atmoGeo, atmoMat);

  // MOON -------------------------------------------------------------------
  // Inclined orbital plane; Earth sits at one focus of the ellipse.
  const orbitPlane = new THREE.Group();
  orbitPlane.rotation.x = ORBIT_INCLINATION;
  root.add(orbitPlane);

  const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 64, 48);
  const moonMat = new THREE.MeshStandardMaterial({
    map: loadColor("/textures/moon_1024.jpg"),
    roughness: 1,
    metalness: 0,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  orbitPlane.add(moon);
  disposables.push(moonGeo, moonMat);

  let moonAngle = 1.0; // framed upper-right of the default camera, beyond Earth
  function moonPositionAt(angle: number, out: THREE.Vector3) {
    return out.set(
      Math.cos(angle) * ORBIT_SEMI_MAJOR - ORBIT_FOCUS_OFFSET,
      0,
      -Math.sin(angle) * ORBIT_SEMI_MINOR,
    );
  }
  function placeMoon() {
    moonPositionAt(moonAngle, moon.position);
    // Tidal lock: the same face always points at Earth.
    moon.rotation.y = moonAngle + Math.PI / 2;
  }
  placeMoon();

  // Data-driven location markers. The scene owns only projection and
  // interaction; site selection and provenance live in the Dataset.
  type MarkerEntry = {
    location: Location;
    body: "earth" | "moon";
    root: THREE.Group;
    marker: THREE.Mesh;
    ring: THREE.Mesh;
  };
  const markerEntries: MarkerEntry[] = [];
  const markerGeo = new THREE.SphereGeometry(MARKER_DOT_RADIUS, 16, 16);
  const ringGeo = new THREE.RingGeometry(
    MARKER_RING_INNER_RADIUS,
    MARKER_RING_OUTER_RADIUS,
    28,
  );
  const markerMaterials = Object.fromEntries(
    Object.entries(STATUS_COLORS).map(([status, color]) => [
      status,
      new THREE.MeshBasicMaterial({ color }),
    ]),
  ) as Record<Status, THREE.MeshBasicMaterial>;
  const ringMaterials = Object.fromEntries(
    Object.entries(STATUS_COLORS).map(([status, color]) => [
      status,
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.46,
        side: THREE.DoubleSide,
      }),
    ]),
  ) as Record<Status, THREE.MeshBasicMaterial>;
  disposables.push(
    markerGeo,
    ringGeo,
    ...Object.values(markerMaterials),
    ...Object.values(ringMaterials),
  );

  function addLocationMarker(
    location: Location,
    body: "earth" | "moon",
    parent: THREE.Object3D,
    radius: number,
  ) {
    if (typeof location.lat !== "number" || typeof location.lon !== "number") {
      return;
    }
    const position = surfacePoint(radius * 1.018, location.lat, location.lon);
    const rootMarker = new THREE.Group();
    rootMarker.position.copy(position);
    rootMarker.lookAt(position.clone().multiplyScalar(2));
    parent.add(rootMarker);

    const marker = new THREE.Mesh(markerGeo, markerMaterials[location.status]);
    const ring = new THREE.Mesh(ringGeo, ringMaterials[location.status]);
    rootMarker.add(marker, ring);

    const scale = body === "moon" ? 0.72 : 1;
    marker.scale.setScalar(scale);
    ring.scale.setScalar(scale);
    marker.userData.locationId = location.id;
    ring.userData.locationId = location.id;
    markerEntries.push({
      location,
      body,
      root: rootMarker,
      marker,
      ring,
    });
  }

  for (const location of locations) {
    if (location.body === "earth") {
      addLocationMarker(location, "earth", earth, EARTH_RADIUS);
    } else if (location.body === "moon") {
      addLocationMarker(location, "moon", moon, MOON_RADIUS);
    }
  }

  // A restrained orbital-plane grid makes the compressed scale legible and
  // gives the scene the feel of an analysis instrument, not a decorative orb.
  const orbitalGrid = new THREE.PolarGridHelper(
    10.2,
    12,
    4,
    128,
    0x21465b,
    0x132735,
  );
  const gridMaterials = Array.isArray(orbitalGrid.material)
    ? orbitalGrid.material
    : [orbitalGrid.material];
  for (const material of gridMaterials) {
    material.transparent = true;
    material.opacity = 0.2;
    material.depthWrite = false;
    disposables.push(material);
  }
  orbitPlane.add(orbitalGrid);

  // Orbit path matching the actual ellipse.
  const orbitPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 256; i++) {
    const a = (i / 256) * Math.PI * 2;
    orbitPoints.push(
      new THREE.Vector3(
        Math.cos(a) * ORBIT_SEMI_MAJOR - ORBIT_FOCUS_OFFSET,
        0,
        -Math.sin(a) * ORBIT_SEMI_MINOR,
      ),
    );
  }
  const systemOrbitPath = createNavigationPath({
    points: orbitPoints,
    color: 0x4da8c8,
    coreWidth: 0.72,
    haloWidth: 3.4,
    coreBrightness: 0.24,
    haloBrightness: 0.035,
  });
  orbitPlane.add(systemOrbitPath.root);

  // NOMINAL TRANSLUNAR TRANSFER --------------------------------------------
  // A patched-conic visual model: coast in a low Earth parking orbit, burn
  // tangentially at perigee (TLI), then follow one half of a highly eccentric
  // Earth-centered ellipse toward the Moon's *future* position. The Moon
  // advances by roughly 40° during a representative three-day coast.
  const trajectoryGroup = new THREE.Group();
  orbitPlane.add(trajectoryGroup);
  const trajectoryPathsGroup = new THREE.Group();
  const maneuverNodesGroup = new THREE.Group();
  trajectoryGroup.add(trajectoryPathsGroup, maneuverNodesGroup);

  const parkingRadius = EARTH_RADIUS * 1.22;
  const parkingPoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * Math.PI * 2;
    parkingPoints.push(
      new THREE.Vector3(
        Math.cos(a) * parkingRadius,
        0,
        Math.sin(a) * parkingRadius,
      ),
    );
  }
  const parkingPath = createNavigationPath({
    points: parkingPoints,
    color: 0x4c9fbd,
    coreWidth: 0.85,
    haloWidth: 3.8,
    coreBrightness: 0.3,
    haloBrightness: 0.045,
  });
  trajectoryPathsGroup.add(parkingPath.root);

  const outboundPath = createNavigationPath({
    color: 0x79d9ff,
    endColor: 0xc9f6ff,
    coreWidth: 1.35,
    haloWidth: 6.5,
    coreBrightness: 0.86,
    haloBrightness: 0.13,
  });
  const trajectoryLine = outboundPath.root;
  trajectoryPathsGroup.add(trajectoryLine);

  const earthReturnPath = createNavigationPath({
    color: 0xffd08c,
    endColor: 0xff876f,
    coreWidth: 1.35,
    haloWidth: 6.5,
    coreBrightness: 0.86,
    haloBrightness: 0.14,
  });
  const returnLine = earthReturnPath.root;
  returnLine.visible = false;
  trajectoryPathsGroup.add(returnLine);

  const vehicleGeometry = new THREE.OctahedronGeometry(0.055, 0);
  const vehicleMaterial = new THREE.MeshBasicMaterial({ color: 0xd7f5ff });
  const transferVehicle = new THREE.Mesh(vehicleGeometry, vehicleMaterial);
  trajectoryPathsGroup.add(transferVehicle);

  // The shrinking arc shows how far the Moon still has to travel before the
  // spacecraft reaches the precomputed intercept point.
  const moonLeadPath = createNavigationPath({
    color: 0x5bd0ff,
    coreWidth: 0.62,
    haloWidth: 2.8,
    coreBrightness: 0.16,
    haloBrightness: 0.025,
  });
  const leadArc = moonLeadPath.root;
  trajectoryPathsGroup.add(leadArc);

  const burnGeometry = new THREE.RingGeometry(0.045, 0.068, 28);
  const burnMaterial = new THREE.MeshBasicMaterial({
    color: 0xffd58a,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const tliMarker = new THREE.Mesh(burnGeometry, burnMaterial);
  tliMarker.rotation.x = -Math.PI / 2;
  maneuverNodesGroup.add(tliMarker);

  const arrivalGeometry = new THREE.RingGeometry(0.065, 0.095, 32);
  const arrivalMaterial = new THREE.MeshBasicMaterial({
    color: 0x8fe6ff,
    transparent: true,
    opacity: 0.72,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const arrivalTarget = new THREE.Mesh(arrivalGeometry, arrivalMaterial);
  arrivalTarget.rotation.x = -Math.PI / 2;
  maneuverNodesGroup.add(arrivalTarget);

  // Lunar orbit insertion is shown as a capture orbit around the moving Moon.
  const captureGroup = new THREE.Group();
  trajectoryPathsGroup.add(captureGroup);
  const lunarNodesGroup = new THREE.Group();
  maneuverNodesGroup.add(lunarNodesGroup);
  const captureRadius = MOON_RADIUS * 1.42;
  const capturePoints: THREE.Vector3[] = [];
  for (let i = 0; i <= 96; i++) {
    const a = (i / 96) * Math.PI * 2;
    capturePoints.push(
      new THREE.Vector3(
        Math.cos(a) * captureRadius,
        0,
        Math.sin(a) * captureRadius,
      ),
    );
  }
  const lunarCapturePath = createNavigationPath({
    points: capturePoints,
    color: 0xb8ecff,
    coreWidth: 0.92,
    haloWidth: 4.2,
    coreBrightness: 0.5,
    haloBrightness: 0.075,
  });
  captureGroup.add(lunarCapturePath.root);

  const loiMarker = new THREE.Mesh(burnGeometry, burnMaterial);
  loiMarker.rotation.x = -Math.PI / 2;
  loiMarker.scale.setScalar(0.72);
  lunarNodesGroup.add(loiMarker);

  const teiMaterial = new THREE.MeshBasicMaterial({
    color: 0xffbd79,
    transparent: true,
    opacity: 0.95,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const teiMarker = new THREE.Mesh(burnGeometry, teiMaterial);
  teiMarker.rotation.x = -Math.PI / 2;
  teiMarker.scale.setScalar(0.8);
  teiMarker.visible = false;
  lunarNodesGroup.add(teiMarker);

  const entryGeometry = new THREE.RingGeometry(0.055, 0.082, 28);
  const entryMaterial = new THREE.MeshBasicMaterial({
    color: 0xff876f,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const earthEntryTarget = new THREE.Mesh(entryGeometry, entryMaterial);
  earthEntryTarget.rotation.x = -Math.PI / 2;
  earthEntryTarget.visible = false;
  maneuverNodesGroup.add(earthEntryTarget);

  // Only mission-relevant nodes are shown: burns, the lunar intercept, and
  // Earth entry for this direct patched-conic profile.
  const nodeCoreGeometry = new THREE.CircleGeometry(0.017, 18);
  function addNodeCore(
    marker: THREE.Mesh,
    material: THREE.Material,
  ) {
    const core = new THREE.Mesh(nodeCoreGeometry, material);
    core.position.z = 0.002;
    marker.add(core);
  }
  addNodeCore(tliMarker, burnMaterial);
  addNodeCore(arrivalTarget, arrivalMaterial);
  addNodeCore(loiMarker, burnMaterial);
  addNodeCore(teiMarker, teiMaterial);
  addNodeCore(earthEntryTarget, entryMaterial);

  const tliLabel = createManeuverLabel("TLI", "Perigee departure burn", "#ffd58a");
  const interceptLabel = createManeuverLabel(
    "INTERCEPT",
    "Moon at arrival · +40° lead",
    "#8fe6ff",
  );
  const loiLabel = createManeuverLabel("LOI", "Retrograde capture burn", "#ffd58a");
  const teiLabel = createManeuverLabel("TEI", "Prograde Earth-return burn", "#ffbd79");
  const entryLabel = createManeuverLabel("EI", "Atmospheric entry interface", "#ff876f");
  maneuverNodesGroup.add(tliLabel, interceptLabel, entryLabel);
  lunarNodesGroup.add(loiLabel, teiLabel);

  disposables.push(
    vehicleGeometry,
    vehicleMaterial,
    burnGeometry,
    burnMaterial,
    teiMaterial,
    entryGeometry,
    entryMaterial,
    arrivalGeometry,
    arrivalMaterial,
    nodeCoreGeometry,
  );

  const MOON_LEAD_ANGLE = THREE.MathUtils.degToRad(40);
  const MOON_SIMULATION_RATE = 0.012;
  const TRANSFER_SIMULATION_RATE = MOON_SIMULATION_RATE / MOON_LEAD_ANGLE;
  const LUNAR_ORBIT_COUNT = 2;
  const LUNAR_ORBIT_DURATION = 16;
  const LUNAR_ORBIT_SIMULATION_RATE = 1 / LUNAR_ORBIT_DURATION;
  const LUNAR_MOON_ADVANCE = THREE.MathUtils.degToRad(2.2);
  const LUNAR_MOON_SIMULATION_RATE =
    LUNAR_MOON_ADVANCE / LUNAR_ORBIT_DURATION;
  const EARTH_ENTRY_RADIUS = EARTH_RADIUS * 1.055;
  const transferTarget = new THREE.Vector3();
  const transferAxis = new THREE.Vector3();
  const transferNormal = new THREE.Vector3();
  const transferPoint = new THREE.Vector3();
  const lunarAxis = new THREE.Vector3();
  const lunarNormal = new THREE.Vector3();
  const lunarLocalPoint = new THREE.Vector3();
  const returnAxis = new THREE.Vector3();
  const returnNormal = new THREE.Vector3();
  const returnPoint = new THREE.Vector3();
  let transferArrivalAngle = moonAngle + MOON_LEAD_ANGLE;
  let transferSemiMajor = 1;
  let transferSemiMinor = 1;
  let transferCenter = 0;
  let transferEccentricity = 0;
  let returnSemiMajor = 1;
  let returnSemiMinor = 1;
  let returnCenter = 0;
  let returnEccentricity = 0;
  let missionPhase: MissionPhase = "outbound";
  let missionProgress = 0.12;

  function pointOnTransfer(eccentricParameter: number, out: THREE.Vector3) {
    const ellipseAngle = Math.PI - eccentricParameter;
    const major = transferCenter + transferSemiMajor * Math.cos(ellipseAngle);
    const minor = transferSemiMinor * Math.sin(ellipseAngle);
    return out
      .copy(transferAxis)
      .multiplyScalar(major)
      .addScaledVector(transferNormal, minor);
  }

  function solveKepler(meanAnomaly: number, eccentricity: number) {
    let eccentricAnomaly = meanAnomaly;
    for (let i = 0; i < 6; i++) {
      eccentricAnomaly -=
        (eccentricAnomaly -
          eccentricity * Math.sin(eccentricAnomaly) -
          meanAnomaly) /
        (1 - eccentricity * Math.cos(eccentricAnomaly));
    }
    return eccentricAnomaly;
  }

  function pointOnReturn(eccentricParameter: number, out: THREE.Vector3) {
    const major = returnCenter + returnSemiMajor * Math.cos(eccentricParameter);
    const minor = -returnSemiMinor * Math.sin(eccentricParameter);
    return out
      .copy(returnAxis)
      .multiplyScalar(major)
      .addScaledVector(returnNormal, minor);
  }

  function updateLunarFrame() {
    lunarAxis.copy(moon.position).normalize();
    lunarNormal.set(-lunarAxis.z, 0, lunarAxis.x);
    captureGroup.position.copy(moon.position);
    lunarNodesGroup.position.copy(moon.position);
    loiMarker.position.copy(lunarAxis).multiplyScalar(-captureRadius);
    teiMarker.position.copy(loiMarker.position);
    loiLabel.position.copy(loiMarker.position);
    loiLabel.position.y += 0.14;
    teiLabel.position.copy(teiMarker.position);
    teiLabel.position.y += 0.14;
  }

  function pointOnLunarOrbit(angle: number, out: THREE.Vector3) {
    return out
      .copy(lunarAxis)
      .multiplyScalar(-captureRadius * Math.cos(angle))
      .addScaledVector(lunarNormal, -captureRadius * Math.sin(angle));
  }

  function updateSystemReferences() {
    updateLunarFrame();
  }

  function planOutboundTransfer() {
    transferArrivalAngle = moonAngle + MOON_LEAD_ANGLE;
    moonPositionAt(transferArrivalAngle, transferTarget);
    transferAxis.copy(transferTarget).normalize();
    transferNormal.set(-transferAxis.z, 0, transferAxis.x);

    // Ending one capture-orbit radius short of the lunar center makes the
    // transfer ellipse and lunar orbit meet at exactly the same point.
    const apoapsis = transferTarget.length() - captureRadius;
    transferSemiMajor = (parkingRadius + apoapsis) / 2;
    transferCenter = (apoapsis - parkingRadius) / 2;
    transferEccentricity = transferCenter / transferSemiMajor;
    transferSemiMinor =
      transferSemiMajor *
      Math.sqrt(1 - transferEccentricity * transferEccentricity);

    const transferPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 144; i++) {
      transferPoints.push(
        pointOnTransfer((i / 144) * Math.PI, new THREE.Vector3()),
      );
    }
    setNavigationPathPoints(outboundPath, transferPoints);
    tliMarker.position.copy(transferPoints[0]);
    tliLabel.position.copy(tliMarker.position);
    tliLabel.position.y += 0.14;
    arrivalTarget.position.copy(transferTarget);
    interceptLabel.position.copy(transferTarget);
    interceptLabel.position.y += 0.16;
    setNavigationPathIntensity(outboundPath, 1);
    trajectoryLine.visible = true;
    leadArc.visible = true;
    arrivalTarget.visible = true;
    returnLine.visible = false;
    earthEntryTarget.visible = false;
    entryLabel.visible = false;
    tliMarker.visible = true;
    teiMarker.visible = false;
    teiLabel.visible = false;
    loiMarker.visible = false;
    loiLabel.visible = false;
    tliLabel.visible = true;
    interceptLabel.visible = true;
  }

  function updateOutboundTransfer(progress: number) {
    const meanAnomaly = Math.PI * THREE.MathUtils.clamp(progress, 0, 1);
    pointOnTransfer(
      solveKepler(meanAnomaly, transferEccentricity),
      transferPoint,
    );
    transferVehicle.position.copy(transferPoint);
    updateSystemReferences();

    const remainingAngle = Math.max(0, transferArrivalAngle - moonAngle);
    const leadPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 32; i++) {
      moonPositionAt(
        moonAngle + (remainingAngle * i) / 32,
        transferPoint,
      );
      leadPoints.push(transferPoint.clone());
    }
    setNavigationPathPoints(moonLeadPath, leadPoints);
  }

  function enterLunarOrbit() {
    missionPhase = "lunar-orbit";
    missionProgress = 0;
    setNavigationPathIntensity(outboundPath, 0.22);
    leadArc.visible = false;
    arrivalTarget.visible = false;
    interceptLabel.visible = false;
    tliLabel.visible = false;
    tliMarker.visible = false;
    loiMarker.visible = true;
    loiLabel.visible = true;
    teiMarker.visible = false;
    teiLabel.visible = false;
    updateLunarOrbit(0);
  }

  function updateLunarOrbit(progress: number) {
    updateSystemReferences();
    const orbitAngle =
      progress * Math.PI * 2 * LUNAR_ORBIT_COUNT;
    pointOnLunarOrbit(orbitAngle, lunarLocalPoint);
    transferVehicle.position.copy(moon.position).add(lunarLocalPoint);
    loiMarker.visible = progress < 0.28;
    loiLabel.visible = loiMarker.visible;
    teiMarker.visible = progress > 0.62;
    teiLabel.visible = teiMarker.visible;
  }

  function planReturnTransfer() {
    updateLunarFrame();
    returnAxis.copy(lunarAxis);
    returnNormal.copy(lunarNormal);

    const apoapsis = moon.position.length() - captureRadius;
    returnSemiMajor = (EARTH_ENTRY_RADIUS + apoapsis) / 2;
    returnCenter = (apoapsis - EARTH_ENTRY_RADIUS) / 2;
    returnEccentricity = returnCenter / returnSemiMajor;
    returnSemiMinor =
      returnSemiMajor *
      Math.sqrt(1 - returnEccentricity * returnEccentricity);

    const returnPoints: THREE.Vector3[] = [];
    for (let i = 0; i <= 144; i++) {
      returnPoints.push(
        pointOnReturn((i / 144) * Math.PI, new THREE.Vector3()),
      );
    }
    setNavigationPathPoints(earthReturnPath, returnPoints);
    earthEntryTarget.position.copy(returnPoints[returnPoints.length - 1]);
    entryLabel.position.copy(earthEntryTarget.position);
    entryLabel.position.y += 0.14;
    returnLine.visible = true;
    earthEntryTarget.visible = true;
    entryLabel.visible = true;
    teiMarker.visible = true;
    teiLabel.visible = true;
    loiMarker.visible = false;
    loiLabel.visible = false;
    tliLabel.visible = false;
    tliMarker.visible = false;
    interceptLabel.visible = false;
    setNavigationPathIntensity(outboundPath, 0.15);
  }

  function enterReturnTransfer() {
    missionPhase = "return";
    missionProgress = 0;
    planReturnTransfer();
    updateReturnTransfer(0);
  }

  function updateReturnTransfer(progress: number) {
    const meanAnomaly = Math.PI + Math.PI * THREE.MathUtils.clamp(progress, 0, 1);
    const eccentricAnomaly = solveKepler(meanAnomaly, returnEccentricity);
    pointOnReturn(eccentricAnomaly - Math.PI, returnPoint);
    transferVehicle.position.copy(returnPoint);
    updateSystemReferences();
  }

  function restartMissionCycle() {
    missionPhase = "outbound";
    missionProgress = 0;
    planOutboundTransfer();
    updateOutboundTransfer(0);
  }

  planOutboundTransfer();
  updateOutboundTransfer(missionProgress);

  // STARS ------------------------------------------------------------------
  // Crisp round point stars on the black sky. Sizes are fixed in screen
  // pixels (no distance attenuation) so they stay sharp at any zoom, like
  // real stars. Brightness classes: many faint, fewer mid, a handful bright.
  const starSprite = (() => {
    const cv = document.createElement("canvas");
    cv.width = cv.height = 32;
    const ctx = cv.getContext("2d")!;
    const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    grad.addColorStop(0, "rgba(255,255,255,1)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.7, "rgba(255,255,255,0.12)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 32, 32);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    disposables.push(tex);
    return tex;
  })();
  const dpr = renderer.getPixelRatio();
  let randomSeed = 0x83d2e71;
  const random = () => {
    randomSeed = (randomSeed * 1664525 + 1013904223) >>> 0;
    return randomSeed / 0x100000000;
  };
  for (const layer of [
    { count: 1300, size: 1.7, opacity: 0.55 },
    { count: 320, size: 2.6, opacity: 0.85 },
    { count: 60, size: 4.2, opacity: 1 },
  ]) {
    const pos = new Float32Array(layer.count * 3);
    const col = new Float32Array(layer.count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < layer.count; i++) {
      const r = 60 + random() * 60;
      const t = random() * Math.PI * 2;
      const ph = Math.acos(random() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(t);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(t);
      pos[i * 3 + 2] = r * Math.cos(ph);
      // Mostly white, a few leaning blue or warm.
      tint.setHSL(
        random() < 0.5 ? 0.6 : 0.09,
        random() * 0.25,
        0.8 + random() * 0.2,
      );
      col[i * 3] = tint.r;
      col[i * 3 + 1] = tint.g;
      col[i * 3 + 2] = tint.b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({
      map: starSprite,
      size: layer.size * dpr,
      vertexColors: true,
      transparent: true,
      opacity: layer.opacity,
      sizeAttenuation: false,
      depthWrite: false,
    });
    scene.add(new THREE.Points(g, m));
    disposables.push(g, m);
  }

  // INTERACTION: drag-orbit + wheel-zoom + double-click focus ---------------
  let azim = 0.5;
  let elev = 0.18;
  let dist = 12;
  let dragging = false;
  let px = 0;
  let py = 0;
  let downX = 0;
  let downY = 0;
  let pointerMoved = false;
  let idle = 0;
  let paused = false;
  let simulationSpeed: SimulationSpeed = 1;
  let lastTelemetryUpdate = 0;

  // The camera orbits and zooms around the focused body. Double-clicking a
  // body re-centers on it; the target glides over and then follows it.
  const FOCUS_RANGES = {
    system: { min: 9.2, max: 25, dist: 12 },
    earth: { min: 3.3, max: 14, dist: 4.7 },
    moon: { min: 1.15, max: 14, dist: 2.45 },
  };
  let focus: SceneFocus = "system";
  let distGoal: number | null = null;
  let azimGoal: number | null = null;
  let elevGoal: number | null = null;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const focusPoint = new THREE.Vector3();
  const markerWorld = new THREE.Vector3();
  const bodyWorld = new THREE.Vector3();
  const surfaceNormal = new THREE.Vector3();
  const cameraVector = new THREE.Vector3();

  function markerFacesCamera(entry: MarkerEntry): boolean {
    entry.root.getWorldPosition(markerWorld);
    if (entry.body === "moon") moon.getWorldPosition(bodyWorld);
    else bodyWorld.set(0, 0, 0);
    surfaceNormal.copy(markerWorld).sub(bodyWorld).normalize();
    cameraVector.copy(camera.position).sub(markerWorld).normalize();
    return surfaceNormal.dot(cameraVector) > 0.08;
  }

  function findMarker(clientX: number, clientY: number): MarkerEntry | null {
    const r = canvas.getBoundingClientRect();
    let best: MarkerEntry | null = null;
    let bestDistance = MARKER_HIT_RADIUS_PX;
    for (const entry of markerEntries) {
      if (!entry.root.visible) continue;
      entry.root.getWorldPosition(markerWorld);
      const projected = toScreen(markerWorld);
      if (
        projected.z <= -1 ||
        projected.z >= 1 ||
        projected.x < 0 ||
        projected.x > 1 ||
        projected.y < 0 ||
        projected.y > 1 ||
        !markerFacesCamera(entry)
      ) {
        continue;
      }
      const x = r.left + projected.x * r.width;
      const y = r.top + projected.y * r.height;
      const distance = Math.hypot(clientX - x, clientY - y);
      if (distance <= bestDistance) {
        best = entry;
        bestDistance = distance;
      }
    }
    return best;
  }

  function hoverPayload(entry: MarkerEntry, clientX: number, clientY: number): SceneHover {
    const r = canvas.getBoundingClientRect();
    const x = THREE.MathUtils.clamp(clientX - r.left, 8, Math.max(8, r.width - 280));
    const y = THREE.MathUtils.clamp(clientY - r.top, 36, Math.max(36, r.height - 36));
    return {
      id: entry.location.id,
      name: entry.location.name,
      body: entry.location.body,
      kind: entry.location.kind,
      status: entry.location.status,
      x,
      y,
    };
  }

  const toScreen = (world: THREE.Vector3) => {
    const v = world.project(camera);
    return { x: (v.x + 1) / 2, y: (1 - v.y) / 2, z: v.z };
  };

  function applyCam() {
    camera.position.x = target.x + dist * Math.cos(elev) * Math.sin(azim);
    camera.position.y = target.y + dist * Math.sin(elev);
    camera.position.z = target.z + dist * Math.cos(elev) * Math.cos(azim);
    camera.lookAt(target);
  }

  function focusScene(next: SceneFocus) {
    focus = next;
    distGoal = FOCUS_RANGES[next].dist;
    callbacks.onFocusChange(next);

    if (next === "moon") {
      // Frame the Moon with Earth over its shoulder, preserving context.
      const d = moon.getWorldPosition(new THREE.Vector3()).normalize();
      azimGoal = Math.atan2(d.x, d.z) + 0.5;
      elevGoal = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) + 0.12;
    } else if (next === "earth") {
      azimGoal = 0.52;
      elevGoal = 0.16;
    } else {
      azimGoal = 0.5;
      elevGoal = 0.18;
    }
    idle = 0;
  }

  const point = (e: MouseEvent | TouchEvent) =>
    "touches" in e ? e.touches[0] : e;
  const releasePoint = (e: MouseEvent | TouchEvent) =>
    "changedTouches" in e && e.changedTouches.length > 0
      ? e.changedTouches[0]
      : point(e);
  function activateMarkerAt(clientX: number, clientY: number): boolean {
    const hit = findMarker(clientX, clientY);
    if (!hit) return false;
    callbacks.onLocationOpen(hit.location.id);
    callbacks.onHoverChange(null);
    return true;
  }
  function onDown(e: MouseEvent | TouchEvent) {
    dragging = true;
    idle = 0;
    azimGoal = null;
    elevGoal = null;
    const t = point(e);
    px = t.clientX;
    py = t.clientY;
    downX = t.clientX;
    downY = t.clientY;
    pointerMoved = false;
    canvas.style.cursor = "grabbing";
  }
  function onMove(e: MouseEvent | TouchEvent) {
    if (!dragging) return;
    const t = point(e);
    if (Math.hypot(t.clientX - downX, t.clientY - downY) > 5) {
      pointerMoved = true;
    }
    azim -= (t.clientX - px) * 0.006;
    elev = Math.max(-0.9, Math.min(0.95, elev + (t.clientY - py) * 0.006));
    px = t.clientX;
    py = t.clientY;
    idle = 0;
  }
  function onUp(e: MouseEvent | TouchEvent) {
    const t = releasePoint(e);
    dragging = false;
    canvas.style.cursor = "grab";
    if (!pointerMoved && t) {
      activateMarkerAt(t.clientX, t.clientY);
    }
  }
  function onMouseMove(e: MouseEvent) {
    if (dragging) return;
    const hit = findMarker(e.clientX, e.clientY);
    canvas.style.cursor = hit ? "pointer" : "grab";
    callbacks.onHoverChange(hit ? hoverPayload(hit, e.clientX, e.clientY) : null);
  }
  function onMouseLeave() {
    callbacks.onHoverChange(null);
    if (!dragging) canvas.style.cursor = "grab";
  }
  function onWheel(e: WheelEvent) {
    e.preventDefault();
    const range = FOCUS_RANGES[focus];
    dist = Math.max(range.min, Math.min(range.max, dist + e.deltaY * 0.005));
    distGoal = null;
    idle = 0;
  }
  function onDblClick(e: MouseEvent) {
    if (findMarker(e.clientX, e.clientY)) return;
    const r = canvas.getBoundingClientRect();
    ndc.set(
      ((e.clientX - r.left) / r.width) * 2 - 1,
      -((e.clientY - r.top) / r.height) * 2 + 1,
    );
    raycaster.setFromCamera(ndc, camera);
    const hit = raycaster.intersectObjects([earth, moon], false)[0];
    if (!hit) return;
    const next: SceneFocus = hit.object === moon ? "moon" : "earth";
    if (next !== focus) focusScene(next);
  }
  canvas.addEventListener("dblclick", onDblClick);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  canvas.addEventListener("touchstart", onDown, { passive: true });
  canvas.addEventListener("touchmove", onMove, { passive: true });
  canvas.addEventListener("touchend", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.style.cursor = "grab";

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  const reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  let raf = 0;
  let t0 = performance.now();
  let running = true;
  function frame(now: number) {
    if (!running) return;
    const dt = Math.min(0.05, (now - t0) / 1000);
    t0 = now;
    idle += dt;
    if (!reducedMotion && !paused) {
      const simulatedDt = dt * simulationSpeed;
      if (!dragging && idle > 1.4) azim -= dt * 0.04;
      earth.rotation.y += simulatedDt * 0.05;
      clouds.rotation.y += simulatedDt * 0.062;
      if (missionPhase === "outbound") {
        moonAngle += simulatedDt * MOON_SIMULATION_RATE;
        missionProgress += simulatedDt * TRANSFER_SIMULATION_RATE;
        if (missionProgress >= 1) {
          missionProgress = 1;
          moonAngle = transferArrivalAngle;
          placeMoon();
          updateOutboundTransfer(1);
          enterLunarOrbit();
        } else {
          placeMoon();
          updateOutboundTransfer(missionProgress);
        }
      } else if (missionPhase === "lunar-orbit") {
        moonAngle += simulatedDt * LUNAR_MOON_SIMULATION_RATE;
        missionProgress += simulatedDt * LUNAR_ORBIT_SIMULATION_RATE;
        if (missionProgress >= 1) {
          missionProgress = 1;
          placeMoon();
          updateLunarOrbit(1);
          enterReturnTransfer();
        } else {
          placeMoon();
          updateLunarOrbit(missionProgress);
        }
      } else {
        moonAngle += simulatedDt * MOON_SIMULATION_RATE;
        missionProgress += simulatedDt * TRANSFER_SIMULATION_RATE;
        if (missionProgress >= 1) {
          missionProgress = 1;
          placeMoon();
          updateReturnTransfer(1);
          restartMissionCycle();
        } else {
          placeMoon();
          updateReturnTransfer(missionProgress);
        }
      }
      markerEntries.forEach((entry, i) => {
        const base = entry.body === "moon" ? 0.72 : 1;
        entry.ring.scale.setScalar(base * (1 + Math.sin(now * 0.003 + i) * 0.18));
      });
    }
    // Ease the camera target onto the focused body (the Moon keeps moving,
    // so the target tracks it every frame once captured).
    if (focus === "moon") {
      moon.getWorldPosition(focusPoint);
    } else if (focus === "system") {
      moon.getWorldPosition(focusPoint).multiplyScalar(0.34);
    } else {
      focusPoint.set(0, 0, 0);
    }
    target.lerp(focusPoint, reducedMotion ? 1 : 1 - Math.exp(-dt * 4));
    if (distGoal !== null) {
      dist += (distGoal - dist) * (reducedMotion ? 1 : 1 - Math.exp(-dt * 3));
      if (Math.abs(distGoal - dist) < 0.01) distGoal = null;
    }
    const ease = reducedMotion ? 1 : 1 - Math.exp(-dt * 3);
    if (azimGoal !== null) {
      // Shortest-path easing: azim is unbounded after free dragging.
      const delta =
        THREE.MathUtils.euclideanModulo(azimGoal - azim + Math.PI, Math.PI * 2) -
        Math.PI;
      azim += delta * ease;
      if (Math.abs(delta) < 0.01) azimGoal = null;
    }
    if (elevGoal !== null) {
      elev += (elevGoal - elev) * ease;
      if (Math.abs(elevGoal - elev) < 0.01) elevGoal = null;
    }
    applyCam();

    if (now - lastTelemetryUpdate > 350) {
      const distanceKm = Math.round(
        (moon.position.length() / ORBIT_SEMI_MAJOR) * 384_400,
      );
      let phaseLabel = "TLI coast";
      let phaseDetail = "Moon intercept";
      let displayedProgress = missionProgress;
      if (missionPhase === "lunar-orbit") {
        const completedOrbitFraction = missionProgress * LUNAR_ORBIT_COUNT;
        const orbitNumber = Math.min(
          LUNAR_ORBIT_COUNT,
          Math.floor(completedOrbitFraction) + 1,
        );
        phaseLabel = `Lunar orbit ${orbitNumber}/${LUNAR_ORBIT_COUNT}`;
        phaseDetail = orbitNumber === 1 ? "LOI captured" : "TEI setup";
        displayedProgress = completedOrbitFraction % 1;
      } else if (missionPhase === "return") {
        phaseLabel = "TEI return";
        phaseDetail = "Earth entry corridor";
      }
      callbacks.onTelemetryChange({
        distanceKm,
        lightDelaySeconds: distanceKm / 299_792,
        phasePercent: Math.round(((1 - Math.cos(moonAngle)) / 2) * 100),
        missionPhase: phaseLabel,
        missionPercent: Math.round(displayedProgress * 100),
        missionDetail: phaseDetail,
      });
      lastTelemetryUpdate = now;
    }
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  resize();
  applyCam();
  raf = requestAnimationFrame(frame);

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // Introspection hook for automated tests: current focus plus each body's
  // projected screen position (fractions of the canvas size).
  const debugApi: TrackspaceCanvas["__trackspace"] = {
    get focus() {
      return focus;
    },
    get missionPhase() {
      return missionPhase;
    },
    earthScreen: () => toScreen(new THREE.Vector3(0, 0, 0)),
    moonScreen: () => toScreen(moon.getWorldPosition(new THREE.Vector3())),
    locationScreens: () =>
      markerEntries.map((entry) => {
        entry.root.getWorldPosition(markerWorld);
        return {
          id: entry.location.id,
          ...toScreen(markerWorld),
          visible: markerFacesCamera(entry),
        };
      }),
  };
  (canvas as TrackspaceCanvas).__trackspace = debugApi;

  const controller: SceneController = {
    setFocus: focusScene,
    setPaused(nextPaused) {
      paused = nextPaused;
    },
    setSpeed(nextSpeed) {
      simulationSpeed = nextSpeed;
    },
    setLayer(layer, visible) {
      if (layer === "sites") {
        for (const entry of markerEntries) entry.root.visible = visible;
        if (!visible) callbacks.onHoverChange(null);
      } else if (layer === "trajectory") {
        trajectoryPathsGroup.visible = visible;
      } else {
        maneuverNodesGroup.visible = visible;
      }
    },
    resetView() {
      focusScene("system");
      distGoal = FOCUS_RANGES.system.dist;
      callbacks.onHoverChange(null);
    },
    destroy() {
      delete (canvas as TrackspaceCanvas).__trackspace;
      callbacks.onHoverChange(null);
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onDown);
      canvas.removeEventListener("touchmove", onMove);
      canvas.removeEventListener("touchend", onUp);
      canvas.removeEventListener("wheel", onWheel);
      for (const d of disposables) d.dispose();
      renderer.dispose();
    },
  };
  return controller;
}

type EarthMoonSceneProps = {
  locations: readonly Location[];
  onLocationOpen: (id: string) => void;
};

export function EarthMoonScene({
  locations,
  onLocationOpen,
}: EarthMoonSceneProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const openRef = useRef(onLocationOpen);
  const [hover, setHover] = useState<SceneHover | null>(null);
  const [focus, setFocus] = useState<SceneFocus>("system");
  const [paused, setPaused] = useState(false);
  const [speed, setSpeed] = useState<SimulationSpeed>(1);
  const [layers, setLayers] = useState<Record<SceneLayer, boolean>>({
    sites: true,
    trajectory: true,
    maneuvers: true,
  });
  const [telemetry, setTelemetry] =
    useState<SceneTelemetry>(INITIAL_TELEMETRY);

  useEffect(() => {
    openRef.current = onLocationOpen;
  }, [onLocationOpen]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scene = createEarthMoonScene(canvas, locations, {
      onLocationOpen: (id) => openRef.current(id),
      onHoverChange: setHover,
      onFocusChange: setFocus,
      onTelemetryChange: setTelemetry,
    });
    controllerRef.current = scene;
    return () => {
      controllerRef.current = null;
      scene.destroy();
    };
  }, [locations]);

  const selectFocus = (nextFocus: SceneFocus) => {
    setFocus(nextFocus);
    controllerRef.current?.setFocus(nextFocus);
  };

  const togglePaused = () => {
    const nextPaused = !paused;
    setPaused(nextPaused);
    controllerRef.current?.setPaused(nextPaused);
  };

  const selectSpeed = (nextSpeed: SimulationSpeed) => {
    setSpeed(nextSpeed);
    setPaused(false);
    controllerRef.current?.setPaused(false);
    controllerRef.current?.setSpeed(nextSpeed);
  };

  const toggleLayer = (layer: SceneLayer) => {
    const visible = !layers[layer];
    setLayers((current) => ({ ...current, [layer]: visible }));
    controllerRef.current?.setLayer(layer, visible);
  };

  const resetView = () => {
    setFocus("system");
    controllerRef.current?.resetView();
  };

  const phaseLabel =
    telemetry.phasePercent < 10
      ? "New"
      : telemetry.phasePercent < 45
        ? "Crescent"
        : telemetry.phasePercent < 60
          ? "Quarter"
          : telemetry.phasePercent < 90
            ? "Gibbous"
            : "Full";

  return (
    <>
      <canvas
        ref={ref}
        className="trackspace-scene-canvas"
        aria-label="Interactive Earth and Moon orbit view with source-backed locations"
      />
      <div className="trackspace-scene-solar-glow" aria-hidden="true" />
      <div className="trackspace-scene-vignette" aria-hidden="true" />
      <div className="trackspace-scene-scanline" aria-hidden="true" />

      <div className="trackspace-scene-identity" aria-hidden="true">
        <span>Cislunar digital twin</span>
        <b>EARTH—MOON / LIVE</b>
        <i>Sun vector · nominal</i>
      </div>

      <div className="trackspace-scene-viewbar" aria-label="Scene focus">
        {SCENE_FOCUS_OPTIONS.map((view) => (
          <button
            type="button"
            className={focus === view ? "is-active" : undefined}
            aria-pressed={focus === view}
            key={view}
            onClick={() => selectFocus(view)}
          >
            <span aria-hidden="true" />
            {view}
          </button>
        ))}
        <button
          type="button"
          className="trackspace-scene-reset"
          onClick={resetView}
          aria-label="Reset scene view"
          title="Reset view"
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M3.2 6.2A5.1 5.1 0 1 1 3 10.4" />
            <path d="M3.2 2.8v3.5h3.5" />
          </svg>
        </button>
      </div>

      <div className="trackspace-scene-telemetry" aria-label="Orbital telemetry">
        <div>
          <span>Range</span>
          <b>{telemetry.distanceKm.toLocaleString("en-US")}</b>
          <i>km</i>
        </div>
        <div>
          <span>Signal</span>
          <b>{telemetry.lightDelaySeconds.toFixed(2)}</b>
          <i>sec one-way</i>
        </div>
        <div>
          <span>Phase</span>
          <b>{telemetry.phasePercent}</b>
          <i>% · {phaseLabel}</i>
        </div>
        <div>
          <span>{telemetry.missionPhase}</span>
          <b>{telemetry.missionPercent}</b>
          <i>% · {telemetry.missionDetail}</i>
        </div>
      </div>

      <div className="trackspace-scene-dock" aria-label="Scene controls">
        <div className="trackspace-scene-dock-group trackspace-scene-layers">
          <span>Layers</span>
          <button
            type="button"
            className={layers.sites ? "is-active" : undefined}
            aria-pressed={layers.sites}
            onClick={() => toggleLayer("sites")}
          >
            <i className="trackspace-scene-layer-dot" aria-hidden="true" />
            Sites
          </button>
          <button
            type="button"
            className={layers.trajectory ? "is-active" : undefined}
            aria-pressed={layers.trajectory}
            onClick={() => toggleLayer("trajectory")}
          >
            <i className="trackspace-scene-layer-line" aria-hidden="true" />
            Trajectory
          </button>
          <button
            type="button"
            className={layers.maneuvers ? "is-active" : undefined}
            aria-pressed={layers.maneuvers}
            onClick={() => toggleLayer("maneuvers")}
          >
            <i className="trackspace-scene-layer-node" aria-hidden="true" />
            Nodes
          </button>
        </div>
        <div className="trackspace-scene-dock-divider" />
        <div className="trackspace-scene-dock-group trackspace-scene-time">
          <span>Simulation</span>
          <button
            type="button"
            className="trackspace-scene-play"
            onClick={togglePaused}
            aria-label={paused ? "Resume orbital simulation" : "Pause orbital simulation"}
            aria-pressed={paused}
          >
            {paused ? "▶" : "Ⅱ"}
          </button>
          {SIMULATION_SPEED_OPTIONS.map((nextSpeed) => (
            <button
              type="button"
              className={speed === nextSpeed && !paused ? "is-active" : undefined}
              aria-pressed={speed === nextSpeed && !paused}
              key={nextSpeed}
              onClick={() => selectSpeed(nextSpeed)}
            >
              {nextSpeed}×
            </button>
          ))}
        </div>
      </div>

      {hover && (
        <div
          className={`trackspace-scene-tooltip trackspace-scene-tooltip-${hover.status}`}
          style={{ left: hover.x, top: hover.y }}
        >
          <span>{LOCATION_KIND_LABEL[hover.kind]}</span>
          <b>{hover.name}</b>
          <i>{hover.body.toUpperCase()}</i>
        </div>
      )}
    </>
  );
}
