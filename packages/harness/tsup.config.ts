import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: {
    compilerOptions: {
      composite: false,
      incremental: false,
    },
  },
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ["@mastra/core", "@mastra/schema-compat", "@hatch/shared", "@hatch/database", "zod", "zod/v3", "zod/v4"],
});
