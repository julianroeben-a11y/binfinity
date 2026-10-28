import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";

/** Release number from package.json, raised with every release (1.15, 1.16, ...). */
const version: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;
/** Commit the build was made from; set by CI / the Docker build, "dev" locally. */
const build = (process.env.GIT_SHA || "dev").slice(0, 7);

/**
 * Writes `config.json` next to the app. The Docker entrypoint flips
 * `selfUpdate` to true when the update helper is configured; static hosting
 * (e.g. GitHub Pages) keeps it false, so the update button never shows there.
 */
function runtimeConfig(): Plugin {
  return {
    name: "binfinity-runtime-config",
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "config.json", source: JSON.stringify({ version, build, selfUpdate: false }) + "\n" });
    },
  };
}

export default defineConfig({
  // Relative base so the same build works under a sub-path (e.g. GitHub Pages)
  // and at the root of the Docker container.
  base: "./",
  define: { __APP_VERSION__: JSON.stringify(version), __APP_BUILD__: JSON.stringify(build) },
  plugins: [runtimeConfig()],
  worker: { format: "es" },
  optimizeDeps: { exclude: ["replicad-opencascadejs"] },
  build: { target: "es2022", chunkSizeWarningLimit: 2000 },
});
