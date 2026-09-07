import fs from "node:fs";
import path from "node:path";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db, workspaceRoot } from "./db.js";
import { courseAssets, courseBindings, collections, items, lessonCanvases } from "./schema.js";
import { extractUpload } from "./extract.js";
import {
  applyGroups,
  getItem,
  groupsForItems,
  listCollectionItems,
  listCollections,
  clearItemMessages,
  hasMessages,
  nid,
  now,
  type Group,
  type ItemDetail,
} from "./store.js";

export type OutlineDraft = { title: string; children?: OutlineDraft[] };

export type CanvasStep = {
  title: string;
  body: string;
  figure?: "wave" | "spectrum" | "transform" | "tree" | "none";
};

export type CanvasSpec = {
  kind: "steps";
  title: string;
  steps: CanvasStep[];
};

export type CourseNode = {
  id: string;
  title: string;
  contentKind: "chapter" | "lesson";
  status: string;
  hasBody: boolean;
  hasCanvas: boolean;
  children: CourseNode[];
};

export type CourseBinding = {
  kind: "collection" | "item";
  targetId: string;
  title: string;
};

export type CourseAsset = {
  id: string;
  filename: string;
  excerpt: string;
};

export type CourseRow = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  groups: Group[];
  lessonCount: number;
  doneCount: number;
};

export type CourseHistoryRow = {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
};

export type CourseDetail = {
  item: ItemDetail;
  tree: CourseNode[];
  assets: CourseAsset[];
  bindings: CourseBinding[];
};

export type LessonDetail = {
  item: ItemDetail;
  canvas: CanvasSpec | null;
  courseId: string;
};

const FIGURES = new Set(["wave", "spectrum", "transform", "tree", "none"]);
const assetDir = path.join(workspaceRoot, "data", "course-assets");

function childrenOf(parentId: string) {
  return db
    .select()
    .from(items)
    .where(
      and(eq(items.parentId, parentId), eq(items.type, "course_node"), isNull(items.deletedAt)),
    )
    .orderBy(asc(items.sortOrder), asc(items.createdAt))
    .all();
}

function canvasSet(ids: string[]) {
  const set = new Set<string>();
  if (ids.length === 0) return set;
  const rows = db
    .select({ id: lessonCanvases.itemId })
    .from(lessonCanvases)
    .where(inArray(lessonCanvases.itemId, ids))
    .all();
  for (const row of rows) set.add(row.id);
  return set;
}

function toTree(parentId: string, canvases: Set<string>): CourseNode[] {
  return childrenOf(parentId).map((row) => {
    const kids = toTree(row.id, canvases);
    const kind =
      row.contentKind === "chapter" || kids.length > 0 ? "chapter" : "lesson";
    return {
      id: row.id,
      title: row.title,
      contentKind: kind,
      status: row.status ?? "not_started",
      hasBody: Boolean(row.body?.trim()),
      hasCanvas: canvases.has(row.id),
      children: kids,
    };
  });
}

function flatten(nodes: CourseNode[]): CourseNode[] {
  return nodes.flatMap((n) => [n, ...flatten(n.children)]);
}

function subtitleOf(body: string) {
  const line = body.split("\n").map((s) => s.trim()).find(Boolean) ?? "";
  return line.length > 42 ? `${line.slice(0, 41)}…` : line;
}

function subtreeHasBody(id: string): boolean {
  const row = db.select().from(items).where(eq(items.id, id)).get();
  if (row?.body?.trim()) return true;
  return childrenOf(id).some((c) => subtreeHasBody(c.id));
}

function deleteNodeRecursive(id: string) {
  for (const child of childrenOf(id)) deleteNodeRecursive(child.id);
  db.delete(lessonCanvases).where(eq(lessonCanvases.itemId, id)).run();
  db.delete(items).where(eq(items.id, id)).run();
}

function createNode(input: {
  parentId: string;
  title: string;
  contentKind: "chapter" | "lesson";
  sortOrder: number;
}) {
  const ts = now();
  const row = {
    id: nid(),
    type: "course_node",
    title: input.title,
    body: "",
    sourceUrl: null,
    author: null,
    contentKind: input.contentKind,
    originalAt: null,
    importedAt: null,
    parentId: input.parentId,
    sortOrder: input.sortOrder,
    status: input.contentKind === "lesson" ? "not_started" : null,
    dueAt: null,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    trashBatchId: null,
  };
  db.insert(items).values(row).run();
  return row;
}

function applyLevel(parentId: string, drafts: OutlineDraft[]) {
  const existing = childrenOf(parentId);
  const used = new Set<string>();
  drafts.forEach((draft, index) => {
    const title = draft.title.trim();
    if (!title) return;
    const kids = (draft.children ?? []).filter((c) => c.title.trim());
    const kind: "chapter" | "lesson" = kids.length > 0 ? "chapter" : "lesson";
    let row = existing.find((e) => e.title === title && !used.has(e.id));
    if (!row) {
      row = createNode({ parentId, title, contentKind: kind, sortOrder: index });
    } else {
      db.update(items)
        .set({
          sortOrder: index,
          contentKind: kind,
          status: kind === "lesson" ? (row.status ?? "not_started") : null,
          updatedAt: now(),
        })
        .where(eq(items.id, row.id))
        .run();
    }
    used.add(row.id);
    applyLevel(row.id, kids);
  });
  for (const extra of existing) {
    if (used.has(extra.id)) continue;
    if (!subtreeHasBody(extra.id)) deleteNodeRecursive(extra.id);
  }
}

export function parseCanvasSpec(raw: unknown): CanvasSpec | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  if (obj.kind !== "steps" || !Array.isArray(obj.steps)) return null;
  const steps: CanvasStep[] = [];
  for (const step of obj.steps) {
    if (!step || typeof step !== "object") continue;
    const s = step as Record<string, unknown>;
    const title = String(s.title ?? "").trim();
    if (!title) continue;
    const figure = String(s.figure ?? "none");
    steps.push({
      title,
      body: String(s.body ?? ""),
      figure: FIGURES.has(figure) ? (figure as CanvasStep["figure"]) : "none",
    });
  }
  if (steps.length === 0) return null;
  return {
    kind: "steps",
    title: String(obj.title ?? "").trim() || "演示",
    steps,
  };
}

function asOutline(raw: unknown): OutlineDraft[] | null {
  if (Array.isArray(raw)) {
    const nodes = raw
      .map((n) => nodeFromUnknown(n))
      .filter((n): n is OutlineDraft => n != null);
    return nodes.length ? nodes : null;
  }
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.outline)) return asOutline(obj.outline);
    if (Array.isArray(obj.children)) return asOutline(obj.children);
    const one = nodeFromUnknown(raw);
    return one ? [one] : null;
  }
  return null;
}

function nodeFromUnknown(raw: unknown): OutlineDraft | null {
  if (typeof raw === "string" && raw.trim()) return { title: raw.trim() };
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const title = String(obj.title ?? obj.name ?? "").trim();
  if (!title) return null;
  const children = Array.isArray(obj.children)
    ? obj.children.map(nodeFromUnknown).filter((n): n is OutlineDraft => n != null)
    : undefined;
  return { title, children };
}

function parseFenced(text: string, lang: string) {
  const re = new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "i");
  return text.match(re)?.[1]?.trim() ?? null;
}

function parseMarkdownOutline(text: string): OutlineDraft[] | null {
  const lines = text.split("\n");
  const items: { indent: number; title: string }[] = [];
  for (const line of lines) {
    const m = line.match(/^(\s*)(?:[-*]|\d+[.)])\s+(.+)$/);
    if (!m) continue;
    const title = m[2].replace(/\*\*/g, "").trim();
    if (!title) continue;
    items.push({ indent: Math.floor(m[1].length / 2), title });
  }
  if (items.length < 2) return null;
  const root: OutlineDraft[] = [];
  const stack: { indent: number; node: OutlineDraft }[] = [];
  for (const item of items) {
    const node: OutlineDraft = { title: item.title, children: [] };
    while (stack.length && stack[stack.length - 1].indent >= item.indent) stack.pop();
    if (stack.length === 0) root.push(node);
    else {
      const parent = stack[stack.length - 1].node;
      parent.children = parent.children ?? [];
      parent.children.push(node);
    }
    stack.push({ indent: item.indent, node });
  }
  const clean = (nodes: OutlineDraft[]): OutlineDraft[] =>
    nodes.map((n) => ({
      title: n.title,
      children: n.children && n.children.length ? clean(n.children) : undefined,
    }));
  return clean(root);
}

export function parseAgentArtifacts(text: string) {
  const outlineFence = parseFenced(text, "outline") ?? parseFenced(text, "json");
  let outline: OutlineDraft[] | null = null;
  if (outlineFence) {
    try {
      outline = asOutline(JSON.parse(outlineFence));
    } catch {
      outline = parseMarkdownOutline(outlineFence);
    }
  }
  if (!outline) outline = parseMarkdownOutline(text);

  const brief = parseFenced(text, "brief");
  const lesson = parseFenced(text, "lesson");

  let canvas: CanvasSpec | null = null;
  const canvasFence = parseFenced(text, "canvas");
  if (canvasFence) {
    try {
      canvas = parseCanvasSpec(JSON.parse(canvasFence));
    } catch {
      canvas = null;
    }
  }

  return { outline, brief, lesson, canvas };
}

export function courseCount() {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(items)
    .where(eq(items.type, "course"))
    .get();
  return Number(row?.n ?? 0);
}

export function listCourseTree(courseId: string): CourseNode[] {
  const ids = db
    .select({ id: items.id })
    .from(items)
    .where(eq(items.type, "course_node"))
    .all()
    .map((r) => r.id);
  return toTree(courseId, canvasSet(ids));
}

export function listCourses(): CourseRow[] {
  const rows = db
    .select({
      id: items.id,
      title: items.title,
      body: items.body,
      status: items.status,
    })
    .from(items)
    .where(and(eq(items.type, "course"), eq(items.status, "ready"), isNull(items.deletedAt)))
    .orderBy(asc(items.createdAt))
    .all();
  const grouped = groupsForItems(rows.map((r) => r.id));
  return rows.map((r) => {
    const tree = listCourseTree(r.id);
    const leaves = flatten(tree).filter((n) => n.contentKind === "lesson");
    return {
      id: r.id,
      title: r.title,
      subtitle: subtitleOf(r.body ?? ""),
      status: r.status ?? "ready",
      groups: grouped.get(r.id) ?? [],
      lessonCount: leaves.length,
      doneCount: leaves.filter((n) => n.status === "done").length,
    };
  });
}

export function listCourseHistory(): CourseHistoryRow[] {
  const rows = db
    .select({
      id: items.id,
      title: items.title,
      status: items.status,
      updatedAt: items.updatedAt,
    })
    .from(items)
    .where(and(eq(items.type, "course"), isNull(items.deletedAt)))
    .orderBy(desc(items.updatedAt))
    .all();
  return rows
    .filter((r) => (r.status ?? "designing") !== "ready" || hasMessages(r.id))
    .map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status ?? "designing",
      updatedAt: r.updatedAt,
    }));
}

export function listBindings(courseId: string): CourseBinding[] {
  const rows = db
    .select()
    .from(courseBindings)
    .where(eq(courseBindings.courseId, courseId))
    .all();
  const result: CourseBinding[] = [];
  for (const row of rows) {
    if (row.kind === "collection") {
      const col = db.select().from(collections).where(eq(collections.id, row.targetId)).get();
      if (col) result.push({ kind: "collection", targetId: col.id, title: col.name });
    } else {
      const item = db.select().from(items).where(eq(items.id, row.targetId)).get();
      if (item) result.push({ kind: "item", targetId: item.id, title: item.title });
    }
  }
  return result;
}

export function listAssets(courseId: string): CourseAsset[] {
  return db
    .select()
    .from(courseAssets)
    .where(eq(courseAssets.courseId, courseId))
    .orderBy(asc(courseAssets.createdAt))
    .all()
    .map((r) => ({
      id: r.id,
      filename: r.filename,
      excerpt: r.extractedText.slice(0, 240),
    }));
}

export function getCourse(id: string): CourseDetail | undefined {
  const item = getItem(id);
  if (!item || item.type !== "course") return undefined;
  return {
    item,
    tree: listCourseTree(id),
    assets: listAssets(id),
    bindings: listBindings(id),
  };
}

export function createCourse(input: { title: string; body?: string; groups?: string[] }) {
  const ts = now();
  const row = {
    id: nid(),
    type: "course",
    title: input.title.trim() || "未命名课程",
    body: input.body ?? "",
    sourceUrl: null,
    author: null,
    contentKind: null,
    originalAt: null,
    importedAt: null,
    parentId: null,
    sortOrder: 0,
    status: "designing",
    dueAt: null,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
    deletedAt: null,
    trashBatchId: null,
  };
  db.insert(items).values(row).run();
  applyGroups(row.id, input.groups ?? []);
  return getCourse(row.id)!;
}

export function updateCourse(
  id: string,
  patch: { title?: string; body?: string; status?: "designing" | "ready" },
) {
  const current = db.select().from(items).where(eq(items.id, id)).get();
  if (!current || current.type !== "course") return undefined;
  const locked = current.status === "ready";
  db.update(items)
    .set({
      title: locked ? current.title : patch.title?.trim() || current.title,
      body: locked ? current.body : (patch.body ?? current.body),
      status: patch.status ?? current.status,
      updatedAt: now(),
    })
    .where(eq(items.id, id))
    .run();
  return getCourse(id);
}

export function applyOutline(courseId: string, drafts: OutlineDraft[]) {
  const course = db.select().from(items).where(eq(items.id, courseId)).get();
  if (!course || course.type !== "course" || course.status === "ready") return undefined;
  applyLevel(courseId, drafts);
  db.update(items).set({ updatedAt: now() }).where(eq(items.id, courseId)).run();
  return getCourse(courseId);
}

export function clearCourseArchive(id: string) {
  const course = db.select().from(items).where(eq(items.id, id)).get();
  if (!course || course.type !== "course" || course.deletedAt || course.status !== "ready") {
    return undefined;
  }
  clearItemMessages(id);
  return true;
}

export function confirmCourse(id: string) {
  const course = getCourse(id);
  if (!course) return undefined;
  const leaves = flatten(course.tree).filter((n) => n.contentKind === "lesson");
  if (leaves.length === 0) return { error: "empty" as const };
  return updateCourse(id, { status: "ready" });
}

export function addBinding(courseId: string, kind: "collection" | "item", targetId: string) {
  const course = db.select().from(items).where(eq(items.id, courseId)).get();
  if (!course || course.type !== "course" || course.status === "ready") return undefined;
  db.insert(courseBindings)
    .values({ courseId, kind, targetId })
    .onConflictDoNothing()
    .run();
  return getCourse(courseId);
}

export function removeBinding(courseId: string, kind: string, targetId: string) {
  const course = db.select().from(items).where(eq(items.id, courseId)).get();
  if (!course || course.status === "ready") return getCourse(courseId);
  db.delete(courseBindings)
    .where(
      and(
        eq(courseBindings.courseId, courseId),
        eq(courseBindings.kind, kind),
        eq(courseBindings.targetId, targetId),
      ),
    )
    .run();
  return getCourse(courseId);
}

export async function addAsset(courseId: string, filename: string, mime: string, buf: Buffer) {
  const course = db.select().from(items).where(eq(items.id, courseId)).get();
  if (!course || course.type !== "course" || course.status === "ready") return undefined;
  const extracted = await extractUpload(filename, buf);
  const id = nid();
  fs.mkdirSync(assetDir, { recursive: true });
  const ext = path.extname(filename).slice(0, 8);
  fs.writeFileSync(path.join(assetDir, id + ext), buf);
  db.insert(courseAssets)
    .values({
      id,
      courseId,
      filename,
      mime,
      extractedText: extracted,
      createdAt: now(),
    })
    .run();
  return getCourse(courseId);
}

export function removeAsset(courseId: string, assetId: string) {
  const course = db.select().from(items).where(eq(items.id, courseId)).get();
  if (!course || course.status === "ready") return getCourse(courseId);
  db.delete(courseAssets)
    .where(and(eq(courseAssets.id, assetId), eq(courseAssets.courseId, courseId)))
    .run();
  return getCourse(courseId);
}

export function saveCanvas(itemId: string, spec: CanvasSpec) {
  const ts = now();
  const existing = db.select().from(lessonCanvases).where(eq(lessonCanvases.itemId, itemId)).get();
  if (existing) {
    db.update(lessonCanvases)
      .set({ spec: JSON.stringify(spec), updatedAt: ts })
      .where(eq(lessonCanvases.itemId, itemId))
      .run();
  } else {
    db.insert(lessonCanvases)
      .values({ itemId, spec: JSON.stringify(spec), updatedAt: ts })
      .run();
  }
}

export function getCanvas(itemId: string): CanvasSpec | null {
  const row = db.select().from(lessonCanvases).where(eq(lessonCanvases.itemId, itemId)).get();
  if (!row) return null;
  try {
    return parseCanvasSpec(JSON.parse(row.spec));
  } catch {
    return null;
  }
}

export function courseIdOf(nodeId: string): string | undefined {
  let cursor: string | null = nodeId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const row = db.select().from(items).where(eq(items.id, cursor)).get();
    if (!row) return undefined;
    if (row.type === "course") return row.id;
    cursor = row.parentId;
  }
  return undefined;
}

export function getLesson(id: string): LessonDetail | undefined {
  const item = getItem(id);
  if (!item || item.type !== "course_node") return undefined;
  const courseId = courseIdOf(id);
  if (!courseId) return undefined;
  return { item, canvas: getCanvas(id), courseId };
}

export function saveLessonBody(id: string, body: string) {
  const row = db.select().from(items).where(eq(items.id, id)).get();
  if (!row || row.type !== "course_node") return undefined;
  const nextStatus =
    row.status === "not_started" || !row.status ? "in_progress" : row.status;
  db.update(items)
    .set({ body, status: nextStatus, updatedAt: now() })
    .where(eq(items.id, id))
    .run();
  return getLesson(id);
}

export function setLessonStatus(id: string, status: "not_started" | "in_progress" | "done") {
  const row = db.select().from(items).where(eq(items.id, id)).get();
  if (!row || row.type !== "course_node") return undefined;
  db.update(items)
    .set({
      status,
      completedAt: status === "done" ? now() : null,
      updatedAt: now(),
    })
    .where(eq(items.id, id))
    .run();
  return getLesson(id);
}

export function applyChatArtifacts(itemId: string, text: string) {
  const item = getItem(itemId);
  if (!item) return;
  const art = parseAgentArtifacts(text);
  if (item.type === "course") {
    if (item.status === "ready") return;
    if (art.outline) applyOutline(itemId, art.outline);
    if (art.brief) updateCourse(itemId, { body: art.brief });
  }
  if (item.type === "course_node") {
    if (art.canvas) saveCanvas(itemId, art.canvas);
    if (art.lesson) saveLessonBody(itemId, art.lesson);
  }
}

export const FFT_OUTLINE: OutlineDraft[] = [
  { title: "傅里叶在干什么" },
  {
    title: "从时间到频率",
    children: [{ title: "周期信号" }, { title: "非周期与积分" }],
  },
  { title: "离散化与 FFT" },
];

export const DP_OUTLINE: OutlineDraft[] = [
  { title: "问题拆成互相重叠的子问题" },
  {
    title: "写出状态",
    children: [{ title: "状态是什么" }, { title: "转移与边界" }],
  },
  { title: "两道例题" },
];

export function suggestOutline(courseId: string): OutlineDraft[] {
  const course = getItem(courseId);
  const bindings = listBindings(courseId);
  const assets = db.select().from(courseAssets).where(eq(courseAssets.courseId, courseId)).all();
  const hay = [
    course?.title ?? "",
    course?.body ?? "",
    ...bindings.map((b) => b.title),
    ...assets.map((a) => a.filename + a.extractedText.slice(0, 200)),
  ].join(" ");
  if (/傅里叶|FFT|频率|信号/.test(hay)) return FFT_OUTLINE;
  if (/动态规划|背包|状态转移/.test(hay)) return DP_OUTLINE;
  const title = course?.title?.trim() || "这门课";
  return [
    { title: `${title}：要解决什么` },
    {
      title: "核心结构",
      children: [{ title: "第一刀" }, { title: "第二刀" }],
    },
    { title: "练习与带走的结论" },
  ];
}

export function defaultCanvasFor(title: string): CanvasSpec | null {
  if (!/(?<!非)周期|时间|频率|傅里叶|FFT|变换|频谱/.test(title)) return null;
  return {
    kind: "steps",
    title: "从波形到频谱",
    steps: [
      { title: "只看时间", body: "波形沿着时间上下跳，看不出里面有哪些纯音。", figure: "wave" },
      { title: "拆成正弦", body: "周期信号可以看成一组正弦叠出来。", figure: "wave" },
      { title: "改看频率", body: "每一根谱线对应一个纯音。时间里难做的，频率里往往是乘法。", figure: "spectrum" },
    ],
  };
}

export function heuristicLessonBody(lesson: ItemDetail, course: CourseDetail) {
  const path = [...lesson.ancestors.map((a) => a.title), lesson.title].join(" / ");
  const materials = boundMaterialText(course.item.id).slice(0, 1200);
  return `这一课属于「${course.item.title}」，路径：${path}。

${course.item.body ? `设计备忘：${course.item.body}\n\n` : ""}先把这一节要建立的直觉写清楚，再补例子。点开时生成一次，之后就固化在这一课里。

## 这一步在整门课里的位置

不要把公式堆在最前面。先问：如果没有这一课，下一课的哪句话会说不通。

${materials ? `## 来自绑定材料\n\n${materials}\n` : ""}## 带走

用自己的话复述这一课在干什么，能讲给没看过材料的人听。`;
}

export function boundMaterialText(courseId: string, limit = 1800) {
  const chunks: string[] = [];
  const seen = new Set<string>();
  for (const bind of listBindings(courseId)) {
    if (bind.kind === "item") {
      if (seen.has(bind.targetId)) continue;
      seen.add(bind.targetId);
      const item = getItem(bind.targetId);
      if (item) chunks.push(`【${item.title}】\n${item.body.slice(0, 800)}`);
    } else {
      const itemsIn = listCollectionItems(bind.targetId, {});
      for (const summary of itemsIn.slice(0, 4)) {
        if (seen.has(summary.id)) continue;
        seen.add(summary.id);
        const item = getItem(summary.id);
        if (item) chunks.push(`【收藏·${item.title}】\n${item.body.slice(0, 400)}`);
      }
    }
  }
  const assets = db.select().from(courseAssets).where(eq(courseAssets.courseId, courseId)).all();
  for (const a of assets.slice(0, 3)) {
    chunks.push(`【文件·${a.filename}】\n${a.extractedText.slice(0, 800)}`);
  }
  const text = chunks.join("\n\n");
  return text.length > limit ? `${text.slice(0, limit)}\n…` : text;
}

export function coursePromptContext(item: ItemDetail) {
  const courseId = item.type === "course" ? item.id : courseIdOf(item.id);
  if (!courseId) return "";
  const course = getCourse(courseId);
  if (!course) return "";
  const outline = JSON.stringify(course.tree.map(stripNode), null, 2);
  const binds = course.bindings.map((b) => `${b.kind === "collection" ? "收藏夹" : "条目"}「${b.title}」`).join("、") || "无";
  const files = course.assets.map((a) => a.filename).join("、") || "无";
  return `课程：${course.item.title}
状态：${course.item.status === "ready" ? "目录已确认" : "设计中"}
分组：${course.item.groups.map((g) => g.name).join("、") || "无"}
绑定：${binds}
文件：${files}

设计备忘：
${course.item.body || "（还没有）"}

当前大纲树：
${outline}

绑定材料摘录：
${boundMaterialText(courseId, 2500) || "（无）"}`;
}

function stripNode(n: CourseNode): unknown {
  return {
    title: n.title,
    kind: n.contentKind,
    children: n.children.length ? n.children.map(stripNode) : undefined,
  };
}

export function listBindTargets() {
  return {
    collections: listCollections().map((c) => ({ id: c.id, title: c.name, kind: "collection" as const })),
    items: db
      .select({ id: items.id, title: items.title, type: items.type })
      .from(items)
      .where(inArray(items.type, ["wiki", "collection_item"]))
      .orderBy(asc(items.type), asc(items.title))
      .all()
      .map((r) => ({ id: r.id, title: r.title, kind: "item" as const, type: r.type })),
  };
}

export function findCourseNode(courseId: string, title: string) {
  return flatten(listCourseTree(courseId)).find((n) => n.title === title);
}
