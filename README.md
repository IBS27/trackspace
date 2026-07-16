# Trackspace

Trackspace is a Next.js dashboard for tracking NASA's path from Artemis missions toward a sustained lunar base.

It connects milestones, required capabilities, dependencies, spatial context, and source-backed evidence so lunar progress is easy to understand. The experience is a 3D Earth/Moon command view, a capability dependency graph, a timeline of events, and detail drawers that keep every claim tied to its sources.

## Stack

- Bun for package management and the JavaScript runtime
- Next.js, React, and TypeScript
- Tailwind CSS
- Convex for realtime data, scheduled ingestion, and persistence
- Three.js / React Three Fiber for the 3D views
- Vitest for tests

## Development

```bash
bun install
bun run dev
```

Then open `http://localhost:3000`.

Useful scripts:

```bash
bun run lint
bun run test -- --run
bun run build
INGEST_TOKEN=<token> bun run ingest  # load + refresh the data store (see below)
```

The project is pinned to Bun 1.x through `package.json`, uses `bun.lock` for
reproducible installs, and runs its local and deployed Next.js processes on the
Bun runtime.

## Deployment

The app is zero-config deployable as a single Next.js project on Vercel. Set
these Vercel environment variables for preview and production:

```bash
NEXT_PUBLIC_CONVEX_URL=
CONVEX_URL=
CONVEX_SITE_URL=
INGEST_TOKEN=
```

Set the same `INGEST_TOKEN` in Convex so its `/ingest` HTTP action can
authorize manual refreshes:

```bash
bunx --bun convex env set INGEST_TOKEN <token> --prod
```

## Data

The dashboard renders a **source-backed dataset**: every capability, milestone, and event carries the `sources` it is drawn from (NASA, NASA OIG, ESA, contractors, and reputable reporting) and a `lastVerified` date. Status, readiness, and confidence are evidence-based assessments, not placeholders.

There are two layers:

- **Curated baseline** — `src/features/trackspace/data/seed.ts`. The hand-verified, cited source of truth, compiled into the app. The page falls back to this whenever the database is empty or unreachable, so it always renders the real status.
- **Convex store** — `convex/schema.ts` holds the same source-backed records plus ingestion-run history and a discovery queue. The dashboard subscribes to `api.trackspace.dataset`, so updates from ingestion are pushed to the app in realtime.

### Ingestion pipeline

`convex/ingest.ts` is the engine that finds the data, keeps it current, and surfaces new leads. One run (`bun run ingest`):

1. loads the curated baseline into Convex with idempotent upserts,
2. **reconciles** launch milestones (Artemis I–III) against the live [Launch Library 2](https://thespacedevs.com/llapi) feed — refreshing `lastVerified`, attaching a corroborating source, and flagging any milestone whose curated status disagrees with the live flight outcome,
3. **discovers** new lunar items from NASA's RSS feeds and queues them as review leads,
4. records the run.

Steps 2–3 are best-effort: a network failure is logged as a warning, never fatal, so the curated truth always loads — even offline (`bun run ingest -- --offline`).

Per the accuracy policy, feed data refreshes provenance and creates review leads in the `discoveries` table; it never silently overwrites a curated status. Source tiers (1 = official, 4 = discovery-only) gate what may drive a public claim.

### Keeping it current

Convex runs `convex/crons.ts` hourly to refresh the store. You can also trigger a refresh manually through the Next route handler. Manual refreshes require the same `INGEST_TOKEN` in both the app environment and Convex (`bunx --bun convex env set INGEST_TOKEN <token>`). The Next route forwards the request to the Convex `/ingest` HTTP action with the token in the Authorization header:

```bash
curl -X POST -H "Authorization: Bearer $INGEST_TOKEN" http://localhost:3000/api/ingest
curl -H "Authorization: Bearer $INGEST_TOKEN" http://localhost:3000/api/ingest
INGEST_TOKEN=$INGEST_TOKEN bun run ingest -- --offline
```

See `docs/overview.html` and `docs/implementation.html` for the product and technical direction.
