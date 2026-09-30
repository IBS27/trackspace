# Overnight task 14: Trackspace performance

## Status and commits

Implementation and measurements are committed. Coordinator Mac computer-use verification is pending. Do not publish the draft PR until the coordinator verifies the final branch commit. No PR has been published.

- Machine: `fedora`, Fedora 43, AMD Ryzen 7 9700X. Bun 1.4.0, React 19.2.4, Vitest 4.1.7.
- Worktree: `/home/srinivasib/.t3/worktrees/trackspace/overnight-14`.
- Branch: `overnight/task-14-trackspace-performance`.
- Base: `c60a5f030fee32fc17ae0b3afee6fa1e0502d475`.
- Implementation and benchmark evidence: `995ec1af75e19489d4f945fbf8ea928d39d11967`.
- This report is a separate documentation commit. Resolve the final verification SHA with `git rev-parse HEAD`; its exact hash is supplied in the handoff. A commit cannot contain its own hash.

Requested GPT-6 Astra High priority configuration was verified externally by the coordinator. No additional agents or threads were spawned. Work stayed in this checkout. Existing locked dependencies were installed with `bun install --frozen-lockfile`; package files are unchanged.

## Finding and change

The UTC clock stored state in `TrackspaceWorkspace`. Every second it recreated the shell, active screen element, briefing, and open drawer. The four non-memoized screens repeated their calculations and React rendering despite unchanged data. Command Center already skipped its content render through `memo`, but the workspace and shell still updated.

Move the same state, formatting, one-second interval, initial `00:00:00` value, and cleanup into `UtcClock` inside `AppShell`. Only the UTC status cell now updates on ticks. Navigation, live dataset propagation, markup, styles, and atlas code remain unchanged.

This removes measurable idle work, but its absolute cost was small on this desktop. No major responsiveness, loading, GPU, battery, or production speed improvement is claimed. The small state-ownership change is justified by eliminating work from every idle tick without adding caches or changing data freshness.

## Measurements

The opt-in benchmark renders the real app and shell with the curated dataset: 20 capabilities, 5 milestones, 16 events, and 9 locations. It uses React's development Profiler under jsdom. Only the WebGL scene is stubbed. Date and intervals are simulated; `performance.now()` remains real. Each scenario gets 20 warm-up ticks and 120 separately flushed measured ticks. Three independent processes measured each version, before any application edit and after the patch.

Values below are the median of three runs. Total render time covers 120 simulated seconds, not 120 seconds of wall time. Timings exclude browser layout, paint, network, and GPU work.

| Scenario | Total React render ms before | After | Median tick ms before | After |
| --- | ---: | ---: | ---: | ---: |
| Command Center | 12.039 | 1.340 | 0.0943 | 0.0096 |
| Dependency Map | 23.035 | 0.916 | 0.1851 | 0.0072 |
| Timeline | 36.076 | 0.831 | 0.2723 | 0.0064 |
| Milestones | 26.333 | 0.695 | 0.2155 | 0.0054 |
| Program | 38.954 | 0.615 | 0.3231 | 0.0049 |
| Dependency Map with drawer | 37.438 | 0.686 | 0.3088 | 0.0054 |

In every run, main-subtree Profiler commits dropped from 120 to 0. Open-drawer commits dropped from 120 to 0. These are subtree commits, not proof that every descendant rendered before the patch. Command Center's existing memoization still applied. The clock itself continued to commit 120 updates. Raw per-run totals, medians, and p95 values are in [performance/task-14-idle-clock.json](performance/task-14-idle-clock.json).

Reproduce from this checkout with existing dependencies:

```sh
# Before: load only the two changed modules from Git in the test transform.
# This does not switch branches, replace source files, or disturb the preview.
TRACKSPACE_BENCH_REF=c60a5f030fee32fc17ae0b3afee6fa1e0502d475 TRACKSPACE_BENCH_OUTPUT=/tmp/task-14-before.json bun run test -- --run --config scripts/performance/vitest.config.mts

# After: use the checked-out source. Run each command three times for comparison.
TRACKSPACE_BENCH_OUTPUT=/tmp/task-14-after.json bun run test -- --run --config scripts/performance/vitest.config.mts
```

The Git-based replay was also run after implementation and reproduced 120 main commits in all six baseline scenarios. The benchmark is excluded from the ordinary test suite by its `.bench.tsx` filename. No timing thresholds were added to CI.

## Review scope and decisions

| Path reviewed | Evidence and decision |
| --- | --- |
| Initial server read and live subscription | One initial dataset query and one client subscription. Five authorized read-only live queries returned 20 capabilities, 58 events, 9 locations, and 5 milestones. First round trip was 177.85 ms; subsequent calls were 65.18, 63.56, 56.81, and 61.77 ms. These are network round trips, not Convex execution times. No fetch strategy change justified. |
| Convex dataset, schema, ingestion and triage readers/writers | Dataset reads are bounded; discovery reads use the status index. Ingestion uses indexed ID lookups; triage is paginated/bounded. No measured contention or read amplification evidence. No backend edits, insights credentials, watchers, ingestion, or mutations used. |
| All five screens, selectors, drawers, briefing, dataset context | Clock-driven work measured above. Current records are small; keep straightforward selectors, filters, and live fallback behavior. No broad memoization or data-index rewrite. |
| Atlas renderer, bodies, terrain, infrastructure, model, assets and styles | Rendering already stops at rest and when hidden. Terrain and detailed textures load on demand; GPU resources have disposal paths. A local decode probe was about 4.43 ms median, outside browser rendering. No frame-rate evidence justifies reducing visual quality or changing geometry/textures. |
| Dependencies and app loading | Three.js scene already uses dynamic loading. Production bundle analysis would require a prohibited build. Unused dependency removal or cosmetic cleanup is outside this measured change. |

## Preserved behavior and checks

The benchmark verifies unchanged main/drawer HTML through 120 ticks, the UTC rollover from 23:58:00 to 00:00:20 after warm-up plus measurement, and interval cleanup on unmount. Existing tests cover navigation, filters, drawers, atlas controls through a WebGL stub, and live-data failure/recovery.

| Check | Result |
| --- | --- |
| `bun run lint` | Passed before and after application change |
| `bun run --bun tsc --noEmit` | Final pass. During benchmark development, failed on a `.mts` import and later an untyped Vite hook parameter; both fixed. |
| `bun run --bun tsc --noEmit -p convex/tsconfig.json` | Passed after application change and on final benchmark source |
| `bun run test -- --run --pool=threads` | Passed before and after: 12 files, 112 tests |
| Opt-in idle benchmark | All six scenarios passed in all three before/after runs; Git baseline replay also passed |
| Diff review and `git diff --check` | Passed |
| Preview HTTP and directly referenced assets | Passed on Fedora: HTTP 200, 23 assets, zero failures |
| Browser rendering, final-commit Mac computer use | Not run here; coordinator owns verification |
| Production build, deployments, live writes, draft PR publication | Not run |

Vite emits its existing notice about native tsconfig path resolution. Test configuration outside the opt-in benchmark remains unchanged. Vitest thread workers are test-runner workers, not additional assistant agents.

## Preview and coordinator handoff

- URL: [http://100.84.133.110:5414/](http://100.84.133.110:5414/).
- Exact port: **5414**, bound only to `100.84.133.110`.
- Preview ID: `0f680b1b7467350ba1a3`; dedicated helper-owned tmux session. Leave running for review.
- Frontend command: `bun run dev --hostname 100.84.133.110 --port 5414`.
- `TRACKSPACE_DEV_ORIGINS=100.84.133.110`; existing ignored `.env.local` supplies the public Convex URL. No secrets recorded.
- Status: `python3 /home/srinivasib/.agents/skills/remote-preview/scripts/preview.py status 0f680b1b7467350ba1a3`.

Coordinator checks on the final handoff SHA:

1. Open the private preview on the Mac, dismiss briefing, and confirm UTC ticks while Next Gate and connection status remain visible.
2. Switch through all five tabs and keyboard shortcuts. Exercise dependency/timeline filters, milestone selection, and Program lenses. Compare neighboring screens for unchanged layout.
3. Open evidence, wait for several clock ticks, follow an internal related-record link, and close with Escape. Confirm the selected screen/filter remains usable.
4. In Command Center, select a site, switch atlas viewpoints, open evidence, clear selection, and reload. Confirm no hydration or browser errors.
5. Return the exact tested SHA and result before draft publication.

Remaining limits: browser layout, GPU behavior, Mac reachability, and end-to-end interaction are unverified until that check. The reproducible CPU result uses the fixed curated dataset, not the changing live snapshot.

## Prepared draft PR

Title: `Isolate Trackspace UTC clock updates from dashboard rendering`

Body:

The header clock updated workspace state once per second, rerendering the shell, non-memoized screens, and open drawers even when their data was unchanged. Move the unchanged clock logic into the UTC status cell so those subtrees stay idle between user actions and live updates.

An opt-in React Profiler benchmark records three before/after runs on the curated dataset. Main-subtree commits fell from 120 to 0 over 120 simulated ticks; open-drawer commits also fell from 120 to 0. Program's total measured React render time fell from 38.954 ms to 0.615 ms. This is a small idle CPU reduction, not a browser frame-rate or load-time claim. The benchmark can replay the original modules from Git without switching checkouts.

Validation: lint, app and Convex typechecks, all 112 existing tests, clock rollover/cleanup and unchanged screen/drawer markup checks pass. Measurements and reproduction commands are in `docs/overnight-task-14.md`. No production build or backend deployment was run.

Coordinator final-commit Mac computer-use verification is pending. Replace this sentence with its result and tested SHA before publishing the draft.
