// POST /api/ingest - run the ingestion pipeline on demand (e.g. from cron).
//
// In production, INGEST_TOKEN must be set and the request must send a matching
// bearer token. GET reports the most recent run so a scheduler can check status
// without triggering work.

import { authorizeIngestRequest } from "@/lib/ingest-auth";
import { getConvexSiteUrl } from "@/lib/convex-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  return authorizeIngestRequest(request, process.env.INGEST_TOKEN);
}

async function forwardToConvex(
  path: string,
  method: "GET" | "POST",
): Promise<Response> {
  const token = process.env.INGEST_TOKEN;
  if (!token) {
    throw new Error("INGEST_TOKEN is not configured");
  }
  const response = await fetch(`${getConvexSiteUrl()}${path}`, {
    method,
    headers: { authorization: `Bearer ${token}` },
  });

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = { error: "upstream_invalid_response" };
  }
  return Response.json(body, { status: response.status });
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const url = new URL(request.url);
    const offline = url.searchParams.get("offline") === "1";
    return await forwardToConvex(
      `/ingest${offline ? "?offline=1" : ""}`,
      "POST",
    );
  } catch {
    return Response.json({ ok: false, error: "ingest_failed" }, { status: 500 });
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return await forwardToConvex("/ingest", "GET");
  } catch {
    return Response.json(
      { lastRun: null, error: "ingest_status_failed" },
      { status: 500 },
    );
  }
}
