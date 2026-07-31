import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));
const eslintBin = fileURLToPath(new URL("../node_modules/eslint/bin/eslint.js", import.meta.url));

const result = spawnSync(process.execPath, [
  eslintBin,
  "--config",
  fileURLToPath(new URL("../../eslint.config.mjs", import.meta.url)),
  "web/src/**/*.{ts,tsx}",
  "web/e2e/**/*.ts",
  "web/vite.config.ts",
  "web/vitest.config.ts",
  "web/playwright.config.ts",
  "eslint.config.mjs",
  "web/{eslint,stylelint}.config.mjs",
  "web/scripts/**/*.{js,mjs,cjs}",
  "modules/*/web/src/**/*.{ts,tsx}",
  "modules/*/tests/web/**/*.{ts,tsx}",
  "--max-warnings",
  "0",
  ...process.argv.slice(2),
], {
  cwd: repositoryRoot,
  stdio: "inherit",
  env: process.env,
});

if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
