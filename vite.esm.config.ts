import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    plugins: [dts()],
    build: {
      lib: {
        entry: "src/index.ts",
        formats: ["es", "cjs"],
        fileName: (f) => f === "cjs" ? "index.cjs" : `index.${f}.js`
      }
    }
  });
