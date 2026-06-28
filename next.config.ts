import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project (a stray lockfile in $HOME would
  // otherwise be inferred as the root).
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
