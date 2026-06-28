// CLI entry point for the Convex ingestion pipeline.
//
//   npm run ingest             # load baseline + refresh from live feeds
//   npm run ingest -- --offline  # load and verify the curated baseline only
//
// Convex also runs the online form hourly via convex/crons.ts.

import { loadEnvConfig } from "@next/env";

import { api } from "../convex/_generated/api";
import { getConvexHttpClient } from "../src/lib/convex-server";

async function main(): Promise<void> {
  loadEnvConfig(process.cwd());
  const offline = process.argv.includes("--offline");
  console.log(`[trackspace] ingest starting${offline ? " (offline)" : ""}…`);

  const summary = await getConvexHttpClient().action(api.ingest.runManual, {
    offline,
    token: process.env.INGEST_TOKEN,
  });

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
