import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const lintTargets = [
  "web/**/*.{ts,tsx}",
  "modules/*/{web/src,tests/web}/**/*.{ts,tsx}",
];
const nodeJavaScriptTargets = [
  "eslint.config.mjs",
  "web/{eslint,stylelint}.config.mjs",
  "web/scripts/**/*.{js,mjs,cjs}",
];
const ignoredTargets = [
  "web/src/generated/**",
  "web/test-results/**",
];

export default defineConfig([
  {
    name: "uok/typescript",
    basePath: repositoryRoot,
    files: lintTargets,
    ignores: ignoredTargets,
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
    ],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "error",
      "@typescript-eslint/consistent-type-imports": ["error", {
        disallowTypeAnnotations: false,
        fixStyle: "inline-type-imports",
        prefer: "type-imports",
      }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],
    },
  },
  {
    name: "uok/browser-source",
    basePath: repositoryRoot,
    files: [
      "web/src/**/*.{ts,tsx}",
      "modules/*/web/src/**/*.{ts,tsx}",
    ],
    ignores: ignoredTargets,
    languageOptions: {
      globals: globals.browser,
    },
  },
  {
    name: "uok/browser-production-policy",
    basePath: repositoryRoot,
    files: [
      "web/src/**/*.{ts,tsx}",
      "modules/*/web/src/**/*.{ts,tsx}",
    ],
    ignores: [
      ...ignoredTargets,
      "**/*.{test,spec}.{ts,tsx}",
    ],
    rules: {
      "no-restricted-syntax": ["error", {
        selector: "CallExpression[callee.object.name='console']",
        message: "Use governed UI feedback or test evidence instead of console output.",
      }],
    },
  },
  {
    name: "uok/vitest",
    basePath: repositoryRoot,
    files: [
      "web/src/**/*.{test,spec}.{ts,tsx}",
      "modules/*/tests/web/**/*.{test,spec}.{ts,tsx}",
    ],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.vitest,
      },
    },
  },
  {
    name: "uok/playwright",
    basePath: repositoryRoot,
    files: ["web/e2e/**/*.ts"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  {
    name: "uok/node-tooling",
    basePath: repositoryRoot,
    files: [
      "web/vite.config.ts",
      "web/vitest.config.ts",
      "web/playwright.config.ts",
    ],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    name: "uok/node-javascript-tooling",
    basePath: repositoryRoot,
    files: nodeJavaScriptTargets,
    extends: [js.configs.recommended],
    languageOptions: {
      globals: globals.node,
    },
  },
]);
