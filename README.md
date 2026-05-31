# Trackspace

Trackspace is an early Next.js project for tracking NASA's path from Artemis missions toward a sustained lunar base.

The goal is to make lunar progress easier to understand by connecting milestones, required capabilities, dependencies, spatial context, and source-backed evidence. The planned experience includes a 3D Earth/Moon command view, a dependency graph, a timeline of events, and detail panels that keep claims tied to their sources.

## Stack

- Next.js, React, and TypeScript
- Tailwind CSS
- Drizzle ORM with SQLite
- Three.js / React Three Fiber for planned 3D views
- React Flow for planned dependency maps
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
npm run test
npm run build
npm run db:generate
npm run db:migrate
```

This repo is still in the planning/scaffolding stage. See `docs/overview.html` and `docs/tech-stack.html` for the current product and technical direction.
