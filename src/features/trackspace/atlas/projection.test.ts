import { describe, expect, it } from 'vitest';
import { hasRegionalTerrain, lunarSurfacePoint } from './projection';

describe('lunar terrain coverage', () => {
  it('includes PRIME-1 in the square raster although it is north of 85°S', () => {
    expect(hasRegionalTerrain({ body:'moon', lat:-84.7, lon:24.1 })).toBe(true);
    expect(hasRegionalTerrain({ body:'moon', lat:-85.65, lon:31.9 })).toBe(true);
  });
  it('keeps Mare Crisium and locations outside the raster in globe views', () => {
    expect(hasRegionalTerrain({ body:'moon', lat:18.56, lon:61.81 })).toBe(false);
    expect(hasRegionalTerrain({ body:'moon', lat:-82, lon:0 })).toBe(false);
    expect(hasRegionalTerrain({ body:'earth', lat:-90, lon:0 })).toBe(false);
    expect(hasRegionalTerrain({ body:'moon' })).toBe(false);
  });
  it('places the pole at the origin and north along negative Z', () => {
    const pole=lunarSurfacePoint(-90,0);
    expect(pole.x).toBeCloseTo(0);expect(pole.z).toBeCloseTo(0);
    expect(lunarSurfacePoint(-88,0).z).toBeLessThan(0);
    expect(lunarSurfacePoint(-88,90).x).toBeGreaterThan(0);
  });
});
