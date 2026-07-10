import * as esbuild from "esbuild";
import { cpSync, mkdirSync, existsSync } from "fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });
cpSync("manifest.json", "dist/manifest.json");
cpSync("src/popup.html", "dist/popup.html");
if (existsSync("icons")) cpSync("icons", "dist/icons", { recursive: true });

const options = {
  entryPoints: ["src/popup.ts", "src/background.ts"],
  bundle: true,
  outdir: "dist",
  format: "esm",
  target: "chrome120",
  sourcemap: watch,
};

if (watch) {
  const ctx = await esbuild.context(options);
  await ctx.watch();
  console.log("watching...");
} else {
  await esbuild.build(options);
  console.log("built extension to dist/");
}
