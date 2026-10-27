import { defineConfig } from "vite";

export default defineConfig({
  // Relative base so the same build works under a sub-path (e.g. GitHub Pages)
  // and at the root of the Docker container.
  base: "./",
  worker: { format: "es" },
  optimizeDeps: { exclude: ["replicad-opencascadejs"] },
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
});
