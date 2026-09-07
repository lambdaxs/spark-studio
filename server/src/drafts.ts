import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db.js";
import { draftVariants, items } from "./schema.js";
import {
  applyGroups,
  getItem,
  groupsForItems,
  nid,
  now,
  setLinks,
  type Group,
  type ItemDetail,
} from "./store.js";

export const PLATFORMS = ["wechat", "xiaohongshu", "zhihu"] as const;
export type Platform = (typeof PLATFORMS)[number];

export type Variant = {
  platform: Platform;
  title: string;
  body: string;
  summary: string;
  tags: string[];
  coverNote: string;
  imageBriefs: string[];
  status: "empty" | "ready";
  updatedAt: number;
};

export type DraftRow = {
  id: string;
  title: string;
  groups: Group[];
  ready: Platform[];
};

export type DraftDetail = {
  item: ItemDetail;
  variants: Partial<Record<Platform, Variant>>;
};

function parseJsonArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw) as unknown;
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
}

function toVariant(row: typeof draftVariants.$inferSelect): Variant {
  return {
    platform: row.platform as Platform,
    title: row.title,
    body: row.body,
    summary: row.summary,
    tags: parseJsonArray(row.tags),
    coverNote: row.coverNote,
    imageBriefs: parseJsonArray(row.imageBriefs),
    status: row.status === "ready" ? "ready" : "empty",
    updatedAt: row.updatedAt,
  };
}

export function draftCount() {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(items)
    .where(eq(items.type, "draft"))
    .get();
  return Number(row?.n ?? 0);
}

export function listDrafts(filter: {
  groupId?: string;
  ungrouped?: boolean;
  ready?: boolean;
}): DraftRow[] {
  const rows = db
    .select({ id: items.id, title: items.title })
    .from(items)
    .where(and(eq(items.type, "draft"), isNull(items.deletedAt)))
    .orderBy(desc(items.updatedAt))
    .all();
  const grouped = groupsForItems(rows.map((r) => r.id));
  const variantRows = db.select().from(draftVariants).all();
  const readyMap = new Map<string, Platform[]>();
  for (const v of variantRows) {
    if (v.status !== "ready") continue;
    const list = readyMap.get(v.draftId) ?? [];
    list.push(v.platform as Platform);
    readyMap.set(v.draftId, list);
  }
  let result: DraftRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    groups: grouped.get(r.id) ?? [],
    ready: readyMap.get(r.id) ?? [],
  }));
  if (filter.ungrouped) result = result.filter((r) => r.groups.length === 0);
  else if (filter.groupId) {
    result = result.filter((r) => r.groups.some((g) => g.id === filter.groupId));
  }
  if (filter.ready) result = result.filter((r) => r.ready.length > 0);
  return result;
}

export function getDraft(id: string): DraftDetail | undefined {
  const item = getItem(id);
  if (!item || item.type !== "draft") return undefined;
  const rows = db
    .select()
    .from(draftVariants)
    .where(eq(draftVariants.draftId, id))
    .all();
  const variants: Partial<Record<Platform, Variant>> = {};
  for (const row of rows) variants[row.platform as Platform] = toVariant(row);
  return { item, variants };
}

export function createDraft(input: {
  title: string;
  body?: string;
  groups?: string[];
  linkIds?: string[];
}): DraftDetail {
  const ts = now();
  const row = {
    id: nid(),
    type: "draft",
    title: input.title.trim() || "未命名底稿",
    body: input.body ?? "",
    sourceUrl: null,
    author: null,
    contentKind: null,
    originalAt: null,
    importedAt: null,
    parentId: null,
    sortOrder: 0,
    status: null,
    dueAt: null,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(items).values(row).run();
  applyGroups(row.id, input.groups ?? []);
  if (input.linkIds?.length) setLinks(row.id, input.linkIds);
  return getDraft(row.id)!;
}

export function updateDraft(
  id: string,
  patch: { title?: string; body?: string },
): DraftDetail | undefined {
  const current = db.select().from(items).where(eq(items.id, id)).get();
  if (!current || current.type !== "draft" || current.deletedAt) return undefined;
  db.update(items)
    .set({
      title: patch.title?.trim() || current.title,
      body: patch.body ?? current.body,
      updatedAt: now(),
    })
    .where(eq(items.id, id))
    .run();
  return getDraft(id);
}

function upsertVariant(draftId: string, platform: Platform, patch: Partial<Variant>) {
  const existing = db
    .select()
    .from(draftVariants)
    .where(
      and(eq(draftVariants.draftId, draftId), eq(draftVariants.platform, platform)),
    )
    .get();
  const ts = now();
  if (!existing) {
    db.insert(draftVariants)
      .values({
        draftId,
        platform,
        title: patch.title ?? "",
        body: patch.body ?? "",
        summary: patch.summary ?? "",
        tags: JSON.stringify(patch.tags ?? []),
        coverNote: patch.coverNote ?? "",
        imageBriefs: JSON.stringify(patch.imageBriefs ?? []),
        status: patch.status ?? "empty",
        updatedAt: ts,
      })
      .run();
    return;
  }
  db.update(draftVariants)
    .set({
      title: patch.title ?? existing.title,
      body: patch.body ?? existing.body,
      summary: patch.summary ?? existing.summary,
      tags: patch.tags ? JSON.stringify(patch.tags) : existing.tags,
      coverNote: patch.coverNote ?? existing.coverNote,
      imageBriefs: patch.imageBriefs
        ? JSON.stringify(patch.imageBriefs)
        : existing.imageBriefs,
      status: patch.status ?? existing.status,
      updatedAt: ts,
    })
    .where(
      and(eq(draftVariants.draftId, draftId), eq(draftVariants.platform, platform)),
    )
    .run();
}

export function saveVariant(
  draftId: string,
  platform: Platform,
  patch: Partial<Variant>,
): DraftDetail | undefined {
  const draft = getDraft(draftId);
  if (!draft) return undefined;
  upsertVariant(draftId, platform, patch);
  return getDraft(draftId);
}

function plainExcerpt(markdown: string, n: number) {
  const text = markdown.replace(/[#*`>\-]/g, "").replace(/\s+/g, " ").trim();
  return text.slice(0, n);
}

export function generateVariantFromBase(
  draftId: string,
  platform: Platform,
): DraftDetail | undefined {
  const draft = getDraft(draftId);
  if (!draft) return undefined;
  const groups = draft.item.groups.map((g) => g.name);
  const baseTitle = draft.item.title;
  const baseBody = draft.item.body;
  if (platform === "wechat") {
    upsertVariant(draftId, platform, {
      title: baseTitle,
      body: baseBody,
      summary: plainExcerpt(baseBody, 80),
      tags: [],
      coverNote: "一张安静的书桌或论文手稿，不要人像。",
      imageBriefs: [],
      status: "empty",
    });
  } else if (platform === "xiaohongshu") {
    upsertVariant(draftId, platform, {
      title: baseTitle.length > 18 ? baseTitle.slice(0, 18) : baseTitle,
      body: baseBody
        .split("\n")
        .map((l) => l.replace(/^#+\s*/, "").trim())
        .filter(Boolean)
        .slice(0, 8)
        .join("\n\n"),
      summary: "",
      tags: groups,
      coverNote: "第一张图当封面：大标题+一个关键隐喻。",
      imageBriefs: [
        `封面：标题「${baseTitle}」配一个简单示意图`,
        "第二张：把文中最关键的一步画成三格过程",
        "第三张：一句可带走的结论，留白多、字少",
      ],
      status: "empty",
    });
  } else {
    upsertVariant(draftId, platform, {
      title: baseTitle,
      body: baseBody,
      summary: "",
      tags: groups,
      coverNote: "专栏封面用一张干净的概念图。",
      imageBriefs: [],
      status: "empty",
    });
  }
  return getDraft(draftId);
}

export function listReadyExports() {
  const rows = db
    .select()
    .from(draftVariants)
    .where(eq(draftVariants.status, "ready"))
    .all();
  return rows.map((row) => {
    const item = getItem(row.draftId);
    return {
      draftId: row.draftId,
      draftTitle: item?.title ?? "",
      ...toVariant(row),
    };
  });
}

export function exportVariant(draftId: string, platform: Platform) {
  const draft = getDraft(draftId);
  const variant = draft?.variants[platform];
  if (!draft || !variant || variant.status !== "ready") return undefined;
  return {
    platform,
    title: variant.title,
    body: variant.body,
    summary: variant.summary,
    tags: variant.tags,
    coverNote: variant.coverNote,
    imageBriefs: variant.imageBriefs,
    sourceDraftId: draftId,
    sourceTitle: draft.item.title,
    exportedAt: Date.now(),
  };
}
