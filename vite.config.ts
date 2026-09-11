import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "src/app"),
      "@domain": path.resolve(__dirname, "src/domain"),
      "@adapters": path.resolve(__dirname, "src/adapters"),
      "@composition": path.resolve(__dirname, "src/composition"),
      "@shared": path.resolve(__dirname, "src/shared"),
    },
  },
});
