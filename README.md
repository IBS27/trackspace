# Trackspace

Trackspace is a Next.js dashboard for tracking NASA's path from Artemis missions toward a sustained lunar base.

It connects milestones, required capabilities, dependencies, spatial context, and source-backed evidence so lunar progress is easy to understand. The experience is a 3D Earth/Moon command view, a capability dependency graph, a timeline of events, and detail drawers that keep every claim tied to its sources.

## Stack

- Next.js, React, and TypeScript
- Tailwind CSS
- Drizzle ORM with SQLite (`better-sqlite3`)
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
npm run db:generate       # regenerate Drizzle migrations after a schema change
```

## Data

The dashboard renders a **source-backed dataset**: every capability, milestone, and event carries the `sources` it is drawn from (NASA, NASA OIG, ESA, contractors, and reputable reporting) and a `lastVerified` date. Status, readiness, and confidence are evidence-based assessments, not placeholders.

There are two layers:

- **Curated baseline** — `src/features/trackspace/data/seed.ts`. The hand-verified, cited source of truth, compiled into the app. The page falls back to this whenever the database is empty or unreachable, so it always renders the real status.
- **SQLite store** — `src/db` (Drizzle schema) holds the same data plus a provenance table, an ingestion-run log, and a discovery queue. `src/app/page.tsx` reads a live snapshot from SQLite on each request (`src/ingest/load-dataset.ts`), falling back to the curated baseline.

### Ingestion pipeline

`src/ingest/pipeline.ts` is the engine that finds the data, keeps it current, and surfaces new leads. One run (`npm run ingest`):

1. ensures the schema exists,
2. loads the curated baseline into SQLite (idempotent upsert),
3. **reconciles** launch milestones (Artemis I–III) against the live [Launch Library 2](https://thespacedevs.com/llapi) feed — refreshing `lastVerified`, attaching a corroborating source, and flagging any milestone whose curated status disagrees with the live flight outcome,
4. **discovers** new lunar items from NASA's RSS feeds and queues them as review leads,
5. records the run.

Steps 3–4 are best-effort: a network failure is logged as a warning, never fatal, so the curated truth always loads — even offline (`npm run ingest -- --offline`).

Per the accuracy policy, feed data refreshes provenance and creates review leads in the `discoveries` table; it never silently overwrites a curated status. Source tiers (1 = official, 4 = discovery-only) gate what may drive a public claim.

### Keeping it current

Trigger a refresh on a schedule by POSTing to the route handler (set `INGEST_TOKEN` to require a bearer token):

```bash
# When INGEST_TOKEN is set, POST must carry a matching bearer token:
curl -X POST -H "Authorization: Bearer $INGEST_TOKEN" http://localhost:3000/api/ingest
curl http://localhost:3000/api/ingest                # last-run status (open)
```

For example, a cron entry that refreshes hourly:

```cron
0 * * * * curl -fsS -X POST -H "Authorization: Bearer $INGEST_TOKEN" https://<host>/api/ingest
```

See `docs/overview.html` and `docs/implementation.html` for the product and technical direction.
