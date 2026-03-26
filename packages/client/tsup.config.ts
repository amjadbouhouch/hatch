import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/harness/index.ts"],
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
  external: ["zustand", "react", "@hatch/shared"],
});
