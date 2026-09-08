import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import "./db.js";
import { seedIfEmpty } from "./seed.js";
import { isEmpty } from "./store.js";
import { createWorkbenchMcpServer } from "./mcp-tools.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

seedIfEmpty(isEmpty());

const transport = new StdioServerTransport();
await createWorkbenchMcpServer().connect(transport);
