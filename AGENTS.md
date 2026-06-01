

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.



## Cursor Cloud specific instructions

Trackspace is a **single Next.js app** at the repo root (not a monorepo). See `README.md` for the standard install/dev/lint/test/build commands.

### Services


| Service        | How to run                           | Notes                                                                       |
| -------------- | ------------------------------------ | --------------------------------------------------------------------------- |
| Next.js dev    | `npm run dev`                        | Serves at `http://localhost:3000`. Use a tmux session for long-running dev. |
| Next.js prod   | `npm run build` then `npm run start` | After a production build.                                                   |
| SQLite         | In-process via `better-sqlite3`      | No separate DB daemon. Default file: `local.db`; optional `DB_FILE_NAME`.   |
| Drizzle Studio | `npm run db:studio`                  | Optional DB browser when schema exists.                                     |


No Docker Compose or external databases are required for local development today.

### Lint / test / build

- **Lint:** `npm run lint` (ESLint 9, `eslint.config.mjs`).
- **Tests:** `npm run test` (Vitest watch) or `npm run test -- --run` (single run). The repo may have **zero test files**; Vitest then exits with code 1 — that is expected until tests are added.
- **Build:** `npm run build` (Next.js 16 with Turbopack).

### Next.js version note

This project uses **Next.js 16** with breaking changes vs older versions. Before changing app or API code, read guides under `node_modules/next/dist/docs/` and follow deprecation notices.

### Native dependency

`better-sqlite3` is a native addon; `npm install` compiles it on the VM. If install fails, ensure build tools (`python3`, `make`, `g++`) are available (they are on the default Cloud Agent image).

### Peer dependencies

If `@react-three/fiber` conflicts with React during install, use `npm install --legacy-peer-deps` (documented in `docs/tech-stack.html`).

## UI implementation

When implementing or changing UI — pages, components, layout, styling, or interactions — **read `docs/mock-design.html` first**. It is the canonical visual and interaction reference for the Trackspace dashboard.

- Match the mock's layout, colors, typography, spacing, and behavior. Do not invent a different design unless the user explicitly asks for a change.
- After implementing, compare the running app side-by-side with `docs/mock-design.html` (layout, spacing, filters, drawer behavior, etc.).
- See `docs/implementation.html` for the build plan and acceptance checklist.

## Instructions for writing HTML documents when asked by the user

- When I ask for an HTML document, create or edit a `.html` file, usually in `docs/` unless I specify another path.
- Treat the HTML file as a readable document, similar to a Markdown brief, but with better layout and navigation.
- Match the existing docs style: clean, minimal, dark theme, readable spacing, cards/tables only when they help.
- Keep the writing plain and concrete. Avoid vague language, hype, filler, and generic AI-sounding phrasing.
- Prefer short sections, direct headings, bullets, tables, and examples over long paragraphs.
- Make the document self-contained: inline CSS, no unnecessary JavaScript, no external assets unless requested.
- Use semantic HTML and make it responsive enough to read on desktop and mobile.

