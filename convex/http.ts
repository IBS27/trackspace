import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";
import { authorizeIngestRequest } from "./lib/ingestAuth";

const http = httpRouter();

/** Minimum gap between manual HTTP ingest runs (scheduled cron is unaffected). */
const MIN_MANUAL_INGEST_INTERVAL_MS = 5 * 60 * 1000;

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function authorized(request: Request): boolean {
  return authorizeIngestRequest(request, env.INGEST_TOKEN);
}

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return unauthorized();

    const last = await ctx.runQuery(internal.ingest.lastRun, {});
    if (last?.startedAt) {
      const elapsed = Date.now() - Date.parse(last.startedAt);
      if (
        Number.isFinite(elapsed) &&
        elapsed >= 0 &&
        elapsed < MIN_MANUAL_INGEST_INTERVAL_MS
      ) {
        const retryAfterSec = Math.ceil(
          (MIN_MANUAL_INGEST_INTERVAL_MS - elapsed) / 1000,
        );
        return Response.json(
          {
            error: "rate_limited",
            retryAfterSec,
          },
          {
            status: 429,
            headers: { "Retry-After": String(retryAfterSec) },
          },
        );
      }
    }

    const url = new URL(request.url);
    const offline = url.searchParams.get("offline") === "1";
    const summary = await ctx.runAction(internal.ingest.runManual, { offline });
    return Response.json({ ok: summary.warnings.length === 0, summary });
  }),
});

http.route({
  path: "/ingest",
  method: "GET",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return unauthorized();

    const last = await ctx.runQuery(internal.ingest.lastRun, {});
    return Response.json({ lastRun: last ?? null });
  }),
});

export default http;
