import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import "./db.js";
import { seedIfEmpty } from "./seed.js";
import {
  importItem,
  isEmpty,
  listCollectionItems,
  listCollections,
} from "./store.js";
import { exportVariant, listReadyExports, type Platform } from "./drafts.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

seedIfEmpty(isEmpty());

const server = new McpServer({
  name: "workbench",
  version: "0.1.0",
});

server.tool(
  "list_collections",
  "列出工作台里的收藏夹",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(listCollections(), null, 2) }],
  }),
);

server.tool(
  "list_collection_items",
  "列出某收藏夹下的文章摘要",
  { collectionId: z.string() },
  async ({ collectionId }) => ({
    content: [
      {
        type: "text",
        text: JSON.stringify(listCollectionItems(collectionId, {}), null, 2),
      },
    ],
  }),
);

server.tool(
  "import_collection_item",
  "导入一篇收藏（标题+Markdown正文）。不登录知乎。",
  {
    collectionName: z.string(),
    title: z.string(),
    body: z.string(),
    sourceUrl: z.string().optional(),
    author: z.string().optional(),
    contentKind: z.enum(["answer", "article"]).optional(),
    originalAt: z.number().optional(),
    groups: z.array(z.string()).optional(),
  },
  async (input) => {
    const item = importItem(input);
    return { content: [{ type: "text", text: JSON.stringify(item, null, 2) }] };
  },
);

server.tool(
  "list_exportable_variants",
  "列出已标为可导出的平台变体（不发布）",
  {},
  async () => ({
    content: [{ type: "text", text: JSON.stringify(listReadyExports(), null, 2) }],
  }),
);

server.tool(
  "export_variant",
  "取出一份平台变体包。platform 为 wechat / xiaohongshu / zhihu。",
  {
    draftId: z.string(),
    platform: z.enum(["wechat", "xiaohongshu", "zhihu"]),
  },
  async ({ draftId, platform }) => {
    const pack = exportVariant(draftId, platform as Platform);
    if (!pack) {
      return { content: [{ type: "text", text: "变体不存在或尚未标为可导出" }], isError: true };
    }
    return { content: [{ type: "text", text: JSON.stringify(pack, null, 2) }] };
  },
);

const transport = new StdioServerTransport();
await server.connect(transport);
