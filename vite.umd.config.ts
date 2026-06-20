import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

export default defineConfig({
    build: {
      outDir: "dist",
      emptyOutDir: false,
      lib: {
        entry: "src/index.ts",
        name: "Enumerable",
        formats: ["umd"],
        fileName: () => "linqer.umd.js"
      },
      rollupOptions: {
        output: {
          exports: "default"
        }
      }
    }
  });
