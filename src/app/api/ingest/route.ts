// POST /api/ingest - run the ingestion pipeline on demand (e.g. from cron).
//
// In production, INGEST_TOKEN must be set and the request must send a matching
// bearer token. GET reports the most recent run so a scheduler can check status
// without triggering work.

import { getConvexSiteUrl } from "@/lib/convex-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const token = process.env.INGEST_TOKEN;
  return Boolean(token) && request.headers.get("authorization") === `Bearer ${token}`;
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
  return Response.json(await response.json(), { status: response.status });
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
  } catch (error) {
    return Response.json(
      { ok: false, error: (error as Error).message },
      { status: 500 },
    );
  }
}

export async function GET(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    return await forwardToConvex("/ingest", "GET");
  } catch (error) {
    return Response.json(
      { lastRun: null, error: (error as Error).message },
      { status: 500 },
    );
  }
}
