import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { mergeConfig } from "vitest/config";
import config from "../../vitest.config.mjs";

// Load only the two changed modules from Git to reproduce the baseline without
// switching checkouts, replacing files, or disturbing the running preview.
const root = fileURLToPath(new URL("../../", import.meta.url));
const ref = process.env.TRACKSPACE_BENCH_REF;
const baseline = new Map(
  ref
    ? [
        "src/features/trackspace/TrackspaceApp.tsx",
        "src/features/trackspace/components/AppShell.tsx",
      ].map((path) => [
        root + path,
        execFileSync("git", ["show", `${ref}:${path}`], { cwd: root, encoding: "utf8" }),
      ])
    : [],
);

export default mergeConfig(config, {
  plugins: [{
    name: "idle-clock-baseline",
    enforce: "pre",
    load: (id: string) => baseline.get(id),
  }],
  test: {
    include: ["scripts/performance/*.bench.tsx"],
    pool: "threads",
    maxWorkers: 1,
  },
});
