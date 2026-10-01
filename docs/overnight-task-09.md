# Overnight task 09: Trackspace cleanup

## Status

Implementation committed. Preview setup and coordinator final-commit computer-use verification are blocked by the missing Convex URL. Draft PR publication is pending that verification. This change is not ready for publication or merge.

## Checkout and commits

- Machine: `fedora`, Fedora Linux 43. Tailscale address verified as `100.84.133.110`.
- Worktree: `/home/srinivasib/.t3/worktrees/trackspace/overnight-09`.
- Branch: `overnight/task-09-trackspace-cleanup`.
- Base: `77cfcb0d430fb7605928eb0516e8b017c013a2fa`.
- Implementation: `7d40bfa167d0c7ad90ef731dcf63fc753fb4e002`, `refactor(trackspace): remove unused program risk calculations`.
- The separate documentation commit contains this report. Resolve its exact SHA with `git log -1 --format=%H -- docs/overnight-task-09.md`; the handoff supplies it too. Coordinator verification must cover that final branch commit.

No additional agents were spawned. All changes stayed in this worktree. The runtime does not expose a control to verify or switch the requested GPT-6.1 Sol High FAST priority configuration, so that configuration is not attested.

## Scope and evidence

Removed 189 lines across four files:

- Unused numeric risk score, score bands, risk register, matrix, and their constants/types from `data/selectors.ts`.
- Unused `components/RiskChip.tsx` and its sole CSS rule.
- Six tests and imports that only exercised the removed calculations.

Before removal, repository searches found only test callers for the numeric risk functions, and no callers for `RiskChip`. After removal, searches across `src`, `convex`, and `scripts` found no remaining references to the removed symbols or CSS class.

The active Program screen uses `getProgramRegister` and `getProgramSummary`, ranking by shared capability status and displaying funding and schedule signals. The capability drawer displays provider, contract, funding, target, and slip. Neither displays numeric risk scores or the removed chip.

Risk assessments remain in the curated dataset, TypeScript content types, and Convex validators. The historical overview proposes a risk register; this patch removes its unused implementation without changing those stored assessments. All active selectors, screens, drawer interactions, and regression tests remain.

Review covered app loading and live-data fallback, navigation and briefing, all five screens, evidence drawers, atlas selection/rendering/resource cleanup, ingestion/authentication, triage validation and persistence, schema/validators, scripts, dependencies, and test coverage. Backend functions callable outside the app, runtime-specific authentication implementations, atlas failure recovery, and useful regression coverage were retained. Other possible cleanup was deferred to keep this patch coherent. No dependency, schema, ingestion, security, or visual redesign changes.

## Checks

Existing locked dependencies installed with `bun install --frozen-lockfile`; package files and lockfile are unchanged. Host Bun is `1.4.0`, within the project's declared `1.x` engine range.

| Check | Result |
| --- | --- |
| `bun run lint` | Passed before and after cleanup |
| `bun run --bun tsc --noEmit` | Passed before and after cleanup |
| `bun run --bun tsc --noEmit -p convex/tsconfig.json` | Passed before and after cleanup |
| `bun run test -- --run` | Failed before cleanup: all 12 fork workers timed out before executing tests |
| `bun run test -- --run --pool=threads` before cleanup | Passed: 12 files, 118 tests |
| `bun run test -- --run --pool=threads src/features/trackspace/data/selectors.test.ts src/features/trackspace/screens/ProgramScreen.test.tsx src/features/trackspace/TrackspaceApp.test.tsx` | Passed after cleanup: 3 files, 50 tests |
| `bun run test -- --run --pool=threads` after cleanup | Passed: 12 files, 112 tests |
| Final diff review and `git diff --check` | Passed; implementation is deletion-only |
| Production build | Not run, prohibited by task instructions |
| Backend watcher/deployment or live writes | Not run |
| Coordinator final-commit computer use | Not run, pending working preview |
| Draft PR publication | Not run, waiting for coordinator verification |

The test runs also report a Vite warning that native tsconfig path resolution can replace the installed plugin. Test configuration was left unchanged. The thread-worker option avoids the observed fork startup failure.

## Preview and coordinator handoff

No task preview has been started. Exact port: none. This checkout has only an empty `.env.example`; no Convex URL is inherited. `ConvexClientProvider` requires `NEXT_PUBLIC_CONVEX_URL`, so an unconfigured server cannot render the intended dashboard. An approved existing configuration path was requested without reading another worktree or exposing secrets.

Once configuration is supplied, use the remote-preview helper to start this checkout's frontend in one dedicated tmux session, bound only to `100.84.133.110`. Report the helper's exact URL, port, and preview ID. Do not start a Convex watcher or run ingestion. Keep the preview alive for review.

Coordinator computer-use checks on the final commit:

1. Open the preview from the Mac and dismiss the briefing.
2. Open Program. Exercise Needs attention, Schedule signals, Funding signals, Stable, and All tracked; confirm counts and visible records.
3. Open a capability row. Inspect funding/schedule details and source links, then close the drawer.
4. Compare Program with neighboring Command Center and Milestones screens for layout and styling.
5. Reload, return to Program, and confirm navigation and drawers remain usable. Record the tested commit and any browser errors.

Known limits: browser rendering, Mac reachability, and the final user flow remain unverified. Static caller checks and passing component tests support this cleanup, but they do not replace the required computer-use check.

## Draft PR text

Title: `Remove unused Trackspace program risk calculations`

Body:

The Program screen ranks capabilities by shared status and displays funding and schedule signals. Remove the unused numeric risk register and matrix, their test-only calculations, and the unreferenced RiskChip component and CSS. Keep stored risk assessments and all active dashboard regression coverage.

Validation: app and Convex typechecks, lint, 50 focused tests, and the full 112-test suite pass. Tests used `--pool=threads` because the baseline default fork workers timed out before executing tests. No production build or backend deployment was run.

Coordinator final-commit computer-use verification is pending. Add its result and tested SHA before publishing this draft PR.
