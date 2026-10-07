import * as esbuild from "esbuild";

await esbuild.build({
  entryPoints: ["src/index.tsx"],
  bundle: true,
  format: "esm",
  target: "es2022",
  outfile: "worker.js",
  minify: false,
  sourcemap: false,
  conditions: ["workerd", "worker", "browser"],
  logLevel: "info",
});
