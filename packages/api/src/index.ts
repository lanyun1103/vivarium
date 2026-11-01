import { serve } from "@hono/node-server";
import { join } from "node:path";
import { createApp } from "./app.js";
import { createLightModelFromEnv } from "./router.js";
import { openStore } from "./store.js";

const dbPath = process.env.VIVARIUM_DB_PATH ?? join(process.cwd(), "data", "vivarium.db");
const store = openStore(dbPath, { classifier: createLightModelFromEnv() });
const app = createApp(store);

const port = Number(process.env.PORT ?? 8787);
console.log(`Vivarium API listening on http://127.0.0.1:${port}`);
console.log(`SQLite database: ${dbPath}`);

process.on("SIGINT", () => {
  store.close();
  process.exit(0);
});
process.on("SIGTERM", () => {
  store.close();
  process.exit(0);
});

serve({ fetch: app.fetch, port });
