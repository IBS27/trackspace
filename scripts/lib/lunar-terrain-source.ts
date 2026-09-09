import * as THREE from "three";

import {
  LUNAR_RADIUS_KM,
  SURFACE_KM_PER_UNIT,
  SOUTH_POLE_WIDTH_KM,
} from "../../src/features/trackspace/atlas/projection";

const SEGMENTS = 256;

export type HeightRaster = { values: Uint16Array; width: number; height: number };

/** Offline geometry builder. Keep source elevations out of the browser runtime. */
export function buildLunarTerrain(raster: HeightRaster, globalRaster: HeightRaster) {
  const width = SOUTH_POLE_WIDTH_KM / SURFACE_KM_PER_UNIT;
  const geometry = new THREE.PlaneGeometry(width, width, SEGMENTS, SEGMENTS);
  geometry.rotateX(-Math.PI / 2);

  const sampleElevation = (x: number, z: number) => {
    // Raster values describe pixel centers, so geographic UVs need half a pixel.
    const column = THREE.MathUtils.clamp(
      (x / width + 0.5) * raster.width - 0.5,
      0,
      raster.width - 1,
    );
    const row = THREE.MathUtils.clamp(
      (z / width + 0.5) * raster.height - 0.5,
      0,
      raster.height - 1,
    );
    const left = Math.floor(column);
    const top = Math.floor(row);
    const right = Math.min(left + 1, raster.width - 1);
    const bottom = Math.min(top + 1, raster.height - 1);
    const upper = THREE.MathUtils.lerp(
      raster.values[top * raster.width + left],
      raster.values[top * raster.width + right],
      column - left,
    );
    const lower = THREE.MathUtils.lerp(
      raster.values[bottom * raster.width + left],
      raster.values[bottom * raster.width + right],
      column - left,
    );
    const elevationKm =
      THREE.MathUtils.lerp(upper, lower, row - top) / 2000 - 10;
    const distanceKmSquared = (x * x + z * z) * SURFACE_KM_PER_UNIT ** 2;
    const curvatureKm = distanceKmSquared / (2 * LUNAR_RADIUS_KM);
    return (elevationKm - curvatureKm) / SURFACE_KM_PER_UNIT;
  };

  const positions = geometry.getAttribute("position");
  for (let i = 0; i < positions.count; i++) {
    positions.setY(i, sampleElevation(positions.getX(i), positions.getZ(i)));
  }
  positions.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  const surroundingGeometry = createSurroundingTerrain(geometry, globalRaster);
  return {
    geometry,
    surroundingGeometry,
    dispose: () => {
      geometry.dispose();
      surroundingGeometry.dispose();
    },
  };
}

function createSurroundingTerrain(
  regional: THREE.BufferGeometry,
  raster: HeightRaster,
) {
  const positions = regional.getAttribute("position");
  const regionalNormals = regional.getAttribute("normal");
  const side = SEGMENTS + 1;
  const perimeter: number[] = [];
  for (let i = 0; i < SEGMENTS; i++) perimeter.push(i);
  for (let i = 0; i < SEGMENTS; i++) perimeter.push(i * side + SEGMENTS);
  for (let i = 0; i < SEGMENTS; i++)
    perimeter.push(SEGMENTS * side + SEGMENTS - i);
  for (let i = 0; i < SEGMENTS; i++) perimeter.push((SEGMENTS - i) * side);
  // Start/end at longitude 180°, duplicating its vertices to avoid UV wrapping.
  const seam = SEGMENTS * 2 + SEGMENTS / 2;
  const edge = [...perimeter.slice(seam), ...perimeter.slice(0, seam)];
  edge.push(edge[0]);
  const rings = 24;
  const stride = edge.length;
  const points = new Float32Array((rings + 1) * stride * 3);
  const uv = new Float32Array((rings + 1) * stride * 2);
  const indices: number[] = [];
  const maximumScale = 1000 / SOUTH_POLE_WIDTH_KM;
  const geographicUv = (x: number, z: number) => {
    const rhoKm = Math.hypot(x, z) * SURFACE_KM_PER_UNIT;
    const latitude = 2 * Math.atan(rhoKm / (2 * LUNAR_RADIUS_KM)) - Math.PI / 2;
    return {
      u: 0.5 + Math.atan2(x, -z) / (2 * Math.PI),
      v: 0.5 + latitude / Math.PI,
    };
  };
  const globalHeight = (x: number, z: number) => {
    const { u, v } = geographicUv(x, z);
    const column = u * raster.width - 0.5;
    const row = THREE.MathUtils.clamp(
      (1 - v) * raster.height - 0.5,
      0,
      raster.height - 1,
    );
    const floorColumn = Math.floor(column);
    const left = ((floorColumn % raster.width) + raster.width) % raster.width;
    const right = (left + 1) % raster.width;
    const top = Math.floor(row);
    const bottom = Math.min(top + 1, raster.height - 1);
    const upper = THREE.MathUtils.lerp(
      raster.values[top * raster.width + left],
      raster.values[top * raster.width + right],
      column - floorColumn,
    );
    const lower = THREE.MathUtils.lerp(
      raster.values[bottom * raster.width + left],
      raster.values[bottom * raster.width + right],
      column - floorColumn,
    );
    const elevationKm =
      THREE.MathUtils.lerp(upper, lower, row - top) / 2000 - 10;
    const curvatureKm =
      ((x * x + z * z) * SURFACE_KM_PER_UNIT ** 2) / (2 * LUNAR_RADIUS_KM);
    return (elevationKm - curvatureKm) / SURFACE_KM_PER_UNIT;
  };
  for (let ring = 0; ring <= rings; ring++) {
    // Denser bands at the regional boundary, progressively coarser toward horizon.
    const scale = 1 + (maximumScale - 1) * (ring / rings) ** 1.5;
    for (let i = 0; i < stride; i++) {
      const original = edge[i];
      const edgeX = positions.getX(original);
      const edgeZ = positions.getZ(original);
      const x = edgeX * scale;
      const z = edgeZ * scale;
      const distanceKm = Math.hypot(x - edgeX, z - edgeZ) * SURFACE_KM_PER_UNIT;
      const blend = 1 - THREE.MathUtils.smoothstep(distanceKm, 0, 35);
      const height =
        ring === 0
          ? positions.getY(original)
          : globalHeight(x, z) +
            (positions.getY(original) - globalHeight(edgeX, edgeZ)) * blend;
      const index = ring * stride + i;
      points.set([x, height, z], index * 3);
      const coordinates = geographicUv(x, z);
      uv.set(
        [i === 0 ? 0 : i === stride - 1 ? 1 : coordinates.u, coordinates.v],
        index * 2,
      );
      if (ring < rings && i < stride - 1) {
        const outer = index + stride;
        indices.push(index, index + 1, outer, index + 1, outer + 1, outer);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(points, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const normals = geometry.getAttribute("normal");
  for (let i = 0; i < stride; i++) {
    const original = edge[i];
    normals.setXYZ(
      i,
      regionalNormals.getX(original),
      regionalNormals.getY(original),
      regionalNormals.getZ(original),
    );
  }
  // The longitude seam is duplicated only for UVs; its shading must stay continuous.
  for (let ring = 1; ring <= rings; ring++) {
    const a = ring * stride;
    const b = a + stride - 1;
    const normal = new THREE.Vector3()
      .fromBufferAttribute(normals, a)
      .add(new THREE.Vector3().fromBufferAttribute(normals, b))
      .normalize();
    normals.setXYZ(a, normal.x, normal.y, normal.z);
    normals.setXYZ(b, normal.x, normal.y, normal.z);
  }
  normals.needsUpdate = true;
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}
