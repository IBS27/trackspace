# Lunar atlas assets

Credit: NASA's Scientific Visualization Studio, NASA/GSFC/LRO/LOLA and the LROC instrument team at Arizona State University.

The assets were prepared on September 5, 2026 from the sources below. Terrain comes from measured lunar elevation. No procedural craters or image-generated terrain are used.

## Global Moon

Source page: https://svs.gsfc.nasa.gov/4720/

- Color: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_16bit_srgb_4k.tif
- Elevation: https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif

`atlas-moon-color.webp` is the 4096 × 2048 December 2025 natural-color rendering map, converted from sRGB TIFF to RGB8 WebP at quality 91. The source combines LROC WAC imagery with monochromatic LOLA albedo at the poles. NASA adjusted exposure, white balance, and missing pixels for visualization; this is not an unprocessed scientific color product.

`atlas-moon-height.png` is a 2048 × 1024 lossless elevation raster. The source is 5760 × 2880 unsigned 16-bit data. Elevations were resampled in floating point with Lanczos, rounded to half-meters, and packed into RGB8 as described below.

`atlas-moon-normal.webp` is a 4096 × 2048 tangent-space normal map, derived from the same elevation source after Lanczos resampling. Longitude derivatives account for latitude-dependent pixel spacing on a sphere of radius 1737.4 km. It uses a physical height scale of 1 and RGB WebP quality 96. Use as a non-color texture, with normalScale 1 for unexaggerated slopes. No albedo values are used to generate normals.

All global maps are equirectangular. Longitude 0° is at horizontal center; east increases to the right. North is at the top. For pixel-center sampling use `x = ((longitude + 180) / 360) * width - 0.5` and `y = ((90 - latitude) / 180) * height - 0.5`. Wrap X and clamp Y.

## Lunar south pole

- Elevation: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_40m.img
- Metadata: https://pds-geosciences.wustl.edu/lro/lro-l-lola-3-rdr-v1/lrolol_1xxx/data/lola_gdr/polar/img/ldem_85s_40m.lbl

Product `LDEM_85S_40M`, version 2.0, was created June 15, 2017 from LOLA observations through February 2, 2017. The raw file is 7584 × 7584 little-endian signed 16-bit half-meter elevations above a 1737.4 km sphere. Its polar stereographic pixels are 40 meters apart at the pole. The complete square spans 303.36 km. Edges at their midpoints reach approximately 85°S; corners extend farther north. The height grid includes interpolation between laser observations.

`atlas-moon-south-height.png` is that raster resampled with Lanczos to 2048 × 2048, with 148.125-meter pixel spacing at the pole, then encoded losslessly as RGB8. The height range after resampling is -5.499 to +7.0265 km. It retains the same encoding as the global raster.

`atlas-moon-south-normal.webp` is a 2048 × 2048 lossless tangent-space normal map generated from the resampled elevations, with true horizontal and vertical scales. It records residual detail relative to the 256-segment terrain mesh, so broad crater slopes are not counted twice. Fine terrain normals are projected into a tangent basis derived from a bilinear reconstruction of the mesh elevations, including curvature. Tangent +X points to image right, tangent +Y to image top, and +Z outward. Use normalScale 1 with the displaced mesh.

`atlas-moon-south-color.webp` is a 2048 × 2048 reprojection of the global albedo onto the south-polar grid, with bilinear interpolation and WebP quality 90. Its source polar albedo is low resolution. The image does not imply additional high-resolution surface photography.

Use these coordinates, with lengths in kilometers and angles in radians:

```text
rho = 2 * 1737.4 * tan((pi / 2 + latitude) / 2)
east = rho * sin(longitude)
north = rho * cos(longitude)
u = 0.5 + east / 303.36
v = 0.5 - north / 303.36
pixelX = u * width - 0.5
pixelY = v * height - 0.5
```

Locations with either UV coordinate outside [0, 1] lie outside the raster and should remain in the globe view. The scene uses 30 km per unit and negative Z for north. Surface curvature is approximated by subtracting `(east² + north²) / (2 * 1737.4)` kilometers from elevation. There is no vertical exaggeration.

## Elevation PNG encoding

Both elevation PNGs store unsigned integer half-meters offset by 10 km, split across red and green. Blue is zero. These are data images, with no ICC or gamma profile.

```text
encoded = red * 256 + green
heightKm = encoded / 2000 - 10
```

Read original-size pixels through canvas or an image decoder. Decode each of the four neighboring pixels before bilinear interpolation; do not rescale the RGB image or use it directly as a grayscale bump map. Both packed PNGs were decoded after saving and verified to match every encoded height value exactly.

The regional surface mesh uses 256 segments per side, 66,049 vertices and 131,072 triangles. `heightAt` samples the rendered triangles for marker placement. A separate surrounding mesh extends the landscape to a 1000 km square using the global elevation raster, with 24 progressively coarser rings and 49,152 triangles. It has a hole for the regional mesh and shares its exact boundary positions and normals. The difference between the two elevation products blends out over 35 km beyond the regional edge. The surrounding mesh uses global equirectangular color coordinates, with duplicated vertices at longitude 180° to preserve the texture seam.

## Runtime terrain mesh

`atlas-lunar-terrain.bin` contains the exact terrain geometry prepared from the two elevation PNGs. Rebuild it with `bun scripts/prepare-lunar-terrain.ts`. The script reads the bundled PNGs with Bun's built-in zlib support and uses `scripts/lib/lunar-terrain-source.ts` to construct the measured terrain. It requires no image-processing package or browser.

The binary is 1,876,816 bytes, 78% smaller than the two elevation PNGs combined. Its gzip estimate is 1,504,347 bytes; actual transport compression depends on the server. The runtime caches only this 1.8 MiB buffer, then creates typed-array geometry attributes. It does not download or decode the elevation PNGs, retain the 12 MiB elevation rasters, sample elevation images, or calculate terrain normals. South-pole color and normal textures still load only when entering the surface view.

The format is little-endian. A 32-byte header holds eight uint32 values: magic `0x4e52544c`, version 1, 256 regional segments, 24 outer rings, 66,049 regional vertices, 25,625 outer vertices, and two reserved zeros. Subsequent float32 arrays hold regional Y positions, regional XYZ normals, outer XYZ positions, outer XYZ normals, and outer UV coordinates. Regional X/Z coordinates and UVs are reconstructed with the same Three.js plane geometry. Both index buffers are deterministic and reconstructed without changing their triangle order.

The preparation script compares every decoded position, normal, UV, and index against the source geometry, including exact regional boundary positions and normals. It also checks 100 marker heights against raycast intersections before saving the asset.
