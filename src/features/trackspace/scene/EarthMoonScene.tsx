"use client";

// Earth/Moon scene for the Command Center stage.
//
// Renders NASA imagery (bundled under public/textures/, all public domain):
// day/night Earth with city lights on the dark side, a drifting cloud layer,
// and the real lunar surface. The Moon runs an inclined elliptical orbit with
// Earth at the focus and stays tidally locked. Sizes are to scale (Moon ≈ 0.27
// Earth radii); the orbital distance is compressed so both bodies stay in frame.
//
// Texture provenance:
//   earth_day_*.webp     Blue Marble Next Generation, July 2004 (NASA Visible
//                        Earth #73751), resampled to 4096x2048 and 1024x512.
//   earth_lights_*.webp  Black Marble / Earth at Night 2012 (NASA Visible Earth
//                        #79765). Ships a blue land/ocean/ice base under the
//                        lights; the lights shader isolates cities by chroma.
//   earth_clouds/normal/specular, moon  three.js examples (NASA-derived).

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import * as THREE from "three";
import { Line2 } from "three/addons/lines/Line2.js";
import { LineGeometry } from "three/addons/lines/LineGeometry.js";
import { LineMaterial } from "three/addons/lines/LineMaterial.js";

import type { Location, LocationKind, SpatialBody, Status } from "../data/types";
import { createOrionSpacecraft } from "./OrionSpacecraft";

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

// A single clock drives Earth's spin, the Moon's orbit, and the mission
// timeline, so the T+ readout, the terminator, and the transfer geometry all
// describe the same instant instead of running on three unrelated rates.
// Master pacing knob. Everything else is derived from it, so changing this
// scales Earth's spin, the Moon's orbit, and the mission timeline together
// without breaking their ratios. A full outbound/lunar/return cycle takes
// (3 + 2.5 + 3) days x this, so ~3m24s at 1x.
const SIM_DAYS_PER_REAL_SECOND = 1 / 24; // one Earth rotation per 24s at 1x
const MOON_PERIOD_DAYS = 27.322;
// Real cloud motion relative to the surface is a few percent — jet-stream
// winds against a 1670 km/h equatorial rotation. A larger lead reads as the
// whole planet whirling rather than as weather.
const CLOUD_DRIFT_RATIO = 1.06;
// Apollo 11's profile: ~3 days TLI to LOI, ~2.5 days in lunar orbit, ~3 days
// home. Earth turns once per mission day, so these durations are also what
// sets how many rotations you watch during a leg — keep them honest.
const MISSION_OUTBOUND_DAYS = 3;
const MISSION_LUNAR_ORBIT_DAYS = 2.5;
const MISSION_RETURN_DAYS = 3;
// Real mean range is ~60.3 Earth radii; the scene squeezes it so both bodies
// stay in frame. Surfaced in the identity block so the view isn't read literally.
const RANGE_COMPRESSION = Math.round((60.3 * EARTH_RADIUS) / ORBIT_SEMI_MAJOR);

type SceneFocus = "system" | "earth" | "moon" | "orion";
type SceneLayer = "sites" | "trajectory" | "maneuvers";
type SimulationSpeed = 1 | 8 | 32;
type MissionPhase = "outbound" | "lunar-orbit" | "return";

const SCENE_FOCUS_OPTIONS = ["system", "earth", "moon", "orion"] as const;
const SIMULATION_SPEED_OPTIONS = [1, 8, 32] as const;

const MISSION_PHASE_LABEL: Record<MissionPhase, string> = {
  outbound: "Translunar coast",
  "lunar-orbit": "Lunar orbit",
  return: "Earth return",
};

function formatMissionClock(days: number): string {
  const total = Math.max(0, days);
  const wholeDays = Math.floor(total);
  const hours = Math.floor((total - wholeDays) * 24);
  return `T+ ${String(wholeDays).padStart(2, "0")}d ${String(hours).padStart(2, "0")}h`;
}

const STATUS_COLORS: Record<Status, string> = {
  ready: "#8df0ad",
  watch: "#ffd166",
  blocker: "#ff5468",
  unknown: "#9a9aa4",
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
    orionScreen: () => { x: number; y: number };
    locationScreens: () => Array<{
      id: string;
      x: number;
      y: number;
      visible: boolean;
    }>;
  };
};

type SceneTelemetry = {
  phase: MissionPhase;
  elapsedDays: number;
};

type SceneCallbacks = {
  onLocationOpen: (id: string) => void;
  onHoverChange: (hover: SceneHover | null) => void;
  onFocusChange: (focus: SceneFocus) => void;
  onTelemetry: (telemetry: SceneTelemetry) => void;
  onContextLost: () => void;
};

type SceneController = {
  destroy: () => void;
  setFocus: (focus: SceneFocus) => void;
  setPaused: (paused: boolean) => void;
  setSpeed: (speed: SimulationSpeed) => void;
  setLayer: (layer: SceneLayer, visible: boolean) => void;
  setLocations: (locations: readonly Location[]) => void;
  setHighlight: (id: string | null) => void;
  /** Keyboard camera control: relative azimuth/elevation/zoom nudge. */
  nudgeCamera: (dAzim: number, dElev: number, dDist: number) => void;
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
  callbacks: SceneCallbacks,
) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    alpha: true,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  // Earth casts onto the Moon and Orion; Orion goes dark behind the Moon.
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  // Antialiasing plus a full-screen additive sun sprite makes this heavily
  // fill-bound, so back off device pixel ratio once the canvas gets large.
  const LARGE_CANVAS_PIXELS = 1_500_000;
  function pixelRatioFor(width: number, height: number) {
    const dpr = window.devicePixelRatio || 1;
    return Math.min(dpr, width * height > LARGE_CANVAS_PIXELS ? 1.5 : 2);
  }
  renderer.setPixelRatio(pixelRatioFor(canvas.clientWidth, canvas.clientHeight));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 200);
  const target = new THREE.Vector3(0, 0, 0);
  const disposables: { dispose(): void }[] = [];
  // Guards async work that outlives the scene (background texture upgrades).
  let disposed = false;
  const lineMaterials: LineMaterial[] = [];
  const lineResolution = new THREE.Vector2();
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  // Fade the canvas in once every plate has decoded — otherwise Earth renders
  // as an untextured white ball for the first few frames.
  canvas.style.opacity = "0";
  canvas.style.transition = "opacity 420ms ease";
  let revealed = false;
  const reveal = () => {
    if (revealed) return;
    revealed = true;
    canvas.style.opacity = "1";
  };
  const loadingManager = new THREE.LoadingManager(reveal, undefined, reveal);
  // Safety net: a stalled request must not leave the stage permanently blank.
  const revealTimer = window.setTimeout(reveal, 4000);

  const loader = new THREE.TextureLoader(loadingManager);
  const loadColor = (url: string) => {
    const tex = loader.load(url);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = maxAnisotropy;
    disposables.push(tex);
    return tex;
  };
  const loadData = (url: string) => {
    const tex = loader.load(url);
    tex.anisotropy = maxAnisotropy;
    disposables.push(tex);
    return tex;
  };

  // Earth's day and night plates ship at 1024 for an immediate first paint and
  // are upgraded to 4096 in the background. Both sizes are derived from the same
  // NASA source, so the swap is a pure sharpen with no colour or feature shift.
  // The upgrade loader deliberately sits outside the LoadingManager: the reveal
  // fade must not wait on a megabyte of imagery.
  const upgradeLoader = new THREE.TextureLoader();
  type NetworkInformation = { saveData?: boolean; effectiveType?: string };
  const connection = (
    navigator as Navigator & { connection?: NetworkInformation }
  ).connection;
  // On a metered or slow link the 1024 plate is a complete, correct scene.
  const wantsHighResPlates =
    connection?.saveData !== true &&
    connection?.effectiveType !== "2g" &&
    connection?.effectiveType !== "slow-2g";

  function upgradePlate(
    url: string,
    replaced: THREE.Texture,
    apply: (texture: THREE.Texture) => void,
  ) {
    if (!wantsHighResPlates) return;
    upgradeLoader.load(
      url,
      (texture) => {
        // The scene may have been torn down while the plate was in flight.
        if (disposed) {
          texture.dispose();
          return;
        }
        texture.colorSpace = THREE.SRGBColorSpace;
        texture.anisotropy = maxAnisotropy;
        disposables.push(texture);
        apply(texture);
        replaced.dispose();
      },
      undefined,
      // A failed upgrade leaves the 1024 plate in place, not a broken scene.
      () => {},
    );
  }

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
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    const haloMaterial = new LineMaterial({
      color: usesGradient ? 0xffffff : color,
      linewidth: haloWidth,
      vertexColors: usesGradient,
      transparent: false,
      opacity: 1,
      depthTest: true,
      depthWrite: false,
      toneMapped: false,
    });
    lineMaterials.push(coreMaterial, haloMaterial);
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
    ctx.fillStyle = "rgba(3, 3, 4, 0.9)";
    ctx.fillRect(12, 12, 488, 94);
    ctx.strokeStyle = "rgba(150, 150, 160, 0.42)";
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, 488, 94);
    ctx.fillStyle = color;
    ctx.fillRect(12, 12, 5, 94);
    ctx.font = "600 34px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#f1f1f4";
    ctx.textBaseline = "top";
    ctx.fillText(code, 34, 26);
    ctx.font = "500 18px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillStyle = "#91919a";
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
  // Ortho frustum wide enough for the Moon at apoapsis, tight enough that a
  // 2048 map still resolves Orion (~0.1 units) against the lunar limb.
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -9.5;
  sun.shadow.camera.right = 9.5;
  sun.shadow.camera.top = 9.5;
  sun.shadow.camera.bottom = -9.5;
  sun.shadow.camera.near = 38;
  sun.shadow.camera.far = 64;
  // normalBias keeps spheres from self-shadowing into stripes near the terminator.
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.02;
  scene.add(sun);
  // Faint cool fill so the night side reads as a silhouette, not a hole.
  scene.add(new THREE.AmbientLight(0x33415c, 0.16 * Math.PI));

  // The visible Sun, styled after real ISS photography: a blinding white
  // core with no discernible photosphere edge, a neutral-white glare
  // falloff, and thin aperture-diffraction spikes of alternating lengths.
  // It sits far along the same sunDir that lights the terminators so the
  // glare always agrees with the lit hemispheres. Pure scenery: nothing
  // raycasts it, and per-pixel depth testing lets Earth and Moon occlude
  // the core while the glare peeks around their limbs. Pixels are computed
  // directly because Chrome dithers low-alpha canvas gradients into
  // visible banding.
  const SUN_DISTANCE = 105;
  const SUN_SPRITE_SCALE = 48;
  const sunTexture = (() => {
    // 512 is enough for the sprite's soft falloff; the per-pixel loop runs
    // once on the main thread at init, so keep it cheap.
    const size = 512;
    const cv = document.createElement("canvas");
    cv.width = cv.height = size;
    const ctx = cv.getContext("2d")!;
    const image = ctx.createImageData(size, size);
    const half = SUN_SPRITE_SCALE / 2;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = ((x + 0.5) / size) * 2 - 1;
        const dy = ((y + 0.5) / size) * 2 - 1;
        // Radius in world units so the falloff shape survives scale changes.
        const r = Math.hypot(dx, dy) * half;
        const theta = Math.atan2(dy, dx);
        // Saturated core plus hot glare — the glare alone stays above full
        // white past the core edge, so the blowout is seamless (no visible
        // disc rim), like an overexposed sensor.
        const core = 1 - THREE.MathUtils.smoothstep(r, 1.3, 2);
        const glare = 2.4 * Math.exp(-r / 2.4);
        const halo = 0.32 * Math.exp(-r / 5.2);
        // Two interleaved spike sets (8 long + 16 short), lengths modulated
        // around the circle so the starburst reads organic, not geometric.
        const s8 = Math.pow(Math.abs(Math.cos(4 * theta)), 80);
        const s16 = Math.pow(Math.abs(Math.cos(8 * theta + Math.PI / 2)), 300);
        const rayMod = 0.7 + 0.3 * Math.cos(3 * theta + 1.7);
        const rays =
          (1.15 * s8 * Math.exp(-r / 4.5) + 0.9 * s16 * Math.exp(-r / 3)) *
          rayMod;
        // Fade to exactly zero before the sprite edge — no square seam.
        const window = 1 - THREE.MathUtils.smoothstep(r, half * 0.8, half);
        const t = (glare + halo + rays) * window;
        const i = (y * size + x) * 4;
        // Additive blend: brightness lives in RGB, black corners add nothing.
        image.data[i] = Math.min(255, 255 * (core + t));
        image.data[i + 1] = Math.min(255, 255 * (core * 0.99 + t * 0.985));
        image.data[i + 2] = Math.min(255, 255 * (core * 0.97 + t * 0.955));
        image.data[i + 3] = 255;
      }
    }
    ctx.putImageData(image, 0, 0);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    disposables.push(tex);
    return tex;
  })();
  const sunDiscMaterial = new THREE.SpriteMaterial({
    map: sunTexture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
    toneMapped: false,
  });
  const sunDisc = new THREE.Sprite(sunDiscMaterial);
  sunDisc.position.copy(sunDir).multiplyScalar(SUN_DISTANCE);
  sunDisc.scale.setScalar(SUN_SPRITE_SCALE);
  scene.add(sunDisc);
  disposables.push(sunDiscMaterial);

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

  const cloudTexture = loadColor("/textures/earth_clouds_1024.png");

  // Cloud shadows. A shadow-mapped cloud shell would need alphaTest, which
  // hard-edges the clouds themselves, so the surface samples the cloud plate
  // directly instead. The two shells spin at different rates, so the lookup is
  // offset by their relative rotation plus a small sunward lead.
  const cloudShadowUniforms = {
    tsCloudMap: { value: cloudTexture },
    tsCloudUvOffset: { value: 0 },
  };
  const CLOUD_SHADOW_STRENGTH = 0.45;
  const CLOUD_SHADOW_SUN_LEAD = 0.004;

  const dayTexture = loadColor("/textures/earth_day_1024.webp");

  const earthMat = new THREE.MeshPhongMaterial({
    map: dayTexture,
    specularMap: loadData("/textures/earth_specular_2048.jpg"),
    normalMap: loadData("/textures/earth_normal_2048.jpg"),
    normalScale: new THREE.Vector2(0.8, 0.8),
    specular: new THREE.Color(0x3a3f47),
    shininess: 18,
  });
  earthMat.onBeforeCompile = (shader) => {
    shader.uniforms.tsCloudMap = cloudShadowUniforms.tsCloudMap;
    shader.uniforms.tsCloudUvOffset = cloudShadowUniforms.tsCloudUvOffset;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "void main() {",
        `uniform sampler2D tsCloudMap;
         uniform float tsCloudUvOffset;
         void main() {`,
      )
      .replace(
        "#include <map_fragment>",
        `#include <map_fragment>
         float tsCloud = texture2D(
           tsCloudMap,
           vec2(fract(vMapUv.x + tsCloudUvOffset + ${CLOUD_SHADOW_SUN_LEAD.toFixed(4)}), vMapUv.y)
         ).a;
         diffuseColor.rgb *= 1.0 - ${CLOUD_SHADOW_STRENGTH.toFixed(3)} * tsCloud;`,
      );
  };
  // Distinct cache key so this variant doesn't collide with stock MeshPhong.
  earthMat.customProgramCacheKey = () => "trackspace-earth-cloudshadow";
  const earth = new THREE.Mesh(earthGeo, earthMat);
  earth.castShadow = true;
  earth.receiveShadow = true;
  earthGroup.add(earth);
  disposables.push(earthMat);

  upgradePlate("/textures/earth_day_4096.webp", dayTexture, (texture) => {
    earthMat.map = texture;
    earthMat.needsUpdate = true;
  });

  // City lights, masked to the night side of the terminator.
  const lightsTexture = loadColor("/textures/earth_lights_1024.webp");
  const lightsMat = new THREE.ShaderMaterial({
    uniforms: {
      lightsMap: { value: lightsTexture },
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
        vec3 plate = texture2D(lightsMap, vUv).rgb;
        // Black Marble ships a blue land/ocean/ice base beneath the lights.
        // Cities are the only warm signal on the plate, so chroma isolates them
        // cleanly — a brightness threshold would set Antarctica glowing instead.
        float glow = clamp((plate.r - plate.b) * 3.0, 0.0, 1.0);
        gl_FragColor = vec4(vec3(1.0, 0.88, 0.62) * glow * night * 1.6, 1.0);
      }`,
    blending: THREE.AdditiveBlending,
    transparent: true,
    depthWrite: false,
  });
  earth.add(new THREE.Mesh(earthGeo, lightsMat));
  disposables.push(lightsMat);

  upgradePlate("/textures/earth_lights_4096.webp", lightsTexture, (texture) => {
    lightsMat.uniforms.lightsMap.value = texture;
  });

  // Cloud layer, drifting slightly faster than the surface.
  const cloudGeo = new THREE.SphereGeometry(EARTH_RADIUS * 1.012, 96, 64);
  const cloudMat = new THREE.MeshLambertMaterial({
    map: cloudTexture,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const clouds = new THREE.Mesh(cloudGeo, cloudMat);
  earthGroup.add(clouds);
  disposables.push(cloudGeo, cloudMat);

  // Atmosphere rim: fresnel on a back-side shell, modulated by the sun term.
  // Without the sun term the halo rings the planet evenly, including the night
  // limb, which reads as a glass shell rather than scattered light.
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: {
      c: { value: new THREE.Color(0x6fb7ff) },
      nightColor: { value: new THREE.Color(0x27406b) },
      p: { value: 3.6 },
      s: { value: 0.65 },
      sunDir: { value: sunDir },
    },
    vertexShader: `
      varying vec3 vN;
      varying vec3 vWorldNormal;
      void main(){
        vN = normalize(normalMatrix * normal);
        vWorldNormal = normalize(mat3(modelMatrix) * normal);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 c;
      uniform vec3 nightColor;
      uniform float p;
      uniform float s;
      uniform vec3 sunDir;
      varying vec3 vN;
      varying vec3 vWorldNormal;
      void main(){
        float i = pow(max(s - dot(vN, vec3(0.0, 0.0, 1.0)), 0.0), p);
        float sunT = smoothstep(-0.35, 0.30, dot(normalize(vWorldNormal), sunDir));
        // Sunlit limb blazes; the night limb keeps only a faint airglow.
        gl_FragColor = vec4(
          mix(nightColor, c, sunT),
          clamp(i, 0.0, 1.0) * mix(0.08, 1.0, sunT)
        );
      }`,
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

  // Denser than Earth's mesh relative to its radius: the "moon" focus sits at
  // 1.15 units, close enough that a coarse limb would read as a polygon.
  const moonGeo = new THREE.SphereGeometry(MOON_RADIUS, 96, 64);
  const moonTexture = loadColor("/textures/moon_1024.jpg");
  const moonMat = new THREE.MeshStandardMaterial({
    map: moonTexture,
    // Lunar albedo tracks relief closely enough that the colour plate doubles
    // as a bump map — craters catch the terminator instead of reading flat.
    bumpMap: moonTexture,
    bumpScale: 0.6,
    roughness: 1,
    metalness: 0,
  });
  const moon = new THREE.Mesh(moonGeo, moonMat);
  moon.castShadow = true;
  moon.receiveShadow = true;
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
  let sitesVisible = true;
  let highlightId: string | null = null;
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

  // Markers are swapped in place rather than by rebuilding the scene, so a new
  // Dataset array identity from Convex no longer costs a full texture reload.
  function setLocations(next: readonly Location[]) {
    for (const entry of markerEntries) {
      entry.root.removeFromParent();
      entry.root.clear();
    }
    markerEntries.length = 0;
    for (const location of next) {
      if (location.body === "earth") {
        addLocationMarker(location, "earth", earth, EARTH_RADIUS);
      } else if (location.body === "moon") {
        addLocationMarker(location, "moon", moon, MOON_RADIUS);
      }
    }
    for (const entry of markerEntries) entry.root.visible = sitesVisible;
    if (highlightId && !markerEntries.some((e) => e.location.id === highlightId)) {
      highlightId = null;
    }
    callbacks.onHoverChange(null);
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
  disposables.push(orbitalGrid.geometry);

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
  // Conceptual Apollo-style profile (patched conic):
  //   1. Surface launch → gravity-turn ascent into TLI
  //   2. TLI at perigee → Earth-focus Kepler ellipse (always outside Earth)
  //   3. Small leading-edge aim bias; Moon advances ~40° during coast
  //   4. LOI at apoapsis on the Moon's far side → lunar orbit
  //   5. TEI from the far side → Earth-focus return ellipse → splashdown
  const trajectoryGroup = new THREE.Group();
  orbitPlane.add(trajectoryGroup);
  const trajectoryPathsGroup = new THREE.Group();
  const maneuverNodesGroup = new THREE.Group();
  trajectoryGroup.add(trajectoryPathsGroup, maneuverNodesGroup);

  // Insertion altitude after the surface launch ascent.
  // Keep perigee modest so the Earth-side tip reads as a flat graze, not a spike.
  const parkingRadius = EARTH_RADIUS * 1.34;
  // Slightly lofted lunar capture so the ring clears the Moon cleanly.
  const captureRadius = MOON_RADIUS * 1.55;
  // Just above the Earth mesh so launch/splashdown sit on the surface.
  const SURFACE_RADIUS = EARTH_RADIUS * 1.004;
  // Transfers stay in the Moon's orbital plane (no artificial out-of-plane tilt).
  const LEADING_EDGE_AIM = THREE.MathUtils.degToRad(2);
  // Mild transverse squash — heavy flatten pinches apoapsis/perigee into points.
  const TRANSFER_FLATTEN = 0.9;
  // Gravity-turn arc from the surface up to TLI.
  const LAUNCH_ASCENT_ANGLE = THREE.MathUtils.degToRad(72);
  // Hide near-side chords that project across Earth's face.
  const SILHOUETTE_EARTH_RADIUS = EARTH_RADIUS * 1.12;
  // Polyline curve — CatmullRom overshoots and pulls arcs inside Earth.
  //
  // getPointAt/getTangentAt are overridden to bypass Curve's arc-length
  // reparameterization. TubeGeometry samples through getPointAt, so without
  // this a tube ring would land at an arc-length fraction rather than on the
  // source sample of the same index — and the per-sample visibility attribute
  // would be applied to the wrong rings on unevenly spaced paths (the launch
  // ascent packs 56 samples into a fraction of the coast's length). It also
  // skips building a 200-division length table on every rebuild.
  class PolylineCurve3 extends THREE.Curve<THREE.Vector3> {
    constructor(private readonly pts: THREE.Vector3[]) {
      super();
    }
    getPoint(t: number, optionalTarget = new THREE.Vector3()) {
      const pts = this.pts;
      if (pts.length === 0) return optionalTarget.set(0, 0, 0);
      if (pts.length === 1) return optionalTarget.copy(pts[0]);
      const scaled = THREE.MathUtils.clamp(t, 0, 1) * (pts.length - 1);
      const i = Math.min(Math.floor(scaled), pts.length - 2);
      return optionalTarget.copy(pts[i]).lerp(pts[i + 1], scaled - i);
    }
    getPointAt(u: number, optionalTarget = new THREE.Vector3()) {
      return this.getPoint(u, optionalTarget);
    }
    getTangentAt(u: number, optionalTarget = new THREE.Vector3()) {
      return this.getTangent(u, optionalTarget);
    }
  }
  // Transfer tubes depth-test against Earth (unlike Line2 screen-space strokes).
  //
  // The silhouette cull used to chop these into visible runs and rebuild a
  // TubeGeometry per run — which, with the camera drifting every frame, meant
  // reallocating ~2k-vertex buffers several times a second. Geometry is now
  // built once per mission plan and culled through a per-sample `aVisible`
  // attribute that the fragment shader discards on, so gaps cost one buffer
  // write instead of a rebuild (and a single tube can hold several runs).
  const TUBE_RADIAL_SEGMENTS = 6;
  type TubePath = {
    mesh: THREE.Mesh;
    material: THREE.MeshBasicMaterial;
    radius: number;
    visibility: THREE.BufferAttribute | null;
    sampleCount: number;
  };
  function createTubePath(
    color: THREE.ColorRepresentation,
    radius: number,
  ): TubePath {
    const material = new THREE.MeshBasicMaterial({
      color,
      depthTest: true,
      depthWrite: true,
      transparent: true,
      opacity: 0.92,
      toneMapped: false,
    });
    material.onBeforeCompile = (shader) => {
      shader.vertexShader = `attribute float aVisible;
        varying float vVisible;
        ${shader.vertexShader}`.replace(
        "void main() {",
        `void main() {
           vVisible = aVisible;`,
      );
      shader.fragmentShader = `varying float vVisible;
        ${shader.fragmentShader}`.replace(
        "void main() {",
        `void main() {
           if ( vVisible < 0.5 ) discard;`,
      );
    };
    material.customProgramCacheKey = () => "trackspace-tube-visibility";
    const mesh = new THREE.Mesh(new THREE.BufferGeometry(), material);
    mesh.frustumCulled = false;
    mesh.visible = false;
    // Geometry is swapped when the plan changes — dispose whichever is current.
    disposables.push(material, { dispose: () => mesh.geometry.dispose() });
    return { mesh, material, radius, visibility: null, sampleCount: 0 };
  }

  /** Rebuild tube geometry. Called on plan changes only, never per frame. */
  function setTubePathPoints(path: TubePath, points: readonly THREE.Vector3[]) {
    const safe =
      points.length > 1
        ? points.map((p) => p.clone())
        : [new THREE.Vector3(), new THREE.Vector3(0.001, 0, 0)];
    // One tubular segment per source sample, so sample index i maps exactly to
    // vertex ring i — that 1:1 mapping is what makes attribute culling work.
    const tubularSegments = safe.length - 1;
    const geometry = new THREE.TubeGeometry(
      new PolylineCurve3(safe),
      tubularSegments,
      path.radius,
      TUBE_RADIAL_SEGMENTS,
      false,
    );
    const vertexCount = (tubularSegments + 1) * (TUBE_RADIAL_SEGMENTS + 1);
    const visibility = new THREE.BufferAttribute(
      new Float32Array(vertexCount).fill(1),
      1,
    );
    visibility.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aVisible", visibility);
    path.mesh.geometry.dispose();
    path.mesh.geometry = geometry;
    path.visibility = visibility;
    path.sampleCount = safe.length;
  }

  /** Flag which samples draw. `keep(i)` is evaluated once per source sample. */
  function setTubePathVisibility(
    path: TubePath,
    keep: (index: number) => boolean,
  ) {
    const attribute = path.visibility;
    if (!attribute) return;
    const array = attribute.array as Float32Array;
    const stride = TUBE_RADIAL_SEGMENTS + 1;
    for (let i = 0; i < path.sampleCount; i++) {
      array.fill(keep(i) ? 1 : 0, i * stride, (i + 1) * stride);
    }
    attribute.needsUpdate = true;
  }

  // Shared world-space thickness for outbound, lunar capture, and return.
  const TRAJECTORY_TUBE_RADIUS = 0.012;
  const outboundTube = createTubePath(0x79d9ff, TRAJECTORY_TUBE_RADIUS);
  const returnTube = createTubePath(0xffb07a, TRAJECTORY_TUBE_RADIUS);
  trajectoryPathsGroup.add(outboundTube.mesh, returnTube.mesh);
  const orionSpacecraft = createOrionSpacecraft();
  const transferVehicle = orionSpacecraft.group;
  transferVehicle.traverse((object) => {
    if ((object as THREE.Mesh).isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  trajectoryPathsGroup.add(transferVehicle);
  const vehicleTangent = new THREE.Vector3();
  const vehicleUp = new THREE.Vector3();
  const vehicleRight = new THREE.Vector3();
  const vehicleBasis = new THREE.Matrix4();
  const captureBasis = new THREE.Matrix4();
  const captureY = new THREE.Vector3();
  const captureZ = new THREE.Vector3();

  // Shrinking lead arc: Moon travel remaining until the preplanned arrival.
  const moonLeadPath = createNavigationPath({
    color: 0x5bd0ff,
    coreWidth: 0.62,
    haloWidth: 2.8,
    coreBrightness: 0.16,
    haloBrightness: 0.025,
  });
  const leadArc = moonLeadPath.root;
  trajectoryPathsGroup.add(leadArc);
  // Rebuilt every frame, so the sample vectors are allocated once and mutated
  // in place rather than cloned (33 throwaway Vector3s per frame otherwise).
  const MOON_LEAD_SAMPLES = 32;
  const leadPoints = Array.from(
    { length: MOON_LEAD_SAMPLES + 1 },
    () => new THREE.Vector3(),
  );

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
  // Planned far-side perilune / LOI target in inertial space during coast.
  const periluneTarget = new THREE.Mesh(arrivalGeometry, arrivalMaterial);
  periluneTarget.rotation.x = -Math.PI / 2;
  maneuverNodesGroup.add(periluneTarget);

  // Capture orbit rides with the moving Moon after LOI.
  const captureGroup = new THREE.Group();
  trajectoryPathsGroup.add(captureGroup);
  const lunarNodesGroup = new THREE.Group();
  maneuverNodesGroup.add(lunarNodesGroup);
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
  const lunarCaptureTube = createTubePath(0xb8ecff, TRAJECTORY_TUBE_RADIUS);
  setTubePathPoints(lunarCaptureTube, capturePoints);
  // Never silhouette-culled — captureGroup.visible carries its phase gating.
  lunarCaptureTube.mesh.visible = true;
  captureGroup.add(lunarCaptureTube.mesh);

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

  // Mission nodes: TLI, far-side LOI, TEI, Earth entry interface.
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
  addNodeCore(periluneTarget, arrivalMaterial);
  addNodeCore(loiMarker, burnMaterial);
  addNodeCore(teiMarker, teiMaterial);
  addNodeCore(earthEntryTarget, entryMaterial);

  const tliLabel = createManeuverLabel("TLI", "Perigee departure burn", "#ffd58a");
  const periluneLabel = createManeuverLabel(
    "LOI",
    "Far-side perilune target",
    "#8fe6ff",
  );
  const loiLabel = createManeuverLabel("LOI", "Far-side capture burn", "#ffd58a");
  const teiLabel = createManeuverLabel("TEI", "Far-side Earth-return burn", "#ffbd79");
  const entryLabel = createManeuverLabel("SPLASHDOWN", "Ocean recovery", "#ff876f");
  maneuverNodesGroup.add(tliLabel, periluneLabel, entryLabel);
  lunarNodesGroup.add(loiLabel, teiLabel);

  // The labels draw with depthTest off so they never z-fight their own node
  // ring, which also meant "LOI" floated over Earth's disk while the burn it
  // annotates was behind the planet. Fade them against the occluders by hand.
  const maneuverLabels = [
    tliLabel,
    periluneLabel,
    loiLabel,
    teiLabel,
    entryLabel,
  ];
  const labelWorld = new THREE.Vector3();
  const moonWorld = new THREE.Vector3();
  const earthCenter = new THREE.Vector3();
  function updateLabelOcclusion(dt: number) {
    moon.getWorldPosition(moonWorld);
    const ease = 1 - Math.exp(-dt * 12);
    for (const label of maneuverLabels) {
      if (!label.visible) continue;
      label.getWorldPosition(labelWorld);
      const hidden =
        isSphereOccluded(
          labelWorld,
          camera.position,
          earthCenter,
          SILHOUETTE_EARTH_RADIUS,
        ) ||
        isSphereOccluded(
          labelWorld,
          camera.position,
          moonWorld,
          MOON_RADIUS * 1.06,
        );
      const material = label.material as THREE.SpriteMaterial;
      material.opacity += ((hidden ? 0 : 1) - material.opacity) * ease;
    }
  }

  disposables.push(
    orionSpacecraft,
    burnGeometry,
    burnMaterial,
    teiMaterial,
    entryGeometry,
    entryMaterial,
    arrivalGeometry,
    arrivalMaterial,
    nodeCoreGeometry,
  );

  // Rates are expressed per simulated day and converted once per frame, so the
  // Moon's angular rate, Earth's spin, and the T+ readout cannot drift apart.
  const MOON_RATE_PER_DAY = (Math.PI * 2) / MOON_PERIOD_DAYS;
  // The transfer is aimed where the Moon will actually be, so the lead angle is
  // whatever it travels during the outbound coast — not a hand-picked constant.
  const MOON_LEAD_ANGLE = MOON_RATE_PER_DAY * MISSION_OUTBOUND_DAYS;
  const LUNAR_ORBIT_COUNT = 2;

  const moonArrivalPos = new THREE.Vector3();
  const emAxis = new THREE.Vector3();
  const moonTangent = new THREE.Vector3();
  const perigeeDir = new THREE.Vector3();
  const perifocalQ = new THREE.Vector3();
  const perilunePos = new THREE.Vector3();
  const transferPoint = new THREE.Vector3();
  const lunarAxis = new THREE.Vector3();
  const lunarNormal = new THREE.Vector3();
  const lunarLocalPoint = new THREE.Vector3();
  const returnAxis = new THREE.Vector3();
  const returnNormal = new THREE.Vector3();
  const returnPoint = new THREE.Vector3();
  const pathScratch = new THREE.Vector3();
  let transferArrivalAngle = moonAngle + MOON_LEAD_ANGLE;
  let transferSemiMajor = 1;
  let transferEccentricity = 0.6;
  let returnSemiMajor = 1;
  let returnEccentricity = 0.6;
  let outboundPoints: THREE.Vector3[] = [];
  let outboundArcEnds: number[] = [];
  let outboundTotalLength = 1;
  let outboundTliIndex = 0;
  // Arc-length fractions of the two powered ends, so the Kepler-timed coast can
  // hand off to (and from) the launch and entry polylines at the right point.
  let outboundTliArcFraction = 0;
  let returnEntryIndex = 0;
  let returnEntryArcFraction = 1;
  // Launch ascent through early departure — protected from silhouette cull.
  let outboundLaunchProtectEnd = 0;
  let returnPoints: THREE.Vector3[] = [];
  let returnArcEnds: number[] = [];
  let returnTotalLength = 1;
  // Near-Earth return approach + splashdown (protected from silhouette cull).
  let returnSplashIndex = 0;
  let missionPhase: MissionPhase = "outbound";
  let missionProgress = 0.12;
  // Wall-clock of the simulated mission, shared by the T+ readout and by every
  // body's motion. Reset at the top of each cycle, not at each phase boundary.
  let missionElapsedDays = missionProgress * MISSION_OUTBOUND_DAYS;
  let telemetryTimer = 0;
  let lastTelemetryKey = "";
  let showOutboundTube = true;
  let showReturnTube = false;
  let lastCullKey = "";

  const occludeCam = new THREE.Vector3();
  const occludeWorld = new THREE.Vector3();
  const occludeToPoint = new THREE.Vector3();

  /**
   * True when a path sample sits between the camera and Earth's near face —
   * the chord that would read as a pierce across the disk. Far-side samples
   * that merely project onto the silhouette stay in the tube; depth-test hides
   * them instead of chopping the geometry into flat stubs.
   */
  function isEarthNearSidePierce(
    localPoint: THREE.Vector3,
    cameraWorld: THREE.Vector3,
  ) {
    orbitPlane.localToWorld(occludeWorld.copy(localPoint));
    occludeToPoint.copy(occludeWorld).sub(cameraWorld);
    const distToPoint = occludeToPoint.length();
    if (distToPoint < 1e-6) return false;

    const radius = SILHOUETTE_EARTH_RADIUS;
    const camDistSq = cameraWorld.lengthSq();
    if (camDistSq <= radius * radius * 1.1) return false;

    occludeToPoint.multiplyScalar(1 / distToPoint);
    // Ray camera → point vs sphere at origin: |C + t D|^2 = R^2
    const b = cameraWorld.dot(occludeToPoint);
    const discr = b * b - (camDistSq - radius * radius);
    if (discr <= 0) return false;
    const tNear = -b - Math.sqrt(discr);
    return tNear > 0 && distToPoint < tNear;
  }

  const occludeRayDir = new THREE.Vector3();
  const occludeFromCenter = new THREE.Vector3();

  /** World-space test: does `sphere` sit between the camera and `pointWorld`? */
  function isSphereOccluded(
    pointWorld: THREE.Vector3,
    cameraWorld: THREE.Vector3,
    centerWorld: THREE.Vector3,
    radius: number,
  ) {
    occludeRayDir.copy(pointWorld).sub(cameraWorld);
    const distToPoint = occludeRayDir.length();
    if (distToPoint < 1e-6) return false;
    occludeRayDir.multiplyScalar(1 / distToPoint);
    occludeFromCenter.copy(cameraWorld).sub(centerWorld);
    const camDistSq = occludeFromCenter.lengthSq();
    if (camDistSq <= radius * radius) return false;
    const b = occludeFromCenter.dot(occludeRayDir);
    const discr = b * b - (camDistSq - radius * radius);
    if (discr <= 0) return false;
    const tNear = -b - Math.sqrt(discr);
    return tNear > 0 && distToPoint > tNear;
  }

  /**
   * Hide only near-side chords that pierce Earth's disk. The far-side arc stays
   * in the mesh and is occluded by depth-test, so the tube isn't stubbed off at
   * the limb. Launch + splashdown indices stay protected. Purely an attribute
   * write — geometry is untouched.
   */
  function applyTubeCull(
    path: TubePath,
    points: readonly THREE.Vector3[],
    visible: boolean,
    protectStart = -1,
    protectEnd = -1,
  ) {
    if (!visible || path.sampleCount < 2 || path.sampleCount !== points.length) {
      path.mesh.visible = false;
      return;
    }
    path.mesh.visible = true;
    occludeCam.copy(camera.position);
    setTubePathVisibility(
      path,
      (i) =>
        (i >= protectStart && i <= protectEnd) ||
        !isEarthNearSidePierce(points[i], occludeCam),
    );
  }

  function updateTrajectorySilhouetteCull(force = false) {
    const cullKey = [
      missionPhase,
      showOutboundTube ? 1 : 0,
      showReturnTube ? 1 : 0,
      outboundPoints.length,
      returnPoints.length,
      outboundLaunchProtectEnd,
      returnSplashIndex,
      camera.position.x.toFixed(2),
      camera.position.y.toFixed(2),
      camera.position.z.toFixed(2),
    ].join("|");
    if (!force && cullKey === lastCullKey) return;
    lastCullKey = cullKey;

    if (missionPhase === "return") {
      applyTubeCull(
        returnTube,
        returnPoints,
        showReturnTube,
        returnSplashIndex,
        returnPoints.length - 1,
      );
      // Faint trace of the flown outbound coast, same cull as during outbound.
      applyTubeCull(
        outboundTube,
        outboundPoints,
        showOutboundTube,
        0,
        outboundLaunchProtectEnd,
      );
      // Splashdown marker stays on the surface contact — never silhouette-hide it.
      earthEntryTarget.visible = showReturnTube;
      entryLabel.visible = showReturnTube;
      return;
    }

    applyTubeCull(
      outboundTube,
      outboundPoints,
      showOutboundTube,
      0,
      outboundLaunchProtectEnd,
    );
    applyTubeCull(returnTube, returnPoints, false);

    const tliPoint = outboundPoints[outboundTliIndex];
    if (tliPoint && missionPhase === "outbound") {
      // Keep TLI readable whenever the protected launch segment is shown.
      tliMarker.visible = true;
      tliLabel.visible = true;
    }
  }

  function moonTangentAt(angle: number, out: THREE.Vector3) {
    return out
      .set(
        -Math.sin(angle) * ORBIT_SEMI_MAJOR,
        0,
        -Math.cos(angle) * ORBIT_SEMI_MINOR,
      )
      .normalize();
  }

  function pointOnEarthTransfer(trueAnomaly: number, out: THREE.Vector3) {
    // Kepler in the Moon plane, with a mild transverse squash for a flatter read.
    const radius =
      (transferSemiMajor *
        (1 - transferEccentricity * transferEccentricity)) /
      (1 + transferEccentricity * Math.cos(trueAnomaly));
    return out
      .copy(perigeeDir)
      .multiplyScalar(radius * Math.cos(trueAnomaly))
      .addScaledVector(
        perifocalQ,
        radius * Math.sin(trueAnomaly) * TRANSFER_FLATTEN,
      );
  }

  function pointOnReturnTransfer(trueAnomaly: number, out: THREE.Vector3) {
    const radius =
      (returnSemiMajor * (1 - returnEccentricity * returnEccentricity)) /
      (1 + returnEccentricity * Math.cos(trueAnomaly));
    return out
      .copy(returnAxis)
      .multiplyScalar(radius * Math.cos(trueAnomaly))
      .addScaledVector(
        returnNormal,
        radius * Math.sin(trueAnomaly) * TRANSFER_FLATTEN,
      );
  }

  /**
   * True anomaly at a given mean anomaly — Kepler's equation, Newton-solved.
   *
   * This is what makes a coast read correctly. On these transfer ellipses
   * (e ≈ 0.58) the vehicle is ~3.7x faster at perigee than at apoapsis, so it
   * leaps away from Earth after TLI and then drifts the last stretch in to the
   * Moon. Easing along arc length instead inverts that: Orion ends up crawling
   * beside a visibly spinning Earth for most of the leg, which reads as the
   * planet spinning too fast rather than the vehicle moving too slowly.
   */
  function trueAnomalyAt(meanAnomaly: number, eccentricity: number) {
    let anomaly = meanAnomaly;
    for (let i = 0; i < 6; i++) {
      const step =
        (anomaly - eccentricity * Math.sin(anomaly) - meanAnomaly) /
        Math.max(1 - eccentricity * Math.cos(anomaly), 1e-6);
      anomaly -= step;
      if (Math.abs(step) < 1e-9) break;
    }
    return (
      2 *
      Math.atan2(
        Math.sqrt(1 + eccentricity) * Math.sin(anomaly / 2),
        Math.sqrt(1 - eccentricity) * Math.cos(anomaly / 2),
      )
    );
  }

  // Ascent and entry are minutes against a multi-day coast, so they get a token
  // slice of the leg rather than an arc-length-proportional share.
  const ASCENT_TIME_FRACTION = 0.04;
  const DESCENT_TIME_FRACTION = 0.04;
  // Attitude comes from a forward difference in time, so it stays correct even
  // where Kepler timing makes the along-path speed vary by nearly 4x.
  const ATTITUDE_LOOKAHEAD = 0.004;

  /** Orion's position on the outbound leg at `progress` of the phase. */
  function outboundPointAt(progress: number, out: THREE.Vector3) {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    if (t < ASCENT_TIME_FRACTION) {
      return pointAlongArc(
        outboundPoints,
        outboundArcEnds,
        outboundTotalLength,
        (t / ASCENT_TIME_FRACTION) * outboundTliArcFraction,
        out,
      );
    }
    const coast = (t - ASCENT_TIME_FRACTION) / (1 - ASCENT_TIME_FRACTION);
    // ν: 0 at TLI (perigee) → π at the far-side LOI target (apoapsis).
    return pointOnEarthTransfer(
      trueAnomalyAt(Math.PI * coast, transferEccentricity),
      out,
    );
  }

  /** Orion's position on the return leg at `progress` of the phase. */
  function returnPointAt(progress: number, out: THREE.Vector3) {
    const t = THREE.MathUtils.clamp(progress, 0, 1);
    const coastEnd = 1 - DESCENT_TIME_FRACTION;
    if (t < coastEnd) {
      // ν: π at TEI (apoapsis) → 2π at the entry interface (perigee).
      return pointOnReturnTransfer(
        trueAnomalyAt(Math.PI * (1 + t / coastEnd), returnEccentricity),
        out,
      );
    }
    const descent = (t - coastEnd) / DESCENT_TIME_FRACTION;
    return pointAlongArc(
      returnPoints,
      returnArcEnds,
      returnTotalLength,
      returnEntryArcFraction + descent * (1 - returnEntryArcFraction),
      out,
    );
  }

  function buildArcLengthTable(points: readonly THREE.Vector3[]) {
    const ends: number[] = [0];
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      total += points[i].distanceTo(points[i - 1]);
      ends.push(total);
    }
    return { ends, total: Math.max(total, 1e-6) };
  }

  function pointAlongArc(
    points: readonly THREE.Vector3[],
    ends: readonly number[],
    total: number,
    progress: number,
    out: THREE.Vector3,
  ) {
    if (points.length === 0) return out.set(0, 0, 0);
    if (points.length === 1) return out.copy(points[0]);
    const target = THREE.MathUtils.clamp(progress, 0, 1) * total;
    let index = 1;
    while (index < ends.length - 1 && ends[index] < target) index += 1;
    const segmentStart = ends[index - 1];
    const segmentEnd = ends[index];
    const span = Math.max(segmentEnd - segmentStart, 1e-6);
    const localT = (target - segmentStart) / span;
    return out.copy(points[index - 1]).lerp(points[index], localT);
  }

  function updateLunarFrame() {
    lunarAxis.copy(moon.position).normalize();
    // Prograde lunar tangent — LOI/TEI sit on the free-return far-side corridor.
    moonTangentAt(moonAngle, lunarNormal);
    captureGroup.position.copy(moon.position);
    lunarNodesGroup.position.copy(moon.position);
    // Capture ring basis matches the flown orbit: +X far-side, +Z = velocity at LOI.
    captureZ.copy(lunarNormal).negate();
    captureY.crossVectors(captureZ, lunarAxis).normalize();
    if (captureY.lengthSq() < 1e-8) captureY.set(0, 1, 0);
    captureBasis.makeBasis(lunarAxis, captureY, captureZ);
    captureGroup.quaternion.setFromRotationMatrix(captureBasis);
    // Far-side perilune: anti-Earth face of the Moon (Apollo LOI / TEI geometry).
    loiMarker.position.copy(lunarAxis).multiplyScalar(captureRadius);
    teiMarker.position.copy(loiMarker.position);
    loiLabel.position.copy(loiMarker.position);
    loiLabel.position.y += 0.14;
    teiLabel.position.copy(teiMarker.position);
    teiLabel.position.y += 0.14;
  }

  function pointOnLunarOrbit(angle: number, out: THREE.Vector3) {
    // angle 0 = far-side LOI; retrograde vs Moon's Earth orbit (V = −moonTangent)
    // so arrival from the outbound coast continues without a reverse.
    return out
      .copy(lunarAxis)
      .multiplyScalar(captureRadius * Math.cos(angle))
      .addScaledVector(lunarNormal, -captureRadius * Math.sin(angle));
  }

  function orientVehicle(position: THREE.Vector3, ahead: THREE.Vector3) {
    vehicleTangent.subVectors(ahead, position);
    if (vehicleTangent.lengthSq() < 1e-10) {
      transferVehicle.position.copy(position);
      return;
    }
    // Stable prograde attitude: +Z along velocity, +Y on the orbit normal.
    // Avoid lookAt(world-up) — that rolls the craft as the path turns.
    vehicleTangent.normalize();
    vehicleUp.copy(captureY);
    if (vehicleUp.lengthSq() < 1e-8) vehicleUp.set(0, 1, 0);
    if (Math.abs(vehicleTangent.dot(vehicleUp)) > 0.95) {
      vehicleUp.set(0, 0, 1);
    }
    vehicleRight.crossVectors(vehicleUp, vehicleTangent).normalize();
    vehicleUp.crossVectors(vehicleTangent, vehicleRight).normalize();
    transferVehicle.position.copy(position);
    vehicleBasis.makeBasis(vehicleRight, vehicleUp, vehicleTangent);
    transferVehicle.quaternion.setFromRotationMatrix(vehicleBasis);
  }

  function updateSystemReferences() {
    updateLunarFrame();
  }

  function planOutboundTransfer() {
    transferArrivalAngle = moonAngle + MOON_LEAD_ANGLE;
    moonPositionAt(transferArrivalAngle, moonArrivalPos);
    emAxis.copy(moonArrivalPos).normalize();
    moonTangentAt(transferArrivalAngle, moonTangent);

    // Far-side LOI = apoapsis of the Earth-centered transfer ellipse.
    perilunePos.copy(moonArrivalPos).addScaledVector(emAxis, captureRadius);

    pathScratch
      .copy(emAxis)
      .multiplyScalar(Math.cos(LEADING_EDGE_AIM))
      .addScaledVector(moonTangent, -Math.sin(LEADING_EDGE_AIM))
      .normalize();
    perigeeDir.copy(pathScratch).multiplyScalar(-1);
    // In-plane perifocal Q: coplanar with the Moon orbit (orbitPlane y = 0).
    // Align Q with the Moon's prograde tangent so arrival velocity at far-side
    // LOI is −Q ≈ −moonTangent — same sense as the capture orbit.
    perifocalQ.set(-perigeeDir.z, 0, perigeeDir.x);
    if (perifocalQ.dot(moonTangent) < 0) perifocalQ.negate();

    const apoapsis = perilunePos.length();
    transferSemiMajor = (parkingRadius + apoapsis) / 2;
    transferEccentricity =
      (apoapsis - parkingRadius) / (apoapsis + parkingRadius);

    // 1) Surface launch → gravity-turn ascent into TLI.
    // 2) Kepler transfer ν=0→π from TLI to far-side LOI.
    outboundPoints = [];
    const launchSamples = 56;
    for (let i = 0; i <= launchSamples; i++) {
      const t = i / launchSamples;
      // Climb quickly off the pad, then pitch over into the insertion arc.
      const radius = THREE.MathUtils.lerp(
        SURFACE_RADIUS,
        parkingRadius,
        Math.pow(t, 0.62),
      );
      const coastAngle = -LAUNCH_ASCENT_ANGLE * (1 - t);
      outboundPoints.push(
        new THREE.Vector3()
          .copy(perigeeDir)
          .multiplyScalar(radius * Math.cos(coastAngle))
          .addScaledVector(perifocalQ, radius * Math.sin(coastAngle)),
      );
    }
    outboundTliIndex = outboundPoints.length - 1;

    const transferSamples = 180;
    for (let i = 1; i <= transferSamples; i++) {
      outboundPoints.push(
        pointOnEarthTransfer((i / transferSamples) * Math.PI, new THREE.Vector3()),
      );
    }
    outboundPoints[outboundTliIndex]
      .copy(perigeeDir)
      .multiplyScalar(parkingRadius);
    outboundPoints[outboundPoints.length - 1].copy(perilunePos);

    outboundLaunchProtectEnd = outboundTliIndex;
    for (let i = outboundTliIndex; i < outboundPoints.length; i++) {
      if (outboundPoints[i].length() > parkingRadius * 1.45) {
        outboundLaunchProtectEnd = i;
        break;
      }
      outboundLaunchProtectEnd = i;
    }

    const outboundArcs = buildArcLengthTable(outboundPoints);
    outboundArcEnds = outboundArcs.ends;
    outboundTotalLength = outboundArcs.total;
    outboundTliArcFraction =
      outboundArcEnds[outboundTliIndex] / outboundTotalLength;
    // Only place the tube geometry is rebuilt: once per mission cycle.
    setTubePathPoints(outboundTube, outboundPoints);

    tliMarker.position.copy(outboundPoints[outboundTliIndex]);
    tliLabel.position.copy(tliMarker.position);
    tliLabel.position.y += 0.14;
    periluneTarget.position.copy(perilunePos);
    periluneLabel.position.copy(perilunePos);
    periluneLabel.position.y += 0.16;

    outboundTube.material.opacity = 0.95;
    showOutboundTube = true;
    showReturnTube = false;
    leadArc.visible = true;
    periluneTarget.visible = true;
    captureGroup.visible = false;
    earthEntryTarget.visible = false;
    entryLabel.visible = false;
    tliMarker.visible = true;
    teiMarker.visible = false;
    teiLabel.visible = false;
    loiMarker.visible = false;
    loiLabel.visible = false;
    tliLabel.visible = true;
    periluneLabel.visible = true;
    updateTrajectorySilhouetteCull(true);
  }

  function updateOutboundTransfer(progress: number) {
    updateSystemReferences();
    const clamped = THREE.MathUtils.clamp(progress, 0, 1);
    outboundPointAt(clamped, transferPoint);
    // Sample ahead in time (not arc length) for attitude; mirror at the end.
    if (clamped + ATTITUDE_LOOKAHEAD <= 1) {
      outboundPointAt(clamped + ATTITUDE_LOOKAHEAD, pathScratch);
      orientVehicle(transferPoint, pathScratch);
    } else {
      outboundPointAt(Math.max(clamped - ATTITUDE_LOOKAHEAD, 0), pathScratch);
      orientVehicle(pathScratch, transferPoint);
      // orientVehicle parks the craft at its first argument, which on this
      // branch is the trailing sample — put it back on the current point.
      transferVehicle.position.copy(transferPoint);
    }

    const remainingAngle = Math.max(0, transferArrivalAngle - moonAngle);
    for (let i = 0; i <= MOON_LEAD_SAMPLES; i++) {
      moonPositionAt(
        moonAngle + (remainingAngle * i) / MOON_LEAD_SAMPLES,
        leadPoints[i],
      );
    }
    setNavigationPathPoints(moonLeadPath, leadPoints);
  }

  function enterLunarOrbit() {
    missionPhase = "lunar-orbit";
    missionProgress = 0;
    outboundTube.material.opacity = 0.28;
    leadArc.visible = false;
    periluneTarget.visible = false;
    periluneLabel.visible = false;
    tliLabel.visible = false;
    tliMarker.visible = false;
    captureGroup.visible = true;
    loiMarker.visible = true;
    loiLabel.visible = true;
    teiMarker.visible = false;
    teiLabel.visible = false;
    updateLunarOrbit(0);
    updateTrajectorySilhouetteCull(true);
  }

  function updateLunarOrbit(progress: number) {
    updateSystemReferences();
    const orbitAngle = progress * Math.PI * 2 * LUNAR_ORBIT_COUNT;
    pointOnLunarOrbit(orbitAngle, lunarLocalPoint);
    transferPoint.copy(moon.position).add(lunarLocalPoint);
    pointOnLunarOrbit(orbitAngle + 0.08, pathScratch);
    pathScratch.add(moon.position);
    orientVehicle(transferPoint, pathScratch);
    loiMarker.visible = progress < 0.28;
    loiLabel.visible = loiMarker.visible;
    teiMarker.visible = progress > 0.62;
    teiLabel.visible = teiMarker.visible;
  }

  function planReturnTransfer() {
    updateLunarFrame();
    // Far-side TEI (apoapsis) → Earth-focus ellipse → surface splashdown.
    const teiWorld = new THREE.Vector3()
      .copy(moon.position)
      .addScaledVector(lunarAxis, captureRadius);

    returnAxis.copy(lunarAxis).multiplyScalar(-1); // splashdown / perigee direction
    // Return ellipse in the Moon plane. Align returnNormal with moonTangent so
    // leaving TEI on ν: π→2π continues the capture-orbit velocity (−moonTangent).
    returnNormal.set(-returnAxis.z, 0, returnAxis.x);
    if (returnNormal.dot(lunarNormal) < 0) returnNormal.negate();

    const apoapsis = teiWorld.length();
    // Kepler coast to parking altitude, then a gravity-turn descent that mirrors
    // the launch ascent: wrap around Earth, then settle onto the surface.
    returnSemiMajor = (parkingRadius + apoapsis) / 2;
    returnEccentricity =
      (apoapsis - parkingRadius) / (apoapsis + parkingRadius);

    returnPoints = [teiWorld.clone()];
    const returnSamples = 180;
    for (let i = 1; i <= returnSamples; i++) {
      returnPoints.push(
        pointOnReturnTransfer(
          Math.PI * (1 + i / returnSamples),
          new THREE.Vector3(),
        ),
      );
    }
    const entryIndex = returnPoints.length - 1;
    returnEntryIndex = entryIndex;
    returnPoints[entryIndex].copy(returnAxis).multiplyScalar(parkingRadius);

    // Continue prograde past perigee (+returnNormal). Negative angle would
    // reverse into the inbound coast and make a hairpin at entry.
    const descentSamples = 56;
    for (let i = 1; i <= descentSamples; i++) {
      const t = i / descentSamples;
      // Mirror launch shaping: wrap first, then drop into the surface.
      const radius = THREE.MathUtils.lerp(
        SURFACE_RADIUS,
        parkingRadius,
        Math.pow(1 - t, 0.62),
      );
      const coastAngle = LAUNCH_ASCENT_ANGLE * t;
      returnPoints.push(
        new THREE.Vector3()
          .copy(returnAxis)
          .multiplyScalar(radius * Math.cos(coastAngle))
          .addScaledVector(returnNormal, radius * Math.sin(coastAngle)),
      );
    }
    returnPoints[returnPoints.length - 1].setLength(SURFACE_RADIUS);

    // Protect parking approach + full descent from silhouette cuts.
    returnSplashIndex = entryIndex;
    for (let i = entryIndex; i >= 0; i--) {
      if (returnPoints[i].length() > parkingRadius * 1.4) {
        returnSplashIndex = Math.min(i + 1, entryIndex);
        break;
      }
      returnSplashIndex = i;
    }

    const returnArcs = buildArcLengthTable(returnPoints);
    returnArcEnds = returnArcs.ends;
    returnTotalLength = returnArcs.total;
    returnEntryArcFraction =
      returnArcEnds[returnEntryIndex] / returnTotalLength;
    setTubePathPoints(returnTube, returnPoints);

    teiMarker.position.copy(lunarAxis).multiplyScalar(captureRadius);
    teiLabel.position.copy(teiMarker.position);
    teiLabel.position.y += 0.14;

    earthEntryTarget.position.copy(returnPoints[returnPoints.length - 1]);
    entryLabel.position.copy(earthEntryTarget.position);
    entryLabel.position.y += 0.14;
    returnTube.material.opacity = 0.95;
    showReturnTube = true;
    // Keep a faint trace of the flown outbound coast during the return leg.
    showOutboundTube = true;
    outboundTube.material.opacity = 0.14;
    earthEntryTarget.visible = true;
    entryLabel.visible = true;
    captureGroup.visible = false;
    teiMarker.visible = true;
    teiLabel.visible = true;
    loiMarker.visible = false;
    loiLabel.visible = false;
    tliLabel.visible = false;
    tliMarker.visible = false;
    periluneLabel.visible = false;
    periluneTarget.visible = false;
    updateTrajectorySilhouetteCull(true);
  }

  function enterReturnTransfer() {
    missionPhase = "return";
    missionProgress = 0;
    planReturnTransfer();
    updateReturnTransfer(0);
  }

  function updateReturnTransfer(progress: number) {
    updateSystemReferences();
    const clamped = THREE.MathUtils.clamp(progress, 0, 1);
    returnPointAt(clamped, returnPoint);
    if (clamped + ATTITUDE_LOOKAHEAD <= 1) {
      returnPointAt(clamped + ATTITUDE_LOOKAHEAD, pathScratch);
      orientVehicle(returnPoint, pathScratch);
    } else {
      returnPointAt(Math.max(clamped - ATTITUDE_LOOKAHEAD, 0), pathScratch);
      orientVehicle(pathScratch, returnPoint);
      transferVehicle.position.copy(returnPoint);
    }
  }

  function restartMissionCycle() {
    missionPhase = "outbound";
    missionProgress = 0;
    missionElapsedDays = 0;
    planOutboundTransfer();
    updateOutboundTransfer(0);
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
  // Point size is in drawing-buffer pixels, so it has to follow the pixel ratio
  // whenever resize() re-derives it for a larger canvas.
  const starMaterials: { material: THREE.PointsMaterial; baseSize: number }[] =
    [];
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
      size: layer.size * renderer.getPixelRatio(),
      vertexColors: true,
      transparent: true,
      opacity: layer.opacity,
      sizeAttenuation: false,
      depthWrite: false,
    });
    starMaterials.push({ material: m, baseSize: layer.size });
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
  // The camera orbits and zooms around the focused body. Double-clicking a
  // body re-centers on it; the target glides over and then follows it.
  const FOCUS_RANGES = {
    system: { min: 9.2, max: 25, dist: 12 },
    earth: { min: 3.3, max: 14, dist: 4.7 },
    moon: { min: 1.15, max: 14, dist: 2.45 },
    orion: { min: 0.8, max: 10, dist: 2.4 },
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
  const orionFocusPos = new THREE.Vector3();

  /** Place the camera outside Orion looking inward so Earth stays in frame. */
  function orionEarthBackgroundAngles(): { azim: number; elev: number } {
    transferVehicle.getWorldPosition(orionFocusPos);
    const len = orionFocusPos.length();
    if (len < 1e-6) return { azim: 0.5, elev: 0.22 };
    return {
      azim: Math.atan2(orionFocusPos.x, orionFocusPos.z),
      elev:
        Math.asin(THREE.MathUtils.clamp(orionFocusPos.y / len, -1, 1)) + 0.12,
    };
  }

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
    } else if (next === "orion") {
      // Outside the craft looking toward Earth so the system stays in view.
      const angles = orionEarthBackgroundAngles();
      azimGoal = angles.azim;
      elevGoal = angles.elev;
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
  function nudgeCamera(dAzim: number, dElev: number, dDist: number) {
    azimGoal = null;
    elevGoal = null;
    azim += dAzim;
    elev = Math.max(-0.9, Math.min(0.95, elev + dElev));
    if (dDist !== 0) {
      const range = FOCUS_RANGES[focus];
      dist = Math.max(range.min, Math.min(range.max, dist + dDist));
      distGoal = null;
    }
    idle = 0;
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
    const hit = raycaster.intersectObjects([earth, moon, transferVehicle], true)[0];
    if (!hit) return;
    let next: SceneFocus | null = null;
    for (
      let obj: THREE.Object3D | null = hit.object;
      obj;
      obj = obj.parent
    ) {
      if (obj === transferVehicle) {
        next = "orion";
        break;
      }
      if (obj === moon) {
        next = "moon";
        break;
      }
      if (obj === earth) {
        next = "earth";
        break;
      }
    }
    if (next && next !== focus) focusScene(next);
  }
  // Two-finger pinch. Without this, touch users could orbit but had no way at
  // all to change `dist` — the wheel handler is the only other zoom path.
  let pinchSpread = 0;
  let pinchStartDist = 0;
  function touchSpread(touches: TouchList) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY,
    );
  }
  function onTouchStart(e: TouchEvent) {
    if (e.touches.length >= 2) {
      dragging = false;
      pinchSpread = touchSpread(e.touches);
      pinchStartDist = dist;
      return;
    }
    pinchSpread = 0;
    onDown(e);
  }
  function onTouchMove(e: TouchEvent) {
    if (e.touches.length >= 2) {
      if (pinchSpread <= 0) return;
      const spread = touchSpread(e.touches);
      if (spread > 1) {
        const range = FOCUS_RANGES[focus];
        dist = Math.max(
          range.min,
          Math.min(range.max, pinchStartDist * (pinchSpread / spread)),
        );
        distGoal = null;
        idle = 0;
      }
      return;
    }
    onMove(e);
  }
  function onTouchEnd(e: TouchEvent) {
    if (pinchSpread > 0) {
      // Lifting one finger of a pinch must not read as a tap on a marker.
      pinchSpread = 0;
      dragging = false;
      pointerMoved = true;
      return;
    }
    onUp(e);
  }
  canvas.addEventListener("dblclick", onDblClick);
  canvas.addEventListener("mousemove", onMouseMove);
  canvas.addEventListener("mouseleave", onMouseLeave);
  canvas.addEventListener("mousedown", onDown);
  window.addEventListener("mousemove", onMove);
  window.addEventListener("mouseup", onUp);
  // Touch move/end live on window: a finger that leaves the canvas mid-drag
  // used to never fire touchend, leaving `dragging` stuck true.
  canvas.addEventListener("touchstart", onTouchStart, { passive: true });
  window.addEventListener("touchmove", onTouchMove, { passive: true });
  window.addEventListener("touchend", onTouchEnd);
  window.addEventListener("touchcancel", onTouchEnd);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.style.cursor = "grab";
  // The browser must not claim the gesture for page pan/zoom.
  canvas.style.touchAction = "none";

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width);
    const h = Math.max(1, r.height);
    renderer.setPixelRatio(pixelRatioFor(w, h));
    renderer.setSize(w, h, false);
    renderer.getDrawingBufferSize(lineResolution);
    for (const material of lineMaterials) {
      material.resolution.copy(lineResolution);
    }
    const ratio = renderer.getPixelRatio();
    for (const star of starMaterials) {
      star.material.size = star.baseSize * ratio;
    }
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
    // Idle drift is unrequested motion, so it stays gated on the OS preference
    // even when the user has explicitly resumed the simulation.
    if (!reducedMotion && !dragging && idle > 1.4 && focus !== "orion") {
      azim -= dt * 0.04;
    }
    if (!paused) {
      const simDays = dt * simulationSpeed * SIM_DAYS_PER_REAL_SECOND;
      const TAU = Math.PI * 2;
      missionElapsedDays += simDays;
      // Wrapped, not accumulated: an hours-long session would otherwise erode
      // float precision in the rotation and in the cloud-shadow offset.
      earth.rotation.y = (earth.rotation.y + simDays * TAU) % TAU;
      clouds.rotation.y =
        (clouds.rotation.y + simDays * TAU * CLOUD_DRIFT_RATIO) % TAU;
      // Line the cloud plate up with the surface texel underneath it.
      cloudShadowUniforms.tsCloudUvOffset.value =
        (earth.rotation.y - clouds.rotation.y) / TAU;
      moonAngle += simDays * MOON_RATE_PER_DAY;
      if (missionPhase === "outbound") {
        missionProgress += simDays / MISSION_OUTBOUND_DAYS;
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
        missionProgress += simDays / MISSION_LUNAR_ORBIT_DAYS;
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
        missionProgress += simDays / MISSION_RETURN_DAYS;
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
    }

    // Runs while paused too, so a keyboard-focused site still reads as selected.
    markerEntries.forEach((entry, i) => {
      const base = entry.body === "moon" ? 0.72 : 1;
      const pulse = paused ? 1 : 1 + Math.sin(now * 0.003 + i) * 0.18;
      const highlighted = entry.location.id === highlightId;
      entry.ring.scale.setScalar(base * pulse * (highlighted ? 1.9 : 1));
      entry.marker.scale.setScalar(base * (highlighted ? 1.5 : 1));
    });

    telemetryTimer += dt;
    if (telemetryTimer >= 0.25) {
      telemetryTimer = 0;
      // Keyed on the displayed hour so 32x playback doesn't spam React.
      const key = `${missionPhase}|${Math.floor(missionElapsedDays * 24)}`;
      if (key !== lastTelemetryKey) {
        lastTelemetryKey = key;
        callbacks.onTelemetry({
          phase: missionPhase,
          elapsedDays: missionElapsedDays,
        });
      }
    }
    // Ease the camera target onto the focused body (the Moon and Orion keep
    // moving, so the target tracks them every frame once captured).
    if (focus === "moon") {
      moon.getWorldPosition(focusPoint);
    } else if (focus === "orion") {
      transferVehicle.getWorldPosition(focusPoint);
      // Keep Earth in the background while the user isn't orbiting freely.
      if (!dragging) {
        const angles = orionEarthBackgroundAngles();
        azimGoal = angles.azim;
        elevGoal = angles.elev;
      }
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
    updateTrajectorySilhouetteCull();
    updateLabelOcclusion(dt);

    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }

  function startLoop() {
    if (!running || raf !== 0) return;
    t0 = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stopLoop() {
    if (raf === 0) return;
    cancelAnimationFrame(raf);
    raf = 0;
  }

  resize();
  applyCam();
  planOutboundTransfer();
  updateOutboundTransfer(missionProgress);
  updateTrajectorySilhouetteCull(true);
  startLoop();

  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // requestAnimationFrame already idles on a hidden tab, but it keeps firing
  // when the user navigates to another Trackspace screen and the stage is
  // merely scrolled out of view. Stop rendering entirely in that case.
  const io = new IntersectionObserver(
    (entries) => {
      const onScreen = entries.some((entry) => entry.isIntersecting);
      if (onScreen) startLoop();
      else stopLoop();
    },
    { threshold: 0 },
  );
  io.observe(canvas);

  // A lost context can't be repaired in place — every buffer, texture, and
  // program is gone. Ask React for a fresh canvas once the GPU comes back.
  function onContextLost(event: Event) {
    event.preventDefault();
    stopLoop();
  }
  function onContextRestored() {
    callbacks.onContextLost();
  }
  canvas.addEventListener("webglcontextlost", onContextLost);
  canvas.addEventListener("webglcontextrestored", onContextRestored);

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
    orionScreen: () =>
      toScreen(transferVehicle.getWorldPosition(new THREE.Vector3())),
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
        sitesVisible = visible;
        for (const entry of markerEntries) entry.root.visible = visible;
        if (!visible) {
          highlightId = null;
          callbacks.onHoverChange(null);
        }
      } else if (layer === "trajectory") {
        trajectoryPathsGroup.visible = visible;
      } else {
        maneuverNodesGroup.visible = visible;
      }
    },
    setLocations,
    setHighlight(id) {
      highlightId = id;
    },
    nudgeCamera,
    resetView() {
      focusScene("system");
      distGoal = FOCUS_RANGES.system.dist;
      callbacks.onHoverChange(null);
    },
    destroy() {
      delete (canvas as TrackspaceCanvas).__trackspace;
      callbacks.onHoverChange(null);
      disposed = true;
      running = false;
      stopLoop();
      window.clearTimeout(revealTimer);
      ro.disconnect();
      io.disconnect();
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      canvas.removeEventListener("dblclick", onDblClick);
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
      window.removeEventListener("touchcancel", onTouchEnd);
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

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";

function subscribeReducedMotion(onChange: () => void) {
  const query = window.matchMedia(REDUCED_MOTION_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

function readReducedMotion() {
  return window.matchMedia(REDUCED_MOTION_QUERY).matches;
}

function readReducedMotionOnServer() {
  return false;
}

export function EarthMoonScene({
  locations,
  onLocationOpen,
}: EarthMoonSceneProps) {
  const ref = useRef<HTMLCanvasElement>(null);
  const controllerRef = useRef<SceneController | null>(null);
  const openRef = useRef(onLocationOpen);
  const [hover, setHover] = useState<SceneHover | null>(null);
  const [focus, setFocus] = useState<SceneFocus>("system");
  // Reduced motion starts the simulation paused rather than freezing it, so the
  // play and speed controls still work for anyone who opts back in. `null`
  // means "no explicit choice yet — follow the OS preference".
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    readReducedMotion,
    readReducedMotionOnServer,
  );
  const [pausedOverride, setPausedOverride] = useState<boolean | null>(null);
  const paused = pausedOverride ?? reducedMotion;
  const [speed, setSpeed] = useState<SimulationSpeed>(1);
  // Bumped when the GPU hands the context back, forcing a fresh canvas element
  // and a full scene rebuild — a lost context can't be revived in place.
  const [sceneKey, setSceneKey] = useState(0);
  const [telemetry, setTelemetry] = useState<SceneTelemetry>({
    phase: "outbound",
    elapsedDays: 0,
  });
  const [layers, setLayers] = useState<Record<SceneLayer, boolean>>({
    sites: true,
    trajectory: true,
    maneuvers: true,
  });
  const sceneStateRef = useRef({ paused, speed, layers, focus });

  const keyboardSites = useMemo(
    () =>
      locations.filter(
        (location) =>
          (location.body === "earth" || location.body === "moon") &&
          typeof location.lat === "number" &&
          typeof location.lon === "number",
      ),
    [locations],
  );

  useEffect(() => {
    sceneStateRef.current = { paused, speed, layers, focus };
  }, [paused, speed, layers, focus]);

  useEffect(() => {
    openRef.current = onLocationOpen;
  }, [onLocationOpen]);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const scene = createEarthMoonScene(canvas, {
      onLocationOpen: (id) => openRef.current(id),
      onHoverChange: setHover,
      onFocusChange: setFocus,
      onTelemetry: setTelemetry,
      onContextLost: () => setSceneKey((key) => key + 1),
    });
    controllerRef.current = scene;
    const sceneState = sceneStateRef.current;
    scene.setPaused(sceneState.paused);
    scene.setSpeed(sceneState.speed);
    scene.setLayer("sites", sceneState.layers.sites);
    scene.setLayer("trajectory", sceneState.layers.trajectory);
    scene.setLayer("maneuvers", sceneState.layers.maneuvers);
    scene.setFocus(sceneState.focus);
    return () => {
      controllerRef.current = null;
      scene.destroy();
    };
  }, [sceneKey]);

  // Markers are swapped on the live scene: a new Dataset array identity no
  // longer tears down the renderer and re-fetches every texture.
  useEffect(() => {
    controllerRef.current?.setLocations(locations);
  }, [locations, sceneKey]);

  // `paused` is derived, so it can change without a click (the OS preference
  // flipping). Push it to the scene here rather than only from the handler.
  useEffect(() => {
    controllerRef.current?.setPaused(paused);
  }, [paused, sceneKey]);

  const selectFocus = (nextFocus: SceneFocus) => {
    setFocus(nextFocus);
    controllerRef.current?.setFocus(nextFocus);
  };

  const togglePaused = () => {
    setPausedOverride(!paused);
  };

  const selectSpeed = (nextSpeed: SimulationSpeed) => {
    setSpeed(nextSpeed);
    setPausedOverride(false);
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

  const onCanvasKeyDown = (event: React.KeyboardEvent<HTMLCanvasElement>) => {
    const controller = controllerRef.current;
    if (!controller) return;
    const step = event.shiftKey ? 0.3 : 0.11;
    switch (event.key) {
      case "ArrowLeft":
        controller.nudgeCamera(-step, 0, 0);
        break;
      case "ArrowRight":
        controller.nudgeCamera(step, 0, 0);
        break;
      case "ArrowUp":
        controller.nudgeCamera(0, step, 0);
        break;
      case "ArrowDown":
        controller.nudgeCamera(0, -step, 0);
        break;
      case "+":
      case "=":
        controller.nudgeCamera(0, 0, -0.6);
        break;
      case "-":
      case "_":
        controller.nudgeCamera(0, 0, 0.6);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  return (
    <>
      <canvas
        key={sceneKey}
        ref={ref}
        tabIndex={0}
        onKeyDown={onCanvasKeyDown}
        className="trackspace-scene-canvas"
        aria-label="Interactive Earth and Moon orbit view. Arrow keys orbit the camera, plus and minus zoom."
      />
      <div className="trackspace-scene-vignette" aria-hidden="true" />
      <div className="trackspace-scene-scanline" aria-hidden="true" />

      {/* The canvas can't expose its markers to assistive tech, so the same
          sites are mirrored here. Focusing an entry highlights it in 3D. */}
      <ul className="trackspace-scene-sitelist">
        {keyboardSites.map((location) => (
          <li key={location.id}>
            <button
              type="button"
              onFocus={() => controllerRef.current?.setHighlight(location.id)}
              onBlur={() => controllerRef.current?.setHighlight(null)}
              onClick={() => onLocationOpen(location.id)}
            >
              {`${location.name}, ${LOCATION_KIND_LABEL[location.kind]} on the ${location.body}, status ${location.status}`}
            </button>
          </li>
        ))}
      </ul>

      <div className="trackspace-scene-identity">
        <span aria-hidden="true">Cislunar digital twin</span>
        <b aria-hidden="true">EARTH—MOON / LIVE</b>
        <i>
          <span aria-live="polite">
            {MISSION_PHASE_LABEL[telemetry.phase]}
          </span>
          <em aria-hidden="true">
            {formatMissionClock(telemetry.elapsedDays)}
          </em>
        </i>
        <small aria-hidden="true">
          Bodies to scale · range compressed ×{RANGE_COMPRESSION}
        </small>
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
