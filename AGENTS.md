<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Cursor Cloud specific instructions

Trackspace is a **single Next.js app** at the repo root (not a monorepo). See `README.md` for the standard install/dev/lint/test/build commands.

### Services

| Service | How to run | Notes |
|--------|------------|--------|
| Next.js dev | `npm run dev` | Serves at `http://localhost:3000`. Use a tmux session for long-running dev. |
| Next.js prod | `npm run build` then `npm run start` | After a production build. |
| SQLite | In-process via `better-sqlite3` | No separate DB daemon. Default file: `local.db`; optional `DB_FILE_NAME`. |
| Drizzle Studio | `npm run db:studio` | Optional DB browser when schema exists. |

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
