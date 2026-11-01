#!/usr/bin/env node
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const repoPlugins = join(here, "../../../plugins");
const dest = join(here, "../public/plugins");

rmSync(dest, { recursive: true, force: true });
mkdirSync(dest, { recursive: true });
cpSync(repoPlugins, dest, { recursive: true });
console.log("sync-plugins:", dest);
