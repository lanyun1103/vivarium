import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  emojiMapSlot,
  parsePluginManifest,
  recommendedEmojiKeys,
  themeSlot,
} from "../packages/schema/dist/index.js";

const root = join(import.meta.dirname, "..");
const pluginsRoot = join(root, "plugins");

for (const dir of readdirSync(pluginsRoot, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const manifestPath = join(pluginsRoot, dir.name, "manifest.json");
  const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  const manifest = parsePluginManifest(raw);
  console.log("OK manifest:", manifestPath);

  const themeRel = manifest.slots["theme.default"];
  if (themeRel) {
    const themePath = join(pluginsRoot, dir.name, themeRel.replace(/^\.\//, ""));
    themeSlot.parse(JSON.parse(readFileSync(themePath, "utf8")));
    console.log("OK theme:", themePath);
  }

  const emojiRel = manifest.slots["emoji.map"];
  if (emojiRel) {
    const emojiPath = join(pluginsRoot, dir.name, emojiRel.replace(/^\.\//, ""));
    const map = emojiMapSlot.parse(JSON.parse(readFileSync(emojiPath, "utf8")));
    const missing = recommendedEmojiKeys.filter((k) => !map[k]);
    if (missing.length) {
      console.warn("WARN", dir.name, "missing recommended emoji keys:", missing.join(", "));
    }
    console.log("OK emoji:", emojiPath);
  }
}
