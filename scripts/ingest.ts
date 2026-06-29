// CLI entry point for the Convex ingestion pipeline.
//
//   npm run ingest             # load baseline + refresh from live feeds
//   npm run ingest -- --offline  # load and verify the curated baseline only
//
// Manual runs require INGEST_TOKEN in the local app env and Convex deployment.
// Convex also runs the online form hourly via convex/crons.ts.

import { loadEnvConfig } from "@next/env";

import { getConvexSiteUrl } from "../src/lib/convex-server";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const offline = process.argv.includes("--offline");
  const token = process.env.INGEST_TOKEN;
  if (!token) {
    throw new Error(
      "INGEST_TOKEN is required for manual ingestion. Set the same token locally and in Convex.",
    );
  }

  console.log(`[trackspace] ingest starting${offline ? " (offline)" : ""}…`);

  const response = await fetch(`${getConvexSiteUrl()}/ingest${offline ? "?offline=1" : ""}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result?.error ?? `ingest request failed with ${response.status}`);
  }
  const summary = result.summary;

  console.log("[trackspace] ingest complete:");
  console.log(`  capabilities : ${summary.capabilities}`);
  console.log(`  milestones   : ${summary.milestones}`);
  console.log(`  events       : ${summary.events}`);
  console.log(`  locations    : ${summary.locations}`);
  console.log(`  sources      : ${summary.sources}`);
  console.log(`  reconciled   : ${summary.reconciled.join(", ") || "—"}`);
  console.log(`  discoveries  : ${summary.discoveries} new lead(s)`);
  if (summary.warnings.length > 0) {
    console.log("  warnings:");
    for (const warning of summary.warnings) console.log(`    - ${warning}`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("[trackspace] ingest failed:", error);
    process.exit(1);
  });
