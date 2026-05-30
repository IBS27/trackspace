import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in $HOME would
  // otherwise be inferred as the root).
  turbopack: {
    root: __dirname,
  },
  // better-sqlite3 is a native module; keep it out of the server bundle.
  // (Next 16 auto-externalizes it, but this makes the intent explicit.)
  serverExternalPackages: ["better-sqlite3"],
};

export default nextConfig;
