import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  createBodies,
  EARTH_RADIUS,
  MOON_RADIUS,
  geographicPoint,
} from "./bodies";
import { infrastructureSymbol } from "./infrastructure";
import type { AtlasSceneProps } from "./AtlasScene";
import type { AtlasView } from "./model";
import type { Location } from "../data/types";
import { hasRegionalTerrain, isOnLunarTerrain } from "./projection";

export type AtlasRenderer = {
  update(props: AtlasSceneProps): void;
  dispose(): void;
};
type Callbacks = Pick<
  AtlasSceneProps,
  "onLocationSelect" | "onInfrastructureSelect" | "onReady" | "onError"
>;
type Label = {
  element: HTMLButtonElement;
  point: THREE.Vector3;
  body: "earth" | "moon" | "surface";
  selected: boolean;
};
const COLORS = {
  ready: "#8fd6b5",
  watch: "#e7c384",
  blocker: "#e48285",
  unknown: "#99a6b4",
};

export function createAtlasRenderer(
  container: HTMLDivElement,
  callbacks: Callbacks,
): AtlasRenderer {
  const canvas = document.createElement("canvas");
  canvas.setAttribute(
    "aria-label",
    "Interactive mission atlas. Drag to orbit, scroll to zoom. Arrow keys orbit and plus or minus zoom.",
  );
  canvas.tabIndex = 0;
  canvas.style.cssText =
    "display:block;width:100%;height:100%;outline-offset:-3px;touch-action:none";
  container.append(canvas);
  const overlay = document.createElement("div");
  overlay.style.cssText =
    "position:absolute;inset:0;pointer-events:none;overflow:hidden";
  container.append(overlay);
  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch (error) {
    canvas.remove();
    overlay.remove();
    throw error;
  }
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#020409");
  const camera = new THREE.PerspectiveCamera(40, 1, 0.02, 500);
  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.13;
  controls.enablePan = false;
  controls.minDistance = 0.7;
  controls.maxDistance = 26;
  const system = new THREE.Group();
  scene.add(system);
  const surface = new THREE.Group();
  surface.visible = false;
  scene.add(surface);
  const ambient = new THREE.AmbientLight("#8295b4", 0.23);
  scene.add(ambient);
  const sunlight = new THREE.DirectionalLight("#fff4e5", 3.4);
  sunlight.position.set(-30, 20, 50);
  scene.add(sunlight);
  const terrainLight = new THREE.DirectionalLight("#fff1dd", 3.2);
  terrainLight.position.set(-6, 2.5, 4);
  terrainLight.visible = false;
  terrainLight.castShadow = true;
  terrainLight.shadow.mapSize.set(1024, 1024);
  Object.assign(terrainLight.shadow.camera, {
    left: -6,
    right: 6,
    top: 6,
    bottom: -6,
    near: 0.1,
    far: 30,
  });
  terrainLight.shadow.bias = -0.00015;
  terrainLight.shadow.normalBias = 0.015;
  scene.add(terrainLight);
  scene.add(terrainLight.target);
  const bodies = createBodies(invalidate, callbacks.onReady);
  system.add(bodies.earth, bodies.moon);
  const markerGroup = new THREE.Group();
  system.add(markerGroup);
  const surfaceMarkers = new THREE.Group();
  surface.add(surfaceMarkers);
  const linksGroup = new THREE.Group();
  system.add(linksGroup);
  const surfaceLinks = new THREE.Group();
  surface.add(surfaceLinks);
  const symbolGroup = new THREE.Group();
  surface.add(symbolGroup);
  const resourceDisposers: (() => void)[] = [];
  const transientDisposers: (() => void)[] = [];
  const labels: Label[] = [];
  let state: AtlasSceneProps | null = null;
  let view: AtlasView = "system";
  let disposed = false;
  let raf = 0;
  let inFrame = false;
  let visible = true;
  let contextLost = false;
  let width = 1,
    height = 1;
  let lastTime = 0;
  let transition = false;
  let transitionStarted = 0;
  let slowFrames = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
  const goalPosition = new THREE.Vector3();
  const goalTarget = new THREE.Vector3();
  const startPosition = new THREE.Vector3();
  const startTarget = new THREE.Vector3();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let terrain: Awaited<
    ReturnType<(typeof import("./terrain"))["loadLunarTerrain"]>
  > | null = null;
  let terrainPromise: Promise<void> | null = null;
  let surfacePoint: (typeof import("./terrain"))["lunarSurfacePoint"] | null =
    null;
  const metric = {
    frames: 0,
    drawCalls: 0,
    triangles: 0,
    dpr,
    renderMs: 0,
    active: false,
    view: "system",
    terrainReady: false,
  };
  Object.defineProperty(canvas, "__atlas", {
    get: () => ({ ...metric, active: raf !== 0, camera: camera.position.toArray(), target: controls.target.toArray() }),
    configurable: true,
  });

  // Static point field: one draw call, no frame-driven twinkle or particle simulation.
  const starGeometry = new THREE.BufferGeometry();
  const starPositions = new Float32Array(1100 * 3);
  let seed = 817;
  const random = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  for (let i = 0; i < 1100; i++) {
    const az = random() * Math.PI * 2,
      y = random() * 2 - 1,
      r = 140;
    starPositions[i * 3] = Math.cos(az) * Math.sqrt(1 - y * y) * r;
    starPositions[i * 3 + 1] = y * r;
    starPositions[i * 3 + 2] = Math.sin(az) * Math.sqrt(1 - y * y) * r;
  }
  starGeometry.setAttribute(
    "position",
    new THREE.BufferAttribute(starPositions, 3),
  );
  const starMaterial = new THREE.PointsMaterial({
    color: "#acb8c8",
    size: 1.1,
    sizeAttenuation: false,
    transparent: true,
    opacity: 0.6,
  });
  const stars = new THREE.Points(starGeometry, starMaterial);
  scene.add(stars);
  resourceDisposers.push(() => {
    starGeometry.dispose();
    starMaterial.dispose();
  });

  const ringGeometry = new THREE.RingGeometry(0.014, 0.023, 24);
  const dotGeometry = new THREE.SphereGeometry(0.014, 8, 6);
  resourceDisposers.push(() => {
    ringGeometry.dispose();
    dotGeometry.dispose();
  });

  function invalidate() {
    if (
      disposed ||
      !visible ||
      contextLost ||
      document.hidden ||
      raf ||
      inFrame
    )
      return;
    lastTime = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function frame(now: number) {
    raf = 0;
    if (disposed || !visible || contextLost || document.hidden) return;
    inFrame = true;
    const dt = Math.min((now - lastTime) / 1000, 0.05);
    lastTime = now;
    if (transition) {
      const progress = reducedMotion.matches
        ? 1
        : Math.min(1, (now - transitionStarted) / 1100);
      const ease = 1 - Math.pow(1 - progress, 3);
      camera.position.lerpVectors(startPosition, goalPosition, ease);
      controls.target.lerpVectors(startTarget, goalTarget, ease);
      if (progress === 1) {
        camera.position.copy(goalPosition);
        controls.target.copy(goalTarget);
        transition = false;
      }
    }
    const moving = controls.update();
    if (view === "surface" && terrain && isOnLunarTerrain(camera.position.x, camera.position.z)) {
      camera.position.y = Math.max(camera.position.y, terrain.heightAt(camera.position.x, camera.position.z) + 0.08);
      camera.lookAt(controls.target);
    }
    updateLabels();
    const start = performance.now();
    renderer.render(scene, camera);
    metric.renderMs = performance.now() - start;
    metric.frames++;
    metric.drawCalls = renderer.info.render.calls;
    metric.triangles = renderer.info.render.triangles;
    // Resolution adapts only under sustained interaction, never oscillates while inspecting.
    if ((transition || moving) && dt > 0.029) {
      slowFrames++;
      if (slowFrames > 35 && dpr > 1) {
        dpr = Math.max(1, dpr - 0.25);
        renderer.setPixelRatio(dpr);
        renderer.setSize(width, height, false);
        metric.dpr = dpr;
        slowFrames = 0;
      }
    } else slowFrames = Math.max(0, slowFrames - 1);
    inFrame = false;
    if ((transition || moving) && !raf) raf = requestAnimationFrame(frame);
  }
  function resize() {
    const oldAspect = width / height;
    width = Math.max(1, container.clientWidth);
    height = Math.max(1, container.clientHeight);
    renderer.setPixelRatio(dpr);
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    if (state && Math.abs(oldAspect - camera.aspect) > 0.15) frameView();
    invalidate();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(container);
  const intersection = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible) invalidate();
    else {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  });
  intersection.observe(container);
  function visibilityChanged() {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else invalidate();
  }
  document.addEventListener("visibilitychange", visibilityChanged);
  controls.addEventListener("change", invalidate);
  const stopTransition = () => {
    transition = false;
  };
  controls.addEventListener("start", stopTransition);
  function onLost(event: Event) {
    event.preventDefault();
    contextLost = true;
    cancelAnimationFrame(raf);
    raf = 0;
    callbacks.onError(
      "The graphics connection was interrupted. Restoring the atlas when the device is ready.",
    );
  }
  function onRestored() {
    // Three restores its GPU resources before this listener runs. Keep the scene
    // and its camera intact instead of disposing handles from the lost context.
    contextLost = false;
    renderer.shadowMap.needsUpdate = true;
    callbacks.onReady();
    invalidate();
  }
  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  function keyboard(event: KeyboardEvent) {
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new THREE.Spherical().setFromVector3(offset);
    switch (event.key) {
      case "ArrowLeft":
        spherical.theta -= 0.12;
        break;
      case "ArrowRight":
        spherical.theta += 0.12;
        break;
      case "ArrowUp":
        spherical.phi -= 0.1;
        break;
      case "ArrowDown":
        spherical.phi += 0.1;
        break;
      case "+":
      case "=":
        spherical.radius *= 0.85;
        break;
      case "-":
        spherical.radius *= 1.15;
        break;
      default:
        return;
    }
    event.preventDefault();
    transition = false;
    spherical.phi = THREE.MathUtils.clamp(
      spherical.phi,
      controls.minPolarAngle,
      controls.maxPolarAngle,
    );
    spherical.radius = THREE.MathUtils.clamp(
      spherical.radius,
      controls.minDistance,
      controls.maxDistance,
    );
    camera.position
      .copy(controls.target)
      .add(offset.setFromSpherical(spherical));
    controls.update();
    invalidate();
  }
  canvas.addEventListener("keydown", keyboard);

  function addLabel(
    name: string,
    id: string,
    point: THREE.Vector3,
    body: Label["body"],
    selected: boolean,
    color: string,
    kind: "site" | "infrastructure" = "site",
  ) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = "atlas-map-label";
    element.classList.toggle("is-selected", selected);
    element.style.setProperty("--marker-color", color);
    element.style.cssText +=
      ";position:absolute;left:0;top:0;pointer-events:auto;white-space:nowrap";
    const dot = document.createElement("span");
    dot.className = "atlas-map-dot";
    dot.setAttribute("aria-hidden", "true");
    element.append(dot);
    const text = document.createElement("span");
    text.textContent = name.split(" · ")[0];
    element.append(text);
    element.setAttribute("aria-label", `Explore ${name}`);
    element.onclick = () =>
      kind === "site"
        ? callbacks.onLocationSelect(id)
        : callbacks.onInfrastructureSelect(id);
    overlay.append(element);
    labels.push({ element, point, body, selected });
  }
  const projected = new THREE.Vector3();
  const worldPoint = new THREE.Vector3();
  const cameraDirection = new THREE.Vector3();
  const normal = new THREE.Vector3();
  function updateLabels() {
    scene.updateMatrixWorld(true);
    camera.updateMatrixWorld();
    const occupied: { x: number; y: number; w: number }[] = [];
    // Selected labels win collisions; labels are positioned only when a frame is needed.
    const ordered = labels
      .slice()
      .sort((a, b) => Number(b.selected) - Number(a.selected));
    for (const label of ordered) {
      let shown = (view === "surface") === (label.body === "surface");
      worldPoint.copy(label.point);
      if (label.body !== "surface") {
        const group = label.body === "earth" ? bodies.earth : bodies.moon;
        group.localToWorld(worldPoint);
        normal.copy(worldPoint).sub(group.position).normalize();
        cameraDirection.copy(camera.position).sub(worldPoint).normalize();
        shown = shown && normal.dot(cameraDirection) > 0.04;
      }
      projected.copy(worldPoint).project(camera);
      const x = (projected.x * 0.5 + 0.5) * width,
        y = (-projected.y * 0.5 + 0.5) * height;
      const labelWidth = Math.min(label.element.offsetWidth || 160, 220);
      shown =
        shown &&
        projected.z < 1 &&
        projected.z > -1 &&
        x > 12 &&
        x < width - 20 &&
        y > 64 &&
        y < height - 42;
      const labelX = THREE.MathUtils.clamp(
        x,
        8,
        Math.max(8, width - labelWidth - 12),
      );
      if (
        shown &&
        !label.selected &&
        occupied.some(
          (p) =>
            Math.abs(y - p.y) < 28 &&
            labelX < p.x + p.w + 12 &&
            labelX + labelWidth > p.x - 12,
        )
      )
        shown = false;
      label.element.style.visibility = shown ? "visible" : "hidden";
      label.element.style.transform = `translate(${Math.round(labelX)}px,${Math.round(y)}px)`;
      if (shown) occupied.push({ x: labelX, y, w: labelWidth });
    }
  }
  function disposeTransient() {
    transientDisposers.splice(0).forEach((dispose) => dispose());
    markerGroup.clear();
    surfaceMarkers.clear();
    linksGroup.clear();
    surfaceLinks.clear();
    symbolGroup.clear();
    labels.splice(0).forEach((label) => label.element.remove());
  }
  function locationWorld(location: Location) {
    const radius = location.body === "earth" ? EARTH_RADIUS : MOON_RADIUS;
    const local = geographicPoint(radius * 1.009, location.lat!, location.lon!);
    const group = location.body === "earth" ? bodies.earth : bodies.moon;
    return group.localToWorld(local);
  }
  function curve(
    start: THREE.Vector3,
    end: THREE.Vector3,
    group: THREE.Group,
    surfaceLink = false,
  ) {
    const mid = start.clone().lerp(end, 0.5);
    mid.y += surfaceLink ? 0.15 : Math.min(1.4, start.distanceTo(end) * 0.3);
    const path = new THREE.QuadraticBezierCurve3(start, mid, end);
    const geometry = new THREE.BufferGeometry().setFromPoints(
      path.getPoints(48),
    );
    const material = new THREE.LineDashedMaterial({
      color: "#7aacc0",
      transparent: true,
      opacity: 0.4,
      dashSize: surfaceLink ? 0.035 : 0.065,
      gapSize: surfaceLink ? 0.025 : 0.04,
    });
    const line = new THREE.Line(geometry, material);
    line.computeLineDistances();
    group.add(line);
    transientDisposers.push(() => {
      geometry.dispose();
      material.dispose();
    });
  }
  function rebuild() {
    if (!state) return;
    disposeTransient();
    scene.updateMatrixWorld(true);
    const locations = state.locations.filter(
      (l) =>
        Number.isFinite(l.lat) &&
        Number.isFinite(l.lon) &&
        (l.body === "earth" || l.body === "moon"),
    );
    for (const location of locations) {
      const body = location.body as "earth" | "moon";
      const radius = body === "earth" ? EARTH_RADIUS : MOON_RADIUS;
      const local = geographicPoint(
        radius * 1.012,
        location.lat!,
        location.lon!,
      );
      const chosen = location.id === state.selectedLocationId;
      const material = new THREE.MeshBasicMaterial({
        color: COLORS[location.status],
      });
      const marker = new THREE.Mesh(dotGeometry, material);
      marker.position.copy(local);
      (body === "earth" ? bodies.earth : bodies.moon).localToWorld(
        marker.position,
      );
      marker.scale.setScalar(chosen ? 1.5 : 1);
      markerGroup.add(marker);
      transientDisposers.push(() => material.dispose());
      addLabel(
        location.name,
        location.id,
        local,
        body,
        chosen,
        COLORS[location.status],
      );
      if (terrain && surfacePoint && hasRegionalTerrain(location)) {
        const p = surfacePoint(location.lat!, location.lon!);
        const point = new THREE.Vector3(
          p.x,
          terrain.heightAt(p.x, p.z) + 0.06,
          p.z,
        );
        addLabel(
          location.name,
          location.id,
          point,
          "surface",
          chosen,
          COLORS[location.status],
        );
        const ring = new THREE.Mesh(ringGeometry, material);
        ring.rotation.x = -Math.PI / 2;
        ring.position.copy(point);
        ring.scale.setScalar(3);
        surfaceMarkers.add(ring);
        // A region boundary represents the source's extent, not an exact landing point.
        if (location.radiusKm) {
          const vertices: THREE.Vector3[] = [];
          for (let i = 0; i <= 96; i++) {
            const angle = (i / 96) * Math.PI * 2,
              x = p.x + (Math.cos(angle) * location.radiusKm) / 30,
              z = p.z + (Math.sin(angle) * location.radiusKm) / 30;
            if (Math.abs(x) < 5 && Math.abs(z) < 5)
              vertices.push(
                new THREE.Vector3(x, terrain.heightAt(x, z) + 0.008, z),
              );
          }
          const geometry = new THREE.BufferGeometry().setFromPoints(vertices);
          const lineMaterial = new THREE.LineDashedMaterial({
            color: COLORS[location.status],
            transparent: true,
            opacity: 0.28,
            dashSize: 0.06,
            gapSize: 0.04,
          });
          const line = new THREE.Line(geometry, lineMaterial);
          line.computeLineDistances();
          surfaceMarkers.add(line);
          transientDisposers.push(() => {
            geometry.dispose();
            lineMaterial.dispose();
          });
        }
      }
    }
    if (state.showConnections && state.selectedLocationId) {
      const primary = locations.find((l) => l.id === state!.selectedLocationId);
      if (primary)
        for (const location of locations) {
          if (location.id !== primary.id)
            curve(locationWorld(primary), locationWorld(location), linksGroup);
        }
    }
    if (terrain && surfacePoint) {
      for (const item of state.infrastructure) {
        const anchor = locations.find(
          (l) => l.id === item.placement.anchorLocationId,
        );
        if (!anchor || !hasRegionalTerrain(anchor)) continue;
        const p = surfacePoint(anchor.lat!, anchor.lon!);
        // Offsets are explicitly conceptual diagram units, not construction coordinates.
        const x = p.x + item.placement.offset[0] * 0.5,
          z = p.z + item.placement.offset[1] * 0.5;
        if (Math.abs(x) > 4.8 || Math.abs(z) > 4.8) continue;
        const y = terrain.heightAt(x, z);
        const symbol = infrastructureSymbol(item);
        symbol.group.position.set(x, y + 0.025, z);
        symbolGroup.add(symbol.group);
        transientDisposers.push(symbol.dispose);
        addLabel(
          item.name,
          item.id,
          new THREE.Vector3(x, y + 0.3, z),
          "surface",
          item.id === state.selectedInfrastructureId,
          item.stage === "demonstrated"
            ? "#8fd6b5"
            : item.stage === "planned"
              ? "#e7c384"
              : "#99adbd",
          "infrastructure",
        );
        if (
          state.showConnections &&
          item.placement.kind === "conceptual-layout"
        )
          curve(
            new THREE.Vector3(p.x, terrain.heightAt(p.x, p.z) + 0.015, p.z),
            new THREE.Vector3(x, y + 0.04, z),
            surfaceLinks,
            true,
          );
      }
    }
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }

  function loadSurface() {
    if (terrainPromise) return;
    const status = document.createElement("div");
    status.textContent = "Loading lunar terrain";
    status.setAttribute("role", "status");
    status.style.cssText =
      "position:absolute;left:22px;top:65px;color:#9aa3ad;font:10px ui-monospace,monospace";
    overlay.append(status);
    terrainPromise = import("./terrain")
      .then(async (module) => {
        const loader = new THREE.TextureLoader();
        const results = await Promise.allSettled([
          module.loadLunarTerrain(),
          loader.loadAsync("/textures/atlas-moon-south-color.webp"),
          loader.loadAsync("/textures/atlas-moon-south-normal.webp"),
          bodies.loadMoonColor(),
        ]);
        const [terrainResult, colorResult, normalResult, surroundResult] =
          results;
        if (
          disposed ||
          terrainResult.status === "rejected" ||
          colorResult.status === "rejected" ||
          normalResult.status === "rejected" ||
          surroundResult.status === "rejected"
        ) {
          if (terrainResult.status === "fulfilled")
            terrainResult.value.dispose();
          if (colorResult.status === "fulfilled") colorResult.value.dispose();
          if (normalResult.status === "fulfilled") normalResult.value.dispose();
          if (!disposed) throw new Error("Lunar assets unavailable");
          return;
        }
        const loaded = terrainResult.value,
          color = colorResult.value,
          normalMap = normalResult.value;
        terrain = loaded;
        surfacePoint = module.lunarSurfacePoint;
        color.colorSpace = THREE.SRGBColorSpace;
        color.anisotropy = 4;
        normalMap.colorSpace = THREE.NoColorSpace;
        normalMap.anisotropy = 4;
        const material = new THREE.MeshStandardMaterial({
          color: "#dedbd5",
          map: color,
          normalMap,
          roughness: 1,
          metalness: 0,
        });
        const mesh = new THREE.Mesh(loaded.geometry, material);
        mesh.receiveShadow = true;
        mesh.castShadow = true;
        surface.add(mesh);
        const surroundMap = surroundResult.value;
        surroundMap.colorSpace = THREE.SRGBColorSpace;
        surroundMap.anisotropy = 4;
        const surroundMaterial = new THREE.MeshStandardMaterial({
          color: "#dedbd5",
          map: surroundMap,
          roughness: 1,
        });
        const surround = new THREE.Mesh(
          loaded.surroundingGeometry,
          surroundMaterial,
        );
        surround.receiveShadow = true;
        surface.add(surround);
        resourceDisposers.push(() => {
          color.dispose();
          normalMap.dispose();
          material.dispose();
          surroundMaterial.dispose();
          loaded.dispose();
        });
        metric.terrainReady = true;
        rebuild();
        frameView();
        callbacks.onReady();
      })
      .catch(() => {
        if (!disposed)
          callbacks.onError(
            "Lunar terrain could not load. Retry the 3D view, or continue exploring the site evidence.",
          );
      })
      .finally(() => status.remove());
  }
  function frameView() {
    if (!state) return;
    const selected = state.locations.find(
      (l) => l.id === state!.selectedLocationId,
    );
    const isSurface = view === "surface";
    system.visible = !isSurface;
    surface.visible = isSurface;
    sunlight.visible = !isSurface;
    terrainLight.visible = isSurface;
    renderer.shadowMap.enabled = isSurface;
    ambient.intensity = isSurface ? 0.27 : 0.23;
    stars.visible = !isSurface;
    controls.minPolarAngle = isSurface ? 0.12 : 0.01;
    controls.maxPolarAngle = isSurface ? Math.PI * 0.47 : Math.PI - 0.01;
    controls.minDistance = isSurface ? 1.1 : view === "moon" ? 0.72 : 2.4;
    controls.maxDistance = isSurface ? 14 : 26;
    if (isSurface) {
      loadSurface();
      goalTarget.set(0, -0.04, 0);
      if (selected && hasRegionalTerrain(selected) && surfacePoint) {
        const p = surfacePoint(selected.lat!, selected.lon!);
        goalTarget.set(p.x, terrain?.heightAt(p.x, p.z) ?? 0, p.z);
      }
      const chosen = state.infrastructure.find(
        (item) => item.id === state!.selectedInfrastructureId,
      );
      if (chosen) {
        goalTarget.x += chosen.placement.offset[0] * 0.5;
        goalTarget.z += chosen.placement.offset[1] * 0.5;
        goalTarget.y = terrain?.heightAt(goalTarget.x, goalTarget.z) ?? 0;
      }
      goalPosition
        .copy(goalTarget)
        .add(
          chosen
            ? new THREE.Vector3(0.8, 0.65, 1.2)
            : new THREE.Vector3(1.6, 1.6, 3.6),
        );
    } else if (view === "system") {
      goalTarget.set(0.1, 0, 0);
      goalPosition.set(0.4, 2.3, 8.8);
      if (width / height < 1.4) goalPosition.z = 15;
    } else {
      const earth = view === "earth",
        group = earth ? bodies.earth : bodies.moon;
      goalTarget.copy(group.position);
      const radius = earth ? EARTH_RADIUS : MOON_RADIUS;
      const direction =
        selected?.body === view
          ? geographicPoint(1, selected.lat!, selected.lon!).applyQuaternion(
              group.quaternion,
            )
          : new THREE.Vector3(0.1, 0.24, 1).normalize();
      goalPosition
        .copy(goalTarget)
        .addScaledVector(direction, radius * (width / height < 1 ? 4.7 : 3.8));
      bodies.detail(earth ? "earth" : "moon");
    }
    startPosition.copy(camera.position);
    startTarget.copy(controls.target);
    transitionStarted = performance.now();
    transition = true;
    renderer.shadowMap.needsUpdate = true;
    invalidate();
  }
  camera.position.set(1.2, 3.3, 14.8);
  controls.target.set(0.1, 0, 0);
  controls.update();
  resize();
  return {
    update(next) {
      const changedView =
        !state ||
        state.view !== next.view ||
        state.selectedLocationId !== next.selectedLocationId ||
        state.selectedInfrastructureId !== next.selectedInfrastructureId;
      const changedData =
        !state ||
        state.locations !== next.locations ||
        state.infrastructure !== next.infrastructure ||
        state.showConnections !== next.showConnections ||
        state.selectedLocationId !== next.selectedLocationId ||
        state.selectedInfrastructureId !== next.selectedInfrastructureId;
      state = next;
      view = next.view;
      metric.view = view;
      if (changedData) rebuild();
      if (changedView) frameView();
      invalidate();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      raf = 0;
      resizeObserver.disconnect();
      intersection.disconnect();
      controls.dispose();
      document.removeEventListener("visibilitychange", visibilityChanged);
      canvas.removeEventListener("keydown", keyboard);
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      disposeTransient();
      resourceDisposers.forEach((dispose) => dispose());
      bodies.dispose();
      terrainLight.shadow.map?.dispose();
      renderer.dispose();
      delete (canvas as HTMLCanvasElement & { __atlas?: unknown }).__atlas;
      canvas.remove();
      overlay.remove();
    },
  };
}
