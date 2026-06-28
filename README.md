# Trackspace

Trackspace is a Next.js dashboard for tracking NASA's path from Artemis missions toward a sustained lunar base.

It connects milestones, required capabilities, dependencies, spatial context, and source-backed evidence so lunar progress is easy to understand. The experience is a 3D Earth/Moon command view, a capability dependency graph, a timeline of events, and detail drawers that keep every claim tied to its sources.

## Stack

- Next.js, React, and TypeScript
- Tailwind CSS
- Convex for realtime data, scheduled ingestion, and persistence
- Three.js / React Three Fiber for the 3D views
- Vitest for tests

## Development

```bash
npm install
npm run dev
```

Then open `http://localhost:3000`.

Useful scripts:

```bash
npm run lint
npm run test -- --run
npm run build
npm run ingest            # load + refresh the data store (see below)
```

## Data

The dashboard renders a **source-backed dataset**: every capability, milestone, and event carries the `sources` it is drawn from (NASA, NASA OIG, ESA, contractors, and reputable reporting) and a `lastVerified` date. Status, readiness, and confidence are evidence-based assessments, not placeholders.

There are two layers:

- **Curated baseline** — `src/features/trackspace/data/seed.ts`. The hand-verified, cited source of truth, compiled into the app. The page falls back to this whenever the database is empty or unreachable, so it always renders the real status.
- **Convex store** — `convex/schema.ts` holds the same source-backed records plus ingestion-run history and a discovery queue. The dashboard subscribes to `api.trackspace.dataset`, so updates from ingestion are pushed to the app in realtime.

### Ingestion pipeline

`convex/ingest.ts` is the engine that finds the data, keeps it current, and surfaces new leads. One run (`npm run ingest`):

1. loads the curated baseline into Convex with idempotent upserts,
2. **reconciles** launch milestones (Artemis I–III) against the live [Launch Library 2](https://thespacedevs.com/llapi) feed — refreshing `lastVerified`, attaching a corroborating source, and flagging any milestone whose curated status disagrees with the live flight outcome,
3. **discovers** new lunar items from NASA's RSS feeds and queues them as review leads,
4. records the run.

Steps 2–3 are best-effort: a network failure is logged as a warning, never fatal, so the curated truth always loads — even offline (`npm run ingest -- --offline`).

Per the accuracy policy, feed data refreshes provenance and creates review leads in the `discoveries` table; it never silently overwrites a curated status. Source tiers (1 = official, 4 = discovery-only) gate what may drive a public claim.

### Keeping it current

Convex runs `convex/crons.ts` hourly to refresh the store. You can also trigger a refresh manually through the Next route handler (set `INGEST_TOKEN` in both the app environment and Convex with `npx convex env set INGEST_TOKEN <token>` to require a bearer token):

```bash
# When INGEST_TOKEN is set, POST must carry a matching bearer token:
curl -X POST -H "Authorization: Bearer $INGEST_TOKEN" http://localhost:3000/api/ingest
curl http://localhost:3000/api/ingest                # last-run status (open)
```

See `docs/overview.html` and `docs/implementation.html` for the product and technical direction.
