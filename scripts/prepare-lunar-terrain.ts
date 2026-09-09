/** Rebuild with: bun scripts/prepare-lunar-terrain.ts */
import { readFile, writeFile } from "node:fs/promises";
import { gzipSync, inflateSync } from "node:zlib";
import * as THREE from "three";

import { buildLunarTerrain, type HeightRaster } from "./lib/lunar-terrain-source";
import { decodeLunarTerrain } from "../src/features/trackspace/atlas/terrain";

/** Read our lossless RGB8 PNG source rasters without browser or image dependencies. */
async function readPackedHeight(path: string): Promise<HeightRaster> {
  const png = await readFile(path);
  if (png.subarray(0, 8).toString("hex") !== "89504e470d0a1a0a") {
    throw new Error(`Invalid PNG: ${path}`);
  }
  let width = 0;
  let height = 0;
  const compressed: Buffer[] = [];
  for (let offset = 8; offset + 12 <= png.length; ) {
    const size = png.readUInt32BE(offset);
    const type = png.toString("ascii", offset + 4, offset + 8);
    const chunk = png.subarray(offset + 8, offset + 8 + size);
    if (chunk.length !== size) throw new Error(`Truncated PNG: ${path}`);
    if (type === "IHDR") {
      width = chunk.readUInt32BE(0);
      height = chunk.readUInt32BE(4);
      if (chunk[8] !== 8 || chunk[9] !== 2 || chunk[10] || chunk[11] || chunk[12]) {
        throw new Error(`Expected non-interlaced RGB8 PNG: ${path}`);
      }
    }
    if (type === "IDAT") compressed.push(chunk);
    if (type === "IEND") break;
    offset += size + 12;
  }
  const raw = inflateSync(Buffer.concat(compressed));
  const stride = width * 3;
  if (!width || !height || raw.length !== (stride + 1) * height) {
    throw new Error(`Invalid PNG dimensions: ${path}`);
  }
  const pixels = new Uint8Array(width * height * 3);
  for (let row = 0; row < height; row++) {
    const source = row * (stride + 1);
    const filter = raw[source];
    if (filter > 4) throw new Error(`Unsupported PNG filter: ${filter}`);
    for (let column = 0; column < stride; column++) {
      const index = row * stride + column;
      const left = column >= 3 ? pixels[index - 3] : 0;
      const above = row ? pixels[index - stride] : 0;
      const upperLeft = row && column >= 3 ? pixels[index - stride - 3] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      if (filter === 2) predictor = above;
      if (filter === 3) predictor = Math.floor((left + above) / 2);
      if (filter === 4) {
        const p = left + above - upperLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - above);
        const pc = Math.abs(p - upperLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? above : upperLeft;
      }
      pixels[index] = raw[source + 1 + column] + predictor;
    }
  }
  const values = new Uint16Array(width * height);
  for (let i = 0; i < values.length; i++) values[i] = pixels[i * 3] * 256 + pixels[i * 3 + 1];
  return { values, width, height };
}

const [regionalRaster, globalRaster] = await Promise.all([
  readPackedHeight("public/textures/atlas-moon-south-height.png"),
  readPackedHeight("public/textures/atlas-moon-height.png"),
]);
const original = buildLunarTerrain(regionalRaster, globalRaster);
const regionalPositions = original.geometry.getAttribute("position");
const heights = new Float32Array(regionalPositions.count);
for (let i = 0; i < heights.length; i++) heights[i] = regionalPositions.getY(i);
const arrays = [
  heights,
  original.geometry.getAttribute("normal").array,
  original.surroundingGeometry.getAttribute("position").array,
  original.surroundingGeometry.getAttribute("normal").array,
  original.surroundingGeometry.getAttribute("uv").array,
];
const byteLength = 32 + arrays.reduce((sum, array) => sum + array.byteLength, 0);
const buffer = new ArrayBuffer(byteLength);
const header = new DataView(buffer, 0, 32);
const fields = [0x4e52544c, 1, 256, 24, regionalPositions.count,
  original.surroundingGeometry.getAttribute("position").count, 0, 0];
fields.forEach((value, index) => header.setUint32(index * 4, value, true));
let offset = 32;
for (const array of arrays) {
  if (!(array instanceof Float32Array)) throw new Error("Expected float32 mesh attributes.");
  new Float32Array(buffer, offset, array.length).set(array);
  offset += array.byteLength;
}

const decoded = decodeLunarTerrain(buffer);
for (const key of ["geometry", "surroundingGeometry"] as const) {
  for (const attribute of ["position", "normal", "uv"] as const) {
    const before = original[key].getAttribute(attribute).array;
    const after = decoded[key].getAttribute(attribute).array;
    if (before.length !== after.length) throw new Error(`${key}.${attribute} length changed.`);
    for (let i = 0; i < before.length; i++) {
      if (!Object.is(before[i], after[i])) throw new Error(`${key}.${attribute}[${i}] changed.`);
    }
  }
  const before = original[key].index?.array;
  const after = decoded[key].index?.array;
  if (!before || !after || before.length !== after.length) throw new Error("Invalid mesh indices.");
  for (let i = 0; i < before.length; i++) {
    if (before[i] !== after[i]) throw new Error(`${key} triangle ${i} changed.`);
  }
}

const material = new THREE.MeshBasicMaterial();
const mesh = new THREE.Mesh(decoded.geometry, material);
mesh.updateMatrixWorld();
const ray = new THREE.Raycaster();
for (let i = 0; i < 100; i++) {
  const x = Math.sin(i * 23.5) * 4.9;
  const z = Math.cos(i * 12.2) * 4.9;
  ray.set(new THREE.Vector3(x, 10, z), new THREE.Vector3(0, -1, 0));
  const hit = ray.intersectObject(mesh)[0];
  if (!hit || Math.abs(hit.point.y - decoded.heightAt(x, z)) > 1e-6) {
    throw new Error(`Marker height differs from terrain at ${x}, ${z}.`);
  }
}
const destination = "public/textures/atlas-lunar-terrain.bin";
await writeFile(destination, new Uint8Array(buffer));
console.log(`${destination}: ${byteLength.toLocaleString()} bytes; gzip estimate ${gzipSync(new Uint8Array(buffer)).byteLength.toLocaleString()} bytes.`);
console.log("Every mesh attribute and index is unchanged; 100 marker/raycast checks passed.");
original.dispose();
decoded.dispose();
material.dispose();
