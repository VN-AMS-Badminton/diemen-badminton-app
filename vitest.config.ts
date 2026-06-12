import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    // Scope to app source — otherwise vitest also sweeps unrelated
    // .claude/hooks/**/*.test.cjs tooling tests (flaky perf assertions).
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
