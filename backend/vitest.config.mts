import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: [
      { find: "@/app", replacement: path.resolve(__dirname, "./app") },
      { find: "@/frontend", replacement: path.resolve(__dirname, "../frontend") },
      { find: "@/backend", replacement: path.resolve(__dirname, "./") },
      { find: "@/shared", replacement: path.resolve(__dirname, "./shared") },
    ],
  },
});
