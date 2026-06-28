import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";

import * as schema from "./schema";

export type TrackspaceDb = BetterSQLite3Database<typeof schema>;

let sharedDb: TrackspaceDb | undefined;

/** Open a Drizzle client over a SQLite file (or ":memory:" for tests). */
export function createDb(
  fileName: string = process.env.DB_FILE_NAME ?? "local.db",
): TrackspaceDb {
  const sqlite = new Database(fileName);
  sqlite.pragma("journal_mode = WAL");
  return drizzle({ client: sqlite, schema });
}

/** Shared client over the default database file, opened only when requested. */
export function getDb(): TrackspaceDb {
  sharedDb ??= createDb();
  return sharedDb;
}
