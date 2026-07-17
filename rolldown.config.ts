import { defineConfig } from "rolldown";
import { dts } from "rolldown-plugin-dts";

const external = (id: string) => /^[^./]|^node:/.test(id);

export default defineConfig({
  input: {
    index: "src/index.ts",
    bin: "src/bin.ts",
  },
  external,
  plugins: [dts()],
  output: {
    dir: "dist",
    format: "esm",
    cleanDir: true,
    chunkFileNames: "chunk.[hash].js",
  },
});
