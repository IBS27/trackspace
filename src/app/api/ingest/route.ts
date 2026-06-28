// POST /api/ingest — run the ingestion pipeline on demand (e.g. from cron).
//
// If INGEST_TOKEN is set, the request must send a matching bearer token; if it
// is unset the route is open (fine for local development). GET reports the most
// recent run so a scheduler can check status without triggering work.

import { desc } from "drizzle-orm";

import { getDb } from "@/db";
import { ensureSchema } from "@/db/migrate";
import { ingestionRuns } from "@/db/schema";
import { runIngest } from "@/ingest/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const token = process.env.INGEST_TOKEN;
  if (!token) {
    // Fail closed in production: a missing token must not leave a
    // state-changing endpoint publicly triggerable. Allow it only in
    // development for convenient local triggering.
    return process.env.NODE_ENV !== "production";
  }
  return request.headers.get("authorization") === `Bearer ${token}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const offline = url.searchParams.get("offline") === "1";
    const db = getDb();
    const summary = await runIngest(db, { offline });
    return Response.json({ ok: summary.warnings.length === 0, summary });
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(): Promise<Response> {
  try {
    const db = getDb();
    ensureSchema(db);
    const last = db
      .select()
      .from(ingestionRuns)
      .orderBy(desc(ingestionRuns.id))
      .limit(1)
      .get();
    return Response.json({ lastRun: last ?? null });
  } catch (error) {
    return Response.json(
      { lastRun: null, error: (error as Error).message },
      { status: 500 },
    );
  }
}
