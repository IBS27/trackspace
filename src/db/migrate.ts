import path from "node:path";

import { migrate } from "drizzle-orm/better-sqlite3/migrator";

import { getDb, type TrackspaceDb } from "./index";

const MIGRATIONS_FOLDER = path.join(process.cwd(), "drizzle");

/**
 * Apply pending migrations. Idempotent: Drizzle tracks applied migrations in
 * its own table, so calling this on an up-to-date database is a no-op. The
 * ingestion pipeline calls it before writing so the schema always exists.
 */
export function ensureSchema(database: TrackspaceDb = getDb()): void {
  migrate(database, { migrationsFolder: MIGRATIONS_FOLDER });
}
