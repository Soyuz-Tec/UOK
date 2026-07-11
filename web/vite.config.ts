import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";


const webRoot = fileURLToPath(new URL(".", import.meta.url));
const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));
const dependencyRoot = (name: string) => fileURLToPath(new URL(`./node_modules/${name}`, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      { find: "@uok", replacement: fileURLToPath(new URL("./src", import.meta.url)) },
      { find: "@uok-modules", replacement: fileURLToPath(new URL("../modules", import.meta.url)) },
      { find: "react-dom", replacement: dependencyRoot("react-dom") },
      { find: "react", replacement: dependencyRoot("react") },
      { find: "lucide-react", replacement: dependencyRoot("lucide-react") },
      { find: "@testing-library/react", replacement: dependencyRoot("@testing-library/react") },
      { find: "@testing-library/jest-dom", replacement: dependencyRoot("@testing-library/jest-dom") },
      { find: "vitest", replacement: dependencyRoot("vitest") },
    ],
    dedupe: ["react", "react-dom", "lucide-react"],
  },
  server: {
    fs: {
      allow: [repositoryRoot, webRoot],
    },
  },
});
