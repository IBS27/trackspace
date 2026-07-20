

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.



## Cursor Cloud specific instructions

Trackspace is a **single Next.js app** at the repo root (not a monorepo). See `README.md` for the standard install/dev/lint/test/build commands.

### Services


| Service        | How to run                           | Notes                                                                       |
| -------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Next.js dev    | `bun run dev`                        | Serves at `http://localhost:3000`. Use a tmux session for long-running dev. |
| Next.js prod   | `bun run build` then `bun run start` | After a production build.                                                   |
| Convex         | `bunx --bun convex dev`              | Realtime backend, scheduled ingestion, and persistence.                     |


No Docker Compose or external database daemon is required for local development today.

### Lint / test / build

- **Install:** `bun install --frozen-lockfile` for reproducible installs. Use `bun install` when intentionally updating dependencies.
- **Lint:** `bun run lint` (ESLint 9, `eslint.config.mjs`).
- **Tests:** `bun run test` (Vitest watch) or `bun run test -- --run` (single run). The repo may have **zero test files**; Vitest then exits with code 1 — that is expected until tests are added. Do not use bare `bun test`; that selects Bun's test runner instead of the configured Vitest script.
- **Build:** `bun run build` (Next.js 16 with Turbopack running on Bun).

### Next.js version note

This project uses **Next.js 16** with breaking changes vs older versions. Before changing app or API code, read guides under `node_modules/next/dist/docs/` and follow deprecation notices.

### Peer dependencies

Keep React on a version supported by `@react-three/fiber`. If a future React upgrade exceeds Fiber's declared peer range, pin React to the latest compatible version until Fiber adds support (documented in `docs/tech-stack.html`).

## UI implementation

The dashboard is built; **the running app is the design reference**. (The original mock, `docs/mock-design.html`, has been retired and deleted.)

- When implementing or changing UI — pages, components, layout, styling, or interactions — match the existing app's layout, colors, typography, spacing, and behavior. Do not invent a different design unless the user explicitly asks for a change.
- After implementing, compare the change side-by-side with neighboring screens in the running app.
- `docs/implementation.html` holds the original build plan and acceptance checklist (historical).

## Instructions for writing HTML documents when asked by the user

- When I ask for an HTML document, create or edit a `.html` file, usually in `docs/` unless I specify another path.
- Treat the HTML file as a readable document, similar to a Markdown brief, but with better layout and navigation.
- Match the existing docs style: clean, minimal, dark theme, readable spacing, cards/tables only when they help.
- Keep the writing plain and concrete. Avoid vague language, hype, filler, and generic AI-sounding phrasing.
- Prefer short sections, direct headings, bullets, tables, and examples over long paragraphs.
- Make the document self-contained: inline CSS, no unnecessary JavaScript, no external assets unless requested.
- Use semantic HTML and make it responsive enough to read on desktop and mobile.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`bunx --bun convex ai-files install`.

<!-- convex-ai-end -->
