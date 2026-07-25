import { fileURLToPath } from "node:url";
import { defineConfig, mergeConfig } from "vitest/config";

import vitestConfig from "./vitest.config";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const coverageOutputDirectory = process.env.UOK_FRONTEND_COVERAGE_OUTPUT_DIRECTORY ?? "var/evidence/coverage/frontend";

export default mergeConfig(
  vitestConfig,
  defineConfig({
    root: repositoryRoot,
    test: {
      // V8 instrumentation is intentionally slower than the normal test lane.
      // Keep the real performance budget in `npm test`, outside instrumentation.
      testTimeout: 15_000,
      include: ["web/src/**/*.{test,spec}.{ts,tsx}", "modules/*/tests/web/**/*.{test,spec}.{ts,tsx}"],
      exclude: [
        "web/e2e/**",
        "modules/*/tests/web/e2e/**",
        "modules/contacts.core/tests/web/ContactsWorkspace.search.test.tsx",
        "modules/planning.core/tests/web/planningDependencyGeometry.test.ts",
        "web/node_modules/**",
        "web/dist/**",
      ],
      setupFiles: [fileURLToPath(new URL("./src/test/setup.ts", import.meta.url))],
      coverage: {
        provider: "v8",
        enabled: true,
        clean: true,
        cleanOnRerun: true,
        reportsDirectory: coverageOutputDirectory,
        reporter: ["text", "json-summary", "lcov", "cobertura"],
        include: ["web/src/**/*.{ts,tsx}", "modules/*/web/src/**/*.{ts,tsx}"],
        exclude: ["web/src/generated/**", "web/src/test/**", "**/*.{test,spec}.{ts,tsx}"],
        thresholds: {
          // Measured whole-tree baseline: 67.42 / 71.28 / 77.17 / 73.01.
          // Rounded-down floors leave only platform variance, not feature drift.
          branches: 67,
          functions: 71,
          lines: 77,
          statements: 73,
        },
      },
    },
  }),
);
