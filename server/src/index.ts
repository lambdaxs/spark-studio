import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { disposeAgents } from "./agent.js";
import { ingestPlainPasswordFromEnv } from "./auth.js";
import { seedIfEmpty, seedTodosIfEmpty, seedWikiIfEmpty, seedDraftsIfEmpty, seedCoursesIfEmpty, ensureDemoTodoState } from "./seed.js";
import { isEmpty } from "./store.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

seedIfEmpty(isEmpty());
seedWikiIfEmpty();
seedTodosIfEmpty();
ensureDemoTodoState();
seedDraftsIfEmpty();
seedCoursesIfEmpty();
await ingestPlainPasswordFromEnv();

const port = Number(process.env.PORT ?? 8787);
const hostname = process.env.HOST?.trim() || "0.0.0.0";

serve({ fetch: app.fetch, port, hostname }, (info) => {
  console.log(`server http://${info.address}:${info.port}`);
});

async function shutdown() {
  await disposeAgents();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());
