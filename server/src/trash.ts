import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { db } from "./db.js";
import { items } from "./schema.js";
import { nid, now } from "./store.js";

const TRASHABLE = new Set(["todo", "collection_item", "wiki", "course", "draft"]);

const TYPE_LABEL: Record<string, string> = {
  todo: "待办",
  collection_item: "收藏",
  wiki: "Wiki",
  course: "课程",
  draft: "出稿",
};

export type TrashRow = {
  batchId: string;
  id: string;
  title: string;
  type: string;
  typeLabel: string;
  deletedAt: number;
  extraCount: number;
};

function descendantIds(rootId: string): string[] {
  const kids = db
    .select({ id: items.id })
    .from(items)
    .where(and(eq(items.parentId, rootId), isNull(items.deletedAt)))
    .all();
  return kids.flatMap((k) => [k.id, ...descendantIds(k.id)]);
}

export function trashItem(id: string): { batchId: string; ids: string[] } | undefined {
  const row = db.select().from(items).where(eq(items.id, id)).get();
  if (!row || row.deletedAt || !TRASHABLE.has(row.type)) return undefined;

  const ids = [id];
  if (row.type === "wiki" || row.type === "course") {
    ids.push(...descendantIds(id));
  }

  const batchId = nid();
  const ts = now();
  db.update(items)
    .set({ deletedAt: ts, trashBatchId: batchId, updatedAt: ts })
    .where(inArray(items.id, ids))
    .run();
  return { batchId, ids };
}

export function restoreTrash(batchId: string): boolean {
  const rows = db.select({ id: items.id }).from(items).where(eq(items.trashBatchId, batchId)).all();
  if (rows.length === 0) return false;
  const ts = now();
  db.update(items)
    .set({ deletedAt: null, trashBatchId: null, updatedAt: ts })
    .where(eq(items.trashBatchId, batchId))
    .run();
  return true;
}

export function listTrash(): TrashRow[] {
  const rows = db
    .select({
      id: items.id,
      title: items.title,
      type: items.type,
      parentId: items.parentId,
      deletedAt: items.deletedAt,
      trashBatchId: items.trashBatchId,
    })
    .from(items)
    .where(and(isNotNull(items.deletedAt), isNotNull(items.trashBatchId)))
    .orderBy(desc(items.deletedAt))
    .all();

  const byBatch = new Map<string, typeof rows>();
  for (const row of rows) {
    const batch = row.trashBatchId!;
    const list = byBatch.get(batch) ?? [];
    list.push(row);
    byBatch.set(batch, list);
  }

  const result: TrashRow[] = [];
  for (const [batchId, members] of byBatch) {
    const ids = new Set(members.map((m) => m.id));
    const roots = members.filter((m) => !m.parentId || !ids.has(m.parentId));
    const root =
      roots.find((m) => TRASHABLE.has(m.type)) ??
      roots[0] ??
      members[0];
    if (!root?.deletedAt) continue;
    result.push({
      batchId,
      id: root.id,
      title: root.title,
      type: root.type,
      typeLabel: TYPE_LABEL[root.type] ?? root.type,
      deletedAt: root.deletedAt,
      extraCount: Math.max(0, members.length - 1),
    });
  }
  return result.sort((a, b) => b.deletedAt - a.deletedAt);
}
