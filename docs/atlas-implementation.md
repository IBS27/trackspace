# Atlas implementation

The requested outcome is a connected Earth–Moon atlas with realistic lunar terrain,
capability and milestone exploration, recent-event context, and infrastructure filters.
Completion requires browser verification and correction of visible defects.

## Completed

- [x] Atlas selections and dependency context derived from the existing dataset.
- [x] Earth–Moon, Earth, Moon, and south-pole views with camera transitions.
- [x] Source-backed lunar imagery and LOLA terrain.
- [x] Demonstrated, planned, and conceptual infrastructure filters.
- [x] Scene selections, evidence drawers, and recent changes connected.
- [x] Demand rendering, adaptive detail, disposal and failure handling.
- [x] TypeScript, lint, and meaningful behavior tests.
- [x] Desktop and mobile browser checks, interactions, screenshots, and performance.

## Decisions

- Program relationships are distinct from flight paths. No simulated flight is labeled live.
- Regional placement and infrastructure symbols must not imply an approved base layout.
- Real terrain elevation and illustrative lighting are labeled separately.
- The user authorized starting the dev server on September 5; it runs on port 3000.
- No build or deployment requested.

## Verification record

Verified September 5, 2026 against this checkout at `http://10.2.53.145:3000/`
using the connected collaborative browser, with live Convex data.

- Inspected all four views, selected Earth sites, lunar terrain, VIPER focus,
  conceptual habitat symbols, layer filters, blockers, dependencies, milestones,
  recent events, and evidence drawers. Compared the atlas with the existing
  Dependency Map to retain its black/charcoal surfaces, compact typography,
  restrained cyan accents, and fine borders.
- Inspected 1440 × 900 desktop and 390 × 844 mobile layouts. No horizontal
  document overflow; mobile selections return to the atlas and its view controls.
  Checked keyboard orbit/zoom, scene navigation, and remounting after leaving
  Command Center.
- Deliberately lost and restored the WebGL context. The fallback appeared,
  selections remained accessible, and the terrain recovered with its camera
  intact. Fixed stale GPU-handle disposal warnings; the final recovery produced
  no graphics warnings or application errors.
- `bun run lint`, `bunx --bun tsc --noEmit`, and all 116 tests in 12 files passed.
  Rechecked affected files and the 13 application interaction tests after the
  final mobile navigation change.
- Saved final surface screenshots to `/tmp/trackspace-atlas-desktop.png` and
  `/tmp/trackspace-atlas-mobile.png` in this workspace session.

Performance observations: overview rendering used 15 draw calls; surface views
used 18–26 in the checked default states. Rendering stops when idle, hidden, or
outside the viewport. Pixel ratio is capped at 1.75 with downward adaptation.
Detailed lunar assets load on demand. The surface mesh download is 1,876,816
bytes, 78% smaller than the elevation PNGs it replaces at runtime; its geometry
is verified bit-for-bit by `bun scripts/prepare-lunar-terrain.ts`.

The collaborative preview throttles background animation frames and CSS
animations. Finite drawer animations were advanced to inspect their final state.
This session establishes the tested visual and interaction states, not a reliable
foreground FPS benchmark or a guarantee across every GPU and browser.
