import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  test: {
    // Component tests opt into jsdom with a @vitest-environment pragma;
    // pure logic tests run in node.
    environment: "node",
    // .claude holds gitignored agent worktrees with their own copies of the
    // source and node_modules; never run their tests as part of this project.
    exclude: ["**/node_modules/**", "**/.claude/**", "**/dist/**"],
  },
});
