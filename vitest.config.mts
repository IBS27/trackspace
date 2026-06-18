import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    environment: "jsdom",
    // .claude holds gitignored agent worktrees with their own copies of the
    // source and node_modules; never run their tests as part of this project.
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**"],
  },
});
