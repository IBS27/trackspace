import * as THREE from "three";

import { SURFACE_KM_PER_UNIT, SOUTH_POLE_WIDTH_KM } from "./projection";
export { lunarSurfacePoint, isOnLunarTerrain } from "./projection";

const SEGMENTS = 256;
const RINGS = 24;
const REGIONAL_VERTICES = (SEGMENTS + 1) ** 2;
const OUTER_STRIDE = SEGMENTS * 4 + 1;
const OUTER_VERTICES = (RINGS + 1) * OUTER_STRIDE;
const HEADER_BYTES = 32;
const TERRAIN_BYTES = HEADER_BYTES + REGIONAL_VERTICES * 16 + OUTER_VERTICES * 32;

export type LunarTerrain = {
  geometry: THREE.BufferGeometry;
  surroundingGeometry: THREE.BufferGeometry;
  heightAt: (x: number, z: number) => number;
  dispose: () => void;
};

let terrainBytes: Promise<ArrayBuffer> | undefined;

export async function loadLunarTerrain(): Promise<LunarTerrain> {
  terrainBytes ??= fetch("/textures/atlas-lunar-terrain.bin")
    .then((response) => {
      if (!response.ok) throw new Error("Lunar terrain could not be loaded.");
      return response.arrayBuffer();
    })
    .catch((error: unknown) => {
      terrainBytes = undefined;
      throw error;
    });
  const buffer = await terrainBytes;
  try {
    return decodeLunarTerrain(buffer);
  } catch (error) {
    terrainBytes = undefined;
    throw error;
  }
}

/** Decode the mesh format produced by scripts/prepare-lunar-terrain.ts. */
export function decodeLunarTerrain(buffer: ArrayBuffer): LunarTerrain {
  if (buffer.byteLength !== TERRAIN_BYTES) throw new Error("Invalid lunar terrain data length.");
  const header = new DataView(buffer, 0, HEADER_BYTES);
  if (
    header.getUint32(0, true) !== 0x4e52544c ||
    header.getUint32(4, true) !== 1 ||
    header.getUint32(8, true) !== SEGMENTS ||
    header.getUint32(12, true) !== RINGS ||
    header.getUint32(16, true) !== REGIONAL_VERTICES ||
    header.getUint32(20, true) !== OUTER_VERTICES
  ) throw new Error("Unsupported lunar terrain data format.");

  let offset = HEADER_BYTES;
  const readFloats = (count: number) => {
    const values = new Float32Array(buffer, offset, count);
    offset += count * Float32Array.BYTES_PER_ELEMENT;
    return values;
  };
  const heights = readFloats(REGIONAL_VERTICES);
  const regionalNormals = readFloats(REGIONAL_VERTICES * 3);
  const outerPositions = readFloats(OUTER_VERTICES * 3);
  const outerNormals = readFloats(OUTER_VERTICES * 3);
  const outerUvs = readFloats(OUTER_VERTICES * 2);

  const width = SOUTH_POLE_WIDTH_KM / SURFACE_KM_PER_UNIT;
  const geometry = new THREE.PlaneGeometry(width, width, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);
  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) positions.setY(i, heights[i]);
  positions.needsUpdate = true;
  geometry.setAttribute("normal", new THREE.BufferAttribute(regionalNormals, 3));
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const surroundingGeometry = new THREE.BufferGeometry();
  surroundingGeometry.setAttribute("position", new THREE.BufferAttribute(outerPositions, 3));
  surroundingGeometry.setAttribute("normal", new THREE.BufferAttribute(outerNormals, 3));
  surroundingGeometry.setAttribute("uv", new THREE.BufferAttribute(outerUvs, 2));
  const indices = new Uint16Array(RINGS * (OUTER_STRIDE - 1) * 6);
  let indexOffset = 0;
  for (let ring = 0; ring < RINGS; ring++) {
    for (let i = 0; i < OUTER_STRIDE - 1; i++) {
      const index = ring * OUTER_STRIDE + i;
      const outer = index + OUTER_STRIDE;
      indices[indexOffset++] = index;
      indices[indexOffset++] = index + 1;
      indices[indexOffset++] = outer;
      indices[indexOffset++] = index + 1;
      indices[indexOffset++] = outer + 1;
      indices[indexOffset++] = outer;
    }
  }
  surroundingGeometry.setIndex(new THREE.BufferAttribute(indices, 1));
  surroundingGeometry.computeBoundingBox();
  surroundingGeometry.computeBoundingSphere();

  // Match the rendered triangles exactly so markers cannot sink into coarse cells.
  const heightAt = (x: number, z: number) => {
    const column = THREE.MathUtils.clamp(
      (x / width + 0.5) * SEGMENTS,
      0,
      SEGMENTS,
    );
    const row = THREE.MathUtils.clamp(
      (z / width + 0.5) * SEGMENTS,
      0,
      SEGMENTS,
    );
    const left = Math.min(Math.floor(column), SEGMENTS - 1);
    const top = Math.min(Math.floor(row), SEGMENTS - 1);
    const tx = column - left;
    const tz = row - top;
    const a = top * (SEGMENTS + 1) + left;
    const b = a + SEGMENTS + 1;
    if (tx + tz <= 1) {
      return (
        positions.getY(a) * (1 - tx - tz) +
        positions.getY(a + 1) * tx +
        positions.getY(b) * tz
      );
    }
    return (
      positions.getY(b + 1) * (tx + tz - 1) +
      positions.getY(a + 1) * (1 - tz) +
      positions.getY(b) * (1 - tx)
    );
  };

  return {
    geometry,
    surroundingGeometry,
    heightAt,
    dispose: () => {
      geometry.dispose();
      surroundingGeometry.dispose();
    },
  };
}
