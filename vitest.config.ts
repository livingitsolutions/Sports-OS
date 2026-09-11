import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
      "@domain": path.resolve(__dirname, "src/domain"),
      "@adapters": path.resolve(__dirname, "src/adapters"),
      "@composition": path.resolve(__dirname, "src/composition"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
