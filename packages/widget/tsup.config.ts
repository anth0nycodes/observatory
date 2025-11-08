// packages/widget/tsup.config.ts
import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/auto.ts"],
    outDir: "dist",
    format: ["iife"],
    platform: "browser",
    target: "es2020",
    globalName: "TCC_Widget",
    minify: process.env.NODE_ENV === "production",
    sourcemap: true,
    clean: true,
    loader: {
      ".css": "text",
      ".png": "dataurl",
    },
    outExtension: () => ({
      js: ".global.js",
    }),
  },
  {
    entry: ["src/index.ts"],
    outDir: "dist",
    format: ["esm", "cjs"],
    platform: "browser",
    target: "es2020",
    dts: true,
    sourcemap: true,
    clean: false,
    loader: {
      ".css": "text",
      ".png": "dataurl",
    },
    external: ["preact", "@preact/signals"],
  },
]);
