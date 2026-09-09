export const LUNAR_RADIUS_KM = 1737.4;
export const SURFACE_KM_PER_UNIT = 30;
export const SOUTH_POLE_WIDTH_KM = 303.36;

/** South polar stereographic coordinates, north along negative Z. */
export function lunarSurfacePoint(latitude: number, longitude: number) {
  const radius =
    2 * LUNAR_RADIUS_KM * Math.tan(((90 + latitude) * Math.PI) / 360);
  const angle = (longitude * Math.PI) / 180;
  return {
    x: (radius * Math.sin(angle)) / SURFACE_KM_PER_UNIT,
    z: (-radius * Math.cos(angle)) / SURFACE_KM_PER_UNIT,
  };
}

export function isOnLunarTerrain(x: number, z: number) {
  const half = SOUTH_POLE_WIDTH_KM / SURFACE_KM_PER_UNIT / 2;
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Math.abs(x) <= half &&
    Math.abs(z) <= half
  );
}

export function hasRegionalTerrain(location: {
  body: string;
  lat?: number;
  lon?: number;
}) {
  if (
    location.body !== "moon" ||
    location.lat === undefined ||
    location.lon === undefined ||
    location.lat > -80
  )
    return false;
  const { x, z } = lunarSurfacePoint(location.lat, location.lon);
  return isOnLunarTerrain(x, z);
}
