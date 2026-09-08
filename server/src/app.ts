import fs from "node:fs";
import path from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { streamSSE } from "hono/streaming";
import { z } from "zod";
import { streamItemChat, streamLessonBody } from "./agent.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createWorkbenchMcpServer } from "./mcp-tools.js";
import { generateWorkbenchToken, settingsStatus, updateSettings } from "./settings.js";
import {
  attachSession,
  authStatus,
  checkLogin,
  clearSession,
  clientKey,
  hasCredentials,
  isPublicApi,
  loginLimited,
  readSession,
  setCredentials,
} from "./auth.js";
import { workspaceRoot } from "./db.js";
import {
  addLink,
  createCollection,
  deleteGroup,
  getItem,
  importItem,
  listCollectionItems,
  listCollections,
  listGroups,
  listMessages,
  removeLink,
  renameGroup,
  tagItem,
  untagItem,
} from "./store.js";
import { createWikiPage, listWikiTree, moveWikiPage, updateWikiPage } from "./wiki.js";
import {
  createTodo,
  listLinkTargets,
  listTodos,
  todoViewCounts,
  updateTodo,
} from "./todos.js";
import { listTrash, restoreTrash, trashItem } from "./trash.js";
import {
  PLATFORMS,
  createDraft,
  exportVariant,
  generateVariantFromBase,
  getDraft,
  listDrafts,
  listReadyExports,
  saveVariant,
  updateDraft,
  type Platform,
} from "./drafts.js";
import {
  addAsset,
  addBinding,
  applyOutline,
  clearCourseArchive,
  confirmCourse,
  listCourseHistory,
  createCourse,
  getCourse,
  getLesson,
  listBindTargets,
  listCourses,
  parseCanvasSpec,
  removeAsset,
  removeBinding,
  saveCanvas,
  setLessonStatus,
  suggestOutline,
  updateCourse,
  type OutlineDraft,
} from "./courses.js";

const importSchema = z.object({
  collectionName: z.string().min(1),
  title: z.string().min(1),
  body: z.string(),
  sourceUrl: z.string().optional().nullable(),
  author: z.string().optional().nullable(),
  contentKind: z.enum(["answer", "article"]).optional().nullable(),
  originalAt: z.number().optional().nullable(),
  groups: z.array(z.string()).optional(),
});

function tokenError(
  c: { json: (body: unknown, status: 401 | 503) => Response },
): Response | null {
  const token = process.env.WORKBENCH_TOKEN?.trim();
  if (!token) return c.json({ error: "workbench token not configured" }, 503);
  const header = c.req.header("authorization") ?? "";
  const got = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (got !== token) return c.json({ error: "unauthorized" }, 401);
  return null;
}

export const app = new Hono();

app.use(
  "/api/*",
  cors({
    origin: ["http://127.0.0.1:5173", "http://localhost:5173"],
    credentials: true,
  }),
);

app.use("/api/*", async (c, next) => {
  if (c.req.method === "OPTIONS") return next();
  if (isPublicApi(c.req.path)) return next();
  if (!readSession(c)) return c.json({ error: "unauthorized" }, 401);
  return next();
});
app.use(
  "/mcp",
  cors({
    origin: "*",
    allowMethods: ["GET", "POST", "DELETE", "OPTIONS"],
    allowHeaders: [
      "Content-Type",
      "Authorization",
      "mcp-session-id",
      "Last-Event-ID",
      "mcp-protocol-version",
    ],
    exposeHeaders: ["mcp-session-id", "mcp-protocol-version"],
  }),
);

app.all("/mcp", async (c) => {
  if (c.req.method === "OPTIONS") return c.body(null, 204);
  const denied = tokenError(c);
  if (denied) return denied;
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  const mcp = createWorkbenchMcpServer();
  await mcp.connect(transport);
  return transport.handleRequest(c.req.raw);
});

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/auth/me", (c) => c.json(authStatus(c)));

app.post("/api/auth/setup", async (c) => {
  if (hasCredentials()) return c.json({ error: "already configured" }, 409);
  const body = await c.req.json();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  try {
    await setCredentials(username, password);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid" }, 400);
  }
  const name = username.trim();
  attachSession(c, name);
  return c.json({ authenticated: true, setupRequired: false, username: name });
});

app.post("/api/auth/login", async (c) => {
  const ip = clientKey(c);
  if (loginLimited(ip)) return c.json({ error: "too many attempts" }, 429);
  const body = await c.req.json();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  if (!(await checkLogin(username, password))) {
    return c.json({ error: "invalid credentials" }, 401);
  }
  const name = username.trim();
  attachSession(c, name);
  return c.json({ authenticated: true, setupRequired: false, username: name });
});

app.post("/api/auth/logout", (c) => {
  clearSession(c);
  return c.json({ ok: true });
});

app.put("/api/auth/credentials", async (c) => {
  const body = await c.req.json();
  const username = String(body.username ?? "");
  const password = String(body.password ?? "");
  try {
    await setCredentials(username, password);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "invalid" }, 400);
  }
  const name = username.trim();
  attachSession(c, name);
  return c.json({ authenticated: true, setupRequired: false, username: name });
});

app.get("/api/collections", (c) => c.json(listCollections()));

app.post("/api/collections", async (c) => {
  const body = await c.req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return c.json({ error: "name required" }, 400);
  return c.json(createCollection(name, String(body.description ?? "")));
});

app.get("/api/groups", (c) => c.json(listGroups()));

app.patch("/api/groups/:id", async (c) => {
  const body = await c.req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return c.json({ error: "name required" }, 400);
  const row = renameGroup(c.req.param("id"), name);
  if (!row) return c.json({ error: "not found" }, 404);
  return c.json(row);
});

app.delete("/api/groups/:id", (c) => {
  deleteGroup(c.req.param("id"));
  return c.body(null, 204);
});

app.get("/api/collections/:id/items", (c) => {
  const groupId = c.req.query("groupId") || undefined;
  const ungrouped = c.req.query("ungrouped") === "1";
  return c.json(listCollectionItems(c.req.param("id"), { groupId, ungrouped }));
});

app.get("/api/items/:id", (c) => {
  const item = getItem(c.req.param("id"));
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

app.get("/api/trash", (c) => c.json(listTrash()));

app.post("/api/items/:id/trash", (c) => {
  const result = trashItem(c.req.param("id"));
  if (!result) return c.json({ error: "cannot trash" }, 400);
  return c.json(result);
});

app.post("/api/trash/:batchId/restore", (c) => {
  if (!restoreTrash(c.req.param("batchId"))) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/settings", (c) => c.json(settingsStatus()));

app.put("/api/settings", async (c) => {
  const body = await c.req.json();
  return c.json(
    await updateSettings({
      cursorApiKey: typeof body.cursorApiKey === "string" ? body.cursorApiKey : undefined,
      workbenchToken: typeof body.workbenchToken === "string" ? body.workbenchToken : undefined,
      mcpPublicUrl: typeof body.mcpPublicUrl === "string" ? body.mcpPublicUrl : undefined,
    }),
  );
});

app.post("/api/settings/workbench-token", (c) => c.json(generateWorkbenchToken()));

app.get("/api/items/:id/messages", (c) => {
  return c.json(listMessages(c.req.param("id")));
});

app.post("/api/items/:id/groups", async (c) => {
  const body = await c.req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return c.json({ error: "name required" }, 400);
  const item = tagItem(c.req.param("id"), name);
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

app.delete("/api/items/:id/groups/:groupId", (c) => {
  const item = untagItem(c.req.param("id"), c.req.param("groupId"));
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

app.post("/api/import/items", async (c) => {
  const denied = tokenError(c);
  if (denied) return denied;
  const parsed = importSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: parsed.error.flatten() }, 400);
  }
  return c.json(importItem(parsed.data), 201);
});

app.get("/api/wiki/tree", (c) => c.json(listWikiTree()));

app.post("/api/wiki/pages", async (c) => {
  const body = await c.req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return c.json({ error: "title required" }, 400);
  return c.json(
    createWikiPage({
      title,
      body: typeof body.body === "string" ? body.body : "",
      parentId: body.parentId ? String(body.parentId) : null,
      groups: Array.isArray(body.groups) ? body.groups.map(String) : [],
    }),
    201,
  );
});

app.patch("/api/wiki/pages/:id", async (c) => {
  const body = await c.req.json();
  const item = updateWikiPage(c.req.param("id"), {
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    parentId: body.parentId === undefined ? undefined : body.parentId,
  });
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

app.post("/api/wiki/pages/:id/move", async (c) => {
  const body = await c.req.json();
  const parentId =
    body.parentId === null || body.parentId === undefined || body.parentId === ""
      ? null
      : String(body.parentId);
  const index = Number(body.index);
  if (!Number.isFinite(index)) return c.json({ error: "index required" }, 400);
  const tree = moveWikiPage(c.req.param("id"), parentId, index);
  if (!tree) return c.json({ error: "invalid move" }, 400);
  return c.json(tree);
});

app.get("/api/todos/counts", (c) => c.json(todoViewCounts()));

app.get("/api/todos", (c) => {
  const view = c.req.query("view");
  const v = view === "today" || view === "all" ? view : "open";
  return c.json(
    listTodos({
      view: v,
      groupId: c.req.query("groupId") || undefined,
      ungrouped: c.req.query("ungrouped") === "1",
    }),
  );
});

app.post("/api/todos", async (c) => {
  const body = await c.req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return c.json({ error: "title required" }, 400);
  return c.json(
    createTodo({
      title,
      body: typeof body.body === "string" ? body.body : "",
      dueAt: typeof body.dueAt === "number" ? body.dueAt : null,
      groups: Array.isArray(body.groups) ? body.groups.map(String) : [],
      linkIds: Array.isArray(body.linkIds) ? body.linkIds.map(String) : [],
    }),
    201,
  );
});

app.patch("/api/todos/:id", async (c) => {
  const body = await c.req.json();
  const item = updateTodo(c.req.param("id"), {
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    status: body.status === "done" || body.status === "open" ? body.status : undefined,
    dueAt: body.dueAt === undefined ? undefined : body.dueAt,
  });
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

app.get("/api/link-targets", (c) => c.json(listLinkTargets()));

app.post("/api/items/:id/links", async (c) => {
  const body = await c.req.json();
  const toId = String(body.toId ?? "");
  if (!toId) return c.json({ error: "toId required" }, 400);
  const item = addLink(c.req.param("id"), toId);
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

app.delete("/api/items/:id/links/:toId", (c) => {
  const item = removeLink(c.req.param("id"), c.req.param("toId"));
  if (!item) return c.json({ error: "not found" }, 404);
  return c.json(item);
});

function asPlatform(raw: string | undefined): Platform | undefined {
  return PLATFORMS.find((p) => p === raw);
}

app.get("/api/drafts", (c) => {
  return c.json(
    listDrafts({
      groupId: c.req.query("groupId") || undefined,
      ungrouped: c.req.query("ungrouped") === "1",
      ready: c.req.query("ready") === "1",
    }),
  );
});

app.post("/api/drafts", async (c) => {
  const body = await c.req.json();
  const title = String(body.title ?? "").trim();
  if (!title) return c.json({ error: "title required" }, 400);
  return c.json(
    createDraft({
      title,
      body: typeof body.body === "string" ? body.body : "",
      groups: Array.isArray(body.groups) ? body.groups.map(String) : [],
      linkIds: Array.isArray(body.linkIds) ? body.linkIds.map(String) : [],
    }),
    201,
  );
});

app.get("/api/drafts/:id", (c) => {
  const draft = getDraft(c.req.param("id"));
  if (!draft) return c.json({ error: "not found" }, 404);
  return c.json(draft);
});

app.patch("/api/drafts/:id", async (c) => {
  const body = await c.req.json();
  const draft = updateDraft(c.req.param("id"), {
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
  });
  if (!draft) return c.json({ error: "not found" }, 404);
  return c.json(draft);
});

app.put("/api/drafts/:id/variants/:platform", async (c) => {
  const platform = asPlatform(c.req.param("platform"));
  if (!platform) return c.json({ error: "bad platform" }, 400);
  const body = await c.req.json();
  const draft = saveVariant(c.req.param("id"), platform, {
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
    summary: typeof body.summary === "string" ? body.summary : undefined,
    tags: Array.isArray(body.tags) ? body.tags.map(String) : undefined,
    coverNote: typeof body.coverNote === "string" ? body.coverNote : undefined,
    imageBriefs: Array.isArray(body.imageBriefs) ? body.imageBriefs.map(String) : undefined,
    status: body.status === "ready" || body.status === "empty" ? body.status : undefined,
  });
  if (!draft) return c.json({ error: "not found" }, 404);
  return c.json(draft);
});

app.post("/api/drafts/:id/variants/:platform/from-base", (c) => {
  const platform = asPlatform(c.req.param("platform"));
  if (!platform) return c.json({ error: "bad platform" }, 400);
  const draft = generateVariantFromBase(c.req.param("id"), platform);
  if (!draft) return c.json({ error: "not found" }, 404);
  return c.json(draft);
});

function readOutline(raw: unknown): OutlineDraft[] | null {
  if (!Array.isArray(raw)) return null;
  const walk = (n: unknown): OutlineDraft | null => {
    if (!n || typeof n !== "object") return null;
    const title = String((n as { title?: string }).title ?? "").trim();
    if (!title) return null;
    const children = Array.isArray((n as { children?: unknown[] }).children)
      ? ((n as { children: unknown[] }).children.map(walk).filter(Boolean) as OutlineDraft[])
      : undefined;
    return { title, children };
  };
  const nodes = raw.map(walk).filter((n): n is OutlineDraft => n != null);
  return nodes.length ? nodes : null;
}

app.get("/api/courses/bind-targets", (c) => c.json(listBindTargets()));

app.get("/api/courses/history", (c) => c.json(listCourseHistory()));

app.get("/api/courses", (c) => c.json(listCourses()));

app.post("/api/courses", async (c) => {
  const body = await c.req.json();
  const title = String(body.title ?? "").trim() || "未命名课程";
  return c.json(
    createCourse({
      title,
      body: typeof body.body === "string" ? body.body : "",
      groups: Array.isArray(body.groups) ? body.groups.map(String) : [],
    }),
    201,
  );
});

app.delete("/api/courses/:id/archive", (c) => {
  const ok = clearCourseArchive(c.req.param("id"));
  if (!ok) return c.json({ error: "not found" }, 404);
  return c.json({ ok: true });
});

app.get("/api/courses/:id", (c) => {
  const course = getCourse(c.req.param("id"));
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course);
});

app.patch("/api/courses/:id", async (c) => {
  const body = await c.req.json();
  const course = updateCourse(c.req.param("id"), {
    title: typeof body.title === "string" ? body.title : undefined,
    body: typeof body.body === "string" ? body.body : undefined,
  });
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course);
});

app.put("/api/courses/:id/outline", async (c) => {
  const body = await c.req.json();
  const outline = readOutline(body.outline ?? body);
  if (!outline) return c.json({ error: "outline required" }, 400);
  const course = applyOutline(c.req.param("id"), outline);
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course);
});

app.post("/api/courses/:id/suggest-outline", (c) => {
  const course = applyOutline(c.req.param("id"), suggestOutline(c.req.param("id")));
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course);
});

app.post("/api/courses/:id/confirm", (c) => {
  const result = confirmCourse(c.req.param("id"));
  if (!result) return c.json({ error: "not found" }, 404);
  if ("error" in result) return c.json({ error: "empty outline" }, 400);
  return c.json(result);
});

app.post("/api/courses/:id/bindings", async (c) => {
  const body = await c.req.json();
  const kind = body.kind === "collection" || body.kind === "item" ? body.kind : null;
  const targetId = String(body.targetId ?? "");
  if (!kind || !targetId) return c.json({ error: "kind and targetId required" }, 400);
  const course = addBinding(c.req.param("id"), kind, targetId);
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course);
});

app.delete("/api/courses/:id/bindings/:kind/:targetId", (c) => {
  const course = removeBinding(c.req.param("id"), c.req.param("kind"), c.req.param("targetId"));
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course);
});

app.post("/api/courses/:id/assets", async (c) => {
  const body = await c.req.parseBody();
  const file = body.file;
  if (!file || typeof file === "string") return c.json({ error: "file required" }, 400);
  const blob = file as File;
  if (blob.size > 12 * 1024 * 1024) return c.json({ error: "too large" }, 400);
  const buf = Buffer.from(await blob.arrayBuffer());
  const name = blob.name || "upload.bin";
  const course = await addAsset(c.req.param("id"), name, blob.type || "", buf);
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course, 201);
});

app.delete("/api/courses/:id/assets/:assetId", (c) => {
  const course = removeAsset(c.req.param("id"), c.req.param("assetId"));
  if (!course) return c.json({ error: "not found" }, 404);
  return c.json(course);
});

app.get("/api/lessons/:id", (c) => {
  const lesson = getLesson(c.req.param("id"));
  if (!lesson) return c.json({ error: "not found" }, 404);
  return c.json(lesson);
});

app.patch("/api/lessons/:id", async (c) => {
  const body = await c.req.json();
  const status =
    body.status === "done" || body.status === "in_progress" || body.status === "not_started"
      ? body.status
      : null;
  if (!status) return c.json({ error: "bad status" }, 400);
  const lesson = setLessonStatus(c.req.param("id"), status);
  if (!lesson) return c.json({ error: "not found" }, 404);
  return c.json(lesson);
});

app.put("/api/lessons/:id/canvas", async (c) => {
  const spec = parseCanvasSpec(await c.req.json());
  if (!spec) return c.json({ error: "bad canvas" }, 400);
  if (!getLesson(c.req.param("id"))) return c.json({ error: "not found" }, 404);
  saveCanvas(c.req.param("id"), spec);
  return c.json(getLesson(c.req.param("id")));
});

app.post("/api/lessons/:id/generate", (c) => {
  const lessonId = c.req.param("id");
  if (!getLesson(lessonId)) return c.json({ error: "not found" }, 404);
  return streamSSE(c, async (stream) => {
    try {
      const lesson = await streamLessonBody(lessonId, async (text) => {
        await stream.writeSSE({ event: "delta", data: JSON.stringify({ text }) });
      });
      await stream.writeSSE({ event: "done", data: JSON.stringify(lesson ?? {}) });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "error";
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ code: raw, detail: raw }),
      });
    }
  });
});

app.get("/api/export/variants", (c) => {
  const denied = tokenError(c);
  if (denied) return denied;
  return c.json(listReadyExports());
});

app.get("/api/export/variants/:draftId/:platform", (c) => {
  const denied = tokenError(c);
  if (denied) return denied;
  const platform = asPlatform(c.req.param("platform"));
  if (!platform) return c.json({ error: "bad platform" }, 400);
  const pack = exportVariant(c.req.param("draftId"), platform);
  if (!pack) return c.json({ error: "not ready" }, 404);
  return c.json(pack);
});

app.post("/api/items/:id/chat", async (c) => {
  const itemId = c.req.param("id");
  const body = await c.req.json();
  const message = String(body.message ?? "").trim();
  if (!message) return c.json({ error: "message required" }, 400);
  if (!getItem(itemId)) return c.json({ error: "not found" }, 404);
  const extra =
    body.extra && typeof body.extra === "object"
      ? { surface: String(body.extra.surface ?? "") || undefined }
      : undefined;

  return streamSSE(c, async (stream) => {
    try {
      await streamItemChat(
        itemId,
        message,
        async (text) => {
          await stream.writeSSE({ event: "delta", data: JSON.stringify({ text }) });
        },
        extra,
      );
      await stream.writeSSE({ event: "done", data: "{}" });
    } catch (err) {
      const raw = err instanceof Error ? err.message : "error";
      const code =
        raw === "UNCONFIGURED_API_KEY"
          ? "UNCONFIGURED_API_KEY"
          : raw.startsWith("AGENT_START:")
            ? "AGENT_START"
            : "AGENT_ERROR";
      const detail = raw.startsWith("AGENT_START:") ? raw.slice(12) : raw;
      await stream.writeSSE({
        event: "error",
        data: JSON.stringify({ code, detail }),
      });
    }
  });
});

const webDist = path.join(workspaceRoot, "web/dist");
const mime: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

app.get("*", (c) => {
  if (c.req.path.startsWith("/api") || c.req.path.startsWith("/mcp")) {
    return c.json({ error: "not found" }, 404);
  }
  if (!fs.existsSync(webDist)) return c.json({ error: "not found" }, 404);
  const url = new URL(c.req.url);
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/index.html";
  const file = path.normalize(path.join(webDist, rel));
  if (!file.startsWith(webDist)) return c.json({ error: "not found" }, 404);
  const target =
    fs.existsSync(file) && fs.statSync(file).isFile()
      ? file
      : path.join(webDist, "index.html");
  if (!fs.existsSync(target)) return c.json({ error: "not found" }, 404);
  return c.body(fs.readFileSync(target), 200, {
    "Content-Type": mime[path.extname(target)] ?? "application/octet-stream",
  });
});
