import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // same alias as tsconfig "paths": "@/*" -> "./*"
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
