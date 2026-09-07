import { and, asc, eq, isNull, sql } from "drizzle-orm";
import { db } from "./db.js";
import { items } from "./schema.js";
import {
  applyGroups,
  getItem,
  groupsForItems,
  nid,
  now,
  type Group,
  type ItemDetail,
} from "./store.js";

export type WikiNode = {
  id: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  groups: Group[];
  children: WikiNode[];
};

function nextSort(parentId: string | null) {
  const row = db
    .select({ max: sql<number>`coalesce(max(${items.sortOrder}), -1)` })
    .from(items)
    .where(
      and(
        eq(items.type, "wiki"),
        isNull(items.deletedAt),
        parentId == null ? isNull(items.parentId) : eq(items.parentId, parentId),
      ),
    )
    .get();
  return Number(row?.max ?? -1) + 1;
}

export function wikiCount() {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(items)
    .where(eq(items.type, "wiki"))
    .get();
  return Number(row?.n ?? 0);
}

export function listWikiTree(): WikiNode[] {
  const rows = db
    .select({
      id: items.id,
      title: items.title,
      parentId: items.parentId,
      sortOrder: items.sortOrder,
    })
    .from(items)
    .where(and(eq(items.type, "wiki"), isNull(items.deletedAt)))
    .orderBy(asc(items.sortOrder), asc(items.createdAt))
    .all();
  const grouped = groupsForItems(rows.map((r) => r.id));
  const nodes = new Map<string, WikiNode>();
  for (const r of rows) {
    nodes.set(r.id, {
      id: r.id,
      title: r.title,
      parentId: r.parentId,
      sortOrder: r.sortOrder ?? 0,
      groups: grouped.get(r.id) ?? [],
      children: [],
    });
  }
  const roots: WikiNode[] = [];
  for (const node of nodes.values()) {
    if (node.parentId && nodes.has(node.parentId)) {
      nodes.get(node.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export function createWikiPage(input: {
  title: string;
  body?: string;
  parentId?: string | null;
  groups?: string[];
}): ItemDetail {
  const ts = now();
  const parentId = input.parentId ?? null;
  const row = {
    id: nid(),
    type: "wiki",
    title: input.title.trim() || "未命名页面",
    body: input.body ?? "",
    sourceUrl: null,
    author: null,
    contentKind: null,
    originalAt: null,
    importedAt: null,
    parentId,
    sortOrder: nextSort(parentId),
    status: null,
    dueAt: null,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(items).values(row).run();
  applyGroups(row.id, input.groups ?? []);
  return getItem(row.id)!;
}

export function updateWikiPage(
  id: string,
  patch: { title?: string; body?: string; parentId?: string | null },
): ItemDetail | undefined {
  const current = db.select().from(items).where(eq(items.id, id)).get();
  if (!current || current.type !== "wiki" || current.deletedAt) return undefined;
  const nextParent = patch.parentId === undefined ? current.parentId : patch.parentId;
  db.update(items)
    .set({
      title: patch.title?.trim() || current.title,
      body: patch.body ?? current.body,
      parentId: nextParent,
      updatedAt: now(),
    })
    .where(eq(items.id, id))
    .run();
  return getItem(id);
}

function wikiSiblings(parentId: string | null) {
  return db
    .select({ id: items.id, parentId: items.parentId })
    .from(items)
    .where(
      and(
        eq(items.type, "wiki"),
        isNull(items.deletedAt),
        parentId == null ? isNull(items.parentId) : eq(items.parentId, parentId),
      ),
    )
    .orderBy(asc(items.sortOrder), asc(items.createdAt))
    .all();
}

function descendantIds(rootId: string) {
  const ids = new Set<string>();
  const walk = (parentId: string) => {
    for (const child of wikiSiblings(parentId)) {
      ids.add(child.id);
      walk(child.id);
    }
  };
  walk(rootId);
  return ids;
}

function writeOrder(parentId: string | null, orderedIds: string[]) {
  const ts = now();
  orderedIds.forEach((id, sortOrder) => {
    db.update(items)
      .set({ parentId, sortOrder, updatedAt: ts })
      .where(eq(items.id, id))
      .run();
  });
}

export function moveWikiPage(
  id: string,
  destParentId: string | null,
  index: number,
): WikiNode[] | undefined {
  const current = db.select().from(items).where(eq(items.id, id)).get();
  if (!current || current.type !== "wiki" || current.deletedAt) return undefined;
  if (destParentId === id) return undefined;
  if (destParentId) {
    const dest = db.select().from(items).where(eq(items.id, destParentId)).get();
    if (!dest || dest.type !== "wiki" || dest.deletedAt) return undefined;
    if (descendantIds(id).has(destParentId)) return undefined;
  }

  const oldParentId = current.parentId;
  const destKids = wikiSiblings(destParentId).filter((row) => row.id !== id);
  const at = Math.max(0, Math.min(Math.floor(index), destKids.length));
  writeOrder(destParentId, [
    ...destKids.slice(0, at).map((row) => row.id),
    id,
    ...destKids.slice(at).map((row) => row.id),
  ]);
  if (oldParentId !== destParentId) {
    writeOrder(
      oldParentId,
      wikiSiblings(oldParentId).filter((row) => row.id !== id).map((row) => row.id),
    );
  }
  return listWikiTree();
}
