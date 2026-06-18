// CLI entry point for the ingestion pipeline.
//
//   npm run ingest             # load baseline + refresh from live feeds
//   npm run ingest -- --offline  # load and verify the curated baseline only
//
// Schedule the online form (e.g. via cron) to keep the database current.

import { runIngest } from "@/ingest/pipeline";

async function main(): Promise<void> {
  const offline = process.argv.includes("--offline");
  console.log(`[trackspace] ingest starting${offline ? " (offline)" : ""}…`);

  const summary = await runIngest(undefined, { offline });

  console.log("[trackspace] ingest complete:");
  console.log(`  capabilities : ${summary.capabilities}`);
  console.log(`  milestones   : ${summary.milestones}`);
  console.log(`  events       : ${summary.events}`);
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
