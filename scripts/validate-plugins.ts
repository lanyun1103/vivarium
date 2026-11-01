import { readFileSync } from "node:fs";
import { join } from "node:path";
import { pluginManifest } from "../packages/schema/dist/index.js";

const root = join(import.meta.dirname, "..");
const manifestPath = join(root, "plugins/example-skin/manifest.json");
const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
pluginManifest.parse(raw);
console.log("OK:", manifestPath);
