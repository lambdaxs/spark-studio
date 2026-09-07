import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db.js";
import { items } from "./schema.js";
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

export type TodoRow = {
  id: string;
  title: string;
  status: string;
  dueAt: number | null;
  completedAt: number | null;
  groups: Group[];
};

function startOfDay(ts = Date.now()) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function endOfToday() {
  return startOfDay() + 24 * 60 * 60 * 1000;
}

export function todoViewCounts() {
  const rows = db
    .select({ status: items.status, dueAt: items.dueAt })
    .from(items)
    .where(and(eq(items.type, "todo"), isNull(items.deletedAt)))
    .all();
  const end = endOfToday();
  return {
    open: rows.filter((r) => r.status !== "done").length,
    today: rows.filter(
      (r) => r.status !== "done" && r.dueAt != null && r.dueAt < end,
    ).length,
    all: rows.length,
  };
}

export function todoCount() {
  const row = db
    .select({ n: sql<number>`count(*)` })
    .from(items)
    .where(eq(items.type, "todo"))
    .get();
  return Number(row?.n ?? 0);
}

export function listTodos(filter: {
  view: "open" | "today" | "all";
  groupId?: string;
  ungrouped?: boolean;
}): TodoRow[] {
  let rows = db
    .select({
      id: items.id,
      title: items.title,
      status: items.status,
      dueAt: items.dueAt,
      completedAt: items.completedAt,
    })
    .from(items)
    .where(and(eq(items.type, "todo"), isNull(items.deletedAt)))
    .orderBy(asc(items.status), asc(items.dueAt), desc(items.createdAt))
    .all();

  if (filter.view === "open") {
    rows = rows.filter((r) => r.status !== "done");
  } else if (filter.view === "today") {
    const end = endOfToday();
    rows = rows.filter(
      (r) => r.status !== "done" && r.dueAt != null && r.dueAt < end,
    );
  }

  const grouped = groupsForItems(rows.map((r) => r.id));
  let result: TodoRow[] = rows.map((r) => ({
    id: r.id,
    title: r.title,
    status: r.status ?? "open",
    dueAt: r.dueAt,
    completedAt: r.completedAt,
    groups: grouped.get(r.id) ?? [],
  }));

  if (filter.ungrouped) {
    result = result.filter((r) => r.groups.length === 0);
  } else if (filter.groupId) {
    result = result.filter((r) => r.groups.some((g) => g.id === filter.groupId));
  }
  return result;
}

export function createTodo(input: {
  title: string;
  body?: string;
  dueAt?: number | null;
  groups?: string[];
  linkIds?: string[];
}): ItemDetail {
  const ts = now();
  const row = {
    id: nid(),
    type: "todo",
    title: input.title.trim() || "未命名待办",
    body: input.body ?? "",
    sourceUrl: null,
    author: null,
    contentKind: null,
    originalAt: null,
    importedAt: null,
    parentId: null,
    sortOrder: 0,
    status: "open",
    dueAt: input.dueAt ?? null,
    completedAt: null,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(items).values(row).run();
  applyGroups(row.id, input.groups ?? []);
  if (input.linkIds?.length) setLinks(row.id, input.linkIds);
  return getItem(row.id)!;
}

export function updateTodo(
  id: string,
  patch: {
    title?: string;
    body?: string;
    status?: "open" | "done";
    dueAt?: number | null;
    linkIds?: string[];
  },
): ItemDetail | undefined {
  const current = db.select().from(items).where(eq(items.id, id)).get();
  if (!current || current.type !== "todo" || current.deletedAt) return undefined;

  let status = current.status ?? "open";
  let completedAt = current.completedAt;
  if (patch.status === "done" && status !== "done") {
    status = "done";
    completedAt = now();
  } else if (patch.status === "open" && status === "done") {
    status = "open";
    completedAt = null;
  }

  db.update(items)
    .set({
      title: patch.title?.trim() || current.title,
      body: patch.body ?? current.body,
      status,
      dueAt: patch.dueAt === undefined ? current.dueAt : patch.dueAt,
      completedAt,
      updatedAt: now(),
    })
    .where(eq(items.id, id))
    .run();

  if (patch.linkIds) setLinks(id, patch.linkIds);
  return getItem(id);
}

export function listLinkTargets() {
  return db
    .select({
      id: items.id,
      title: items.title,
      type: items.type,
    })
    .from(items)
    .where(and(inArray(items.type, ["wiki", "collection_item"]), isNull(items.deletedAt)))
    .orderBy(asc(items.type), asc(items.title))
    .all();
}
