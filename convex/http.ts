import { httpRouter } from "convex/server";

import { internal } from "./_generated/api";
import { env, httpAction } from "./_generated/server";

const http = httpRouter();

function unauthorized(): Response {
  return Response.json({ error: "unauthorized" }, { status: 401 });
}

function authorized(request: Request): boolean {
  const token = env.INGEST_TOKEN;
  return Boolean(token) && request.headers.get("authorization") === `Bearer ${token}`;
}

http.route({
  path: "/ingest",
  method: "POST",
  handler: httpAction(async (ctx, request) => {
    if (!authorized(request)) return unauthorized();

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
