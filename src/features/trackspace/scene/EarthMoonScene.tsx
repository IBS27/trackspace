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

import type { Location, LocationKind, SpatialBody, Status } from "../data/types";

const ACCENT = "#5bd0ff";

const EARTH_RADIUS = 1.5;
const EARTH_TILT = 0.41; // 23.4°
const MOON_RADIUS = EARTH_RADIUS * 0.273;
const ORBIT_SEMI_MAJOR = 4.7;
const ORBIT_ECCENTRICITY = 0.055;
const ORBIT_INCLINATION = 0.09; // 5.1°
const ORBIT_SEMI_MINOR =
  ORBIT_SEMI_MAJOR * Math.sqrt(1 - ORBIT_ECCENTRICITY * ORBIT_ECCENTRICITY);
const ORBIT_FOCUS_OFFSET = ORBIT_SEMI_MAJOR * ORBIT_ECCENTRICITY;
const MARKER_DOT_RADIUS = 0.022;
const MARKER_RING_INNER_RADIUS = 0.046;
const MARKER_RING_OUTER_RADIUS = 0.064;
const MARKER_HIT_RADIUS_PX = 36;

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
    readonly focus: "earth" | "moon";
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
  const accent = new THREE.Color(ACCENT);
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
  function placeMoon() {
    moon.position.set(
      Math.cos(moonAngle) * ORBIT_SEMI_MAJOR - ORBIT_FOCUS_OFFSET,
      0,
      -Math.sin(moonAngle) * ORBIT_SEMI_MINOR,
    );
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

  // Orbit path (faint HUD line matching the actual ellipse).
  {
    const seg = 256;
    const pos: number[] = [];
    for (let i = 0; i <= seg; i++) {
      const a = (i / seg) * Math.PI * 2;
      pos.push(
        Math.cos(a) * ORBIT_SEMI_MAJOR - ORBIT_FOCUS_OFFSET,
        0,
        -Math.sin(a) * ORBIT_SEMI_MINOR,
      );
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.LineBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.16,
    });
    orbitPlane.add(new THREE.Line(g, m));
    disposables.push(g, m);
  }

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
  for (const layer of [
    { count: 1300, size: 1.7, opacity: 0.55 },
    { count: 320, size: 2.6, opacity: 0.85 },
    { count: 60, size: 4.2, opacity: 1 },
  ]) {
    const pos = new Float32Array(layer.count * 3);
    const col = new Float32Array(layer.count * 3);
    const tint = new THREE.Color();
    for (let i = 0; i < layer.count; i++) {
      const r = 60 + Math.random() * 60;
      const t = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(t);
      pos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(t);
      pos[i * 3 + 2] = r * Math.cos(ph);
      // Mostly white, a few leaning blue or warm.
      tint.setHSL(
        Math.random() < 0.5 ? 0.6 : 0.09,
        Math.random() * 0.25,
        0.8 + Math.random() * 0.2,
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
  let dist = 8.2;
  let dragging = false;
  let px = 0;
  let py = 0;
  let downX = 0;
  let downY = 0;
  let pointerMoved = false;
  let idle = 0;

  // The camera orbits and zooms around the focused body. Double-clicking a
  // body re-centers on it; the target glides over and then follows it.
  const FOCUS_RANGES = {
    earth: { min: 4.6, max: 16, dist: 8.2 },
    moon: { min: 1.3, max: 16, dist: 3.4 },
  };
  let focus: keyof typeof FOCUS_RANGES = "earth";
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
    const next = hit.object === moon ? "moon" : "earth";
    if (next !== focus) {
      focus = next;
      distGoal = FOCUS_RANGES[next].dist;
      if (next === "moon") {
        // Swing the camera to the far side of the Moon so Earth stays in
        // frame behind it — otherwise there is nothing to double-click to
        // switch back.
        const d = moon.getWorldPosition(new THREE.Vector3()).normalize();
        azimGoal = Math.atan2(d.x, d.z) + 0.5;
        elevGoal = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1)) + 0.12;
      }
      idle = 0;
    }
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
    if (!reducedMotion) {
      if (!dragging && idle > 1.4) azim -= dt * 0.04;
      earth.rotation.y += dt * 0.05;
      clouds.rotation.y += dt * 0.062;
      moonAngle += dt * 0.012;
      placeMoon();
      markerEntries.forEach((entry, i) => {
        const base = entry.body === "moon" ? 0.72 : 1;
        entry.ring.scale.setScalar(base * (1 + Math.sin(now * 0.003 + i) * 0.18));
      });
    }
    // Ease the camera target onto the focused body (the Moon keeps moving,
    // so the target tracks it every frame once captured).
    if (focus === "moon") moon.getWorldPosition(focusPoint);
    else focusPoint.set(0, 0, 0);
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

  return {
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
  const openRef = useRef(onLocationOpen);
  const [hover, setHover] = useState<SceneHover | null>(null);

  useEffect(() => {
    openRef.current = onLocationOpen;
  }, [onLocationOpen]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scene = createEarthMoonScene(canvas, locations, {
      onLocationOpen: (id) => openRef.current(id),
      onHoverChange: setHover,
    });
    return () => scene.destroy();
  }, [locations]);

  return (
    <>
      <canvas
        ref={ref}
        className="trackspace-scene-canvas"
        aria-label="Interactive Earth and Moon orbit view with source-backed locations"
      />
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
