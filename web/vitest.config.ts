import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

import viteConfig from "./vite.config";

export default mergeConfig(viteConfig, defineConfig({
  test: {
    environment: "jsdom",
    maxWorkers: "50%",
    include: [
      "src/**/*.{test,spec}.{ts,tsx}",
      "../modules/*/tests/web/**/*.{test,spec}.{ts,tsx}",
    ],
    exclude: ["e2e/**", "../modules/*/tests/web/e2e/**", "node_modules/**", "dist/**"],
    setupFiles: [fileURLToPath(new URL("./src/test/setup.ts", import.meta.url))]
  }
}));
