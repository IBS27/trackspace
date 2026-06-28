import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "refresh trackspace feeds",
  { hours: 1 },
  internal.ingest.runScheduled,
  {},
);

export default crons;
