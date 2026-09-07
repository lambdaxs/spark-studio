import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { db } from "./db.js";
import {
  collectionItems,
  collections,
  conversations,
  groups,
  itemGroups,
  itemLinks,
  items,
  messages,
} from "./schema.js";

export type Group = { id: string; name: string };
export type ItemLink = { id: string; title: string; type: string };
export type Collection = {
  id: string;
  name: string;
  description: string;
  itemCount: number;
};
export type ItemSummary = {
  id: string;
  title: string;
  author: string | null;
  originalAt: number | null;
  groups: Group[];
};
export type ItemDetail = ItemSummary & {
  type: string;
  body: string;
  sourceUrl: string | null;
  contentKind: string | null;
  importedAt: number | null;
  parentId: string | null;
  sortOrder: number;
  status: string | null;
  dueAt: number | null;
  completedAt: number | null;
  createdAt: number;
  updatedAt: number;
  collectionId: string | null;
  collectionName: string | null;
  links: ItemLink[];
  ancestors: { id: string; title: string }[];
};

export function nid() {
  return crypto.randomUUID();
}

export function now() {
  return Date.now();
}

export function listCollections(): Collection[] {
  const rows = db
    .select({
      id: collections.id,
      name: collections.name,
      description: collections.description,
      itemCount: sql<number>`count(${items.id})`.as("item_count"),
    })
    .from(collections)
    .leftJoin(collectionItems, eq(collectionItems.collectionId, collections.id))
    .leftJoin(
      items,
      and(eq(items.id, collectionItems.itemId), isNull(items.deletedAt)),
    )
    .groupBy(collections.id)
    .orderBy(collections.createdAt)
    .all();
  return rows.map((r) => ({
    ...r,
    itemCount: Number(r.itemCount),
  }));
}

export function createCollection(name: string, description = "") {
  const existing = db
    .select()
    .from(collections)
    .where(eq(collections.name, name))
    .get();
  if (existing) return existing;
  const row = {
    id: nid(),
    name,
    description,
    createdAt: now(),
  };
  db.insert(collections).values(row).run();
  return row;
}

export function listGroups(): Group[] {
  return db.select().from(groups).orderBy(groups.createdAt).all();
}

export function getOrCreateGroup(name: string): Group {
  const trimmed = name.trim();
  const existing = db
    .select()
    .from(groups)
    .where(eq(groups.name, trimmed))
    .get();
  if (existing) return existing;
  const row = { id: nid(), name: trimmed, createdAt: now() };
  db.insert(groups).values(row).run();
  return row;
}

export function renameGroup(id: string, name: string) {
  db.update(groups).set({ name: name.trim() }).where(eq(groups.id, id)).run();
  return db.select().from(groups).where(eq(groups.id, id)).get();
}

export function deleteGroup(id: string) {
  db.delete(groups).where(eq(groups.id, id)).run();
}

export function groupsForItems(itemIds: string[]): Map<string, Group[]> {
  const map = new Map<string, Group[]>();
  if (itemIds.length === 0) return map;
  const rows = db
    .select({
      itemId: itemGroups.itemId,
      id: groups.id,
      name: groups.name,
    })
    .from(itemGroups)
    .innerJoin(groups, eq(groups.id, itemGroups.groupId))
    .where(inArray(itemGroups.itemId, itemIds))
    .all();
  for (const row of rows) {
    const list = map.get(row.itemId) ?? [];
    list.push({ id: row.id, name: row.name });
    map.set(row.itemId, list);
  }
  return map;
}

export function listCollectionItems(
  collectionId: string,
  filter: { groupId?: string; ungrouped?: boolean },
): ItemSummary[] {
  const base = db
    .select({
      id: items.id,
      title: items.title,
      author: items.author,
      originalAt: items.originalAt,
    })
    .from(collectionItems)
    .innerJoin(items, eq(items.id, collectionItems.itemId))
    .where(and(eq(collectionItems.collectionId, collectionId), isNull(items.deletedAt)))
    .orderBy(desc(items.originalAt), desc(items.importedAt))
    .all();

  const grouped = groupsForItems(base.map((r) => r.id));
  let result = base.map((r) => ({
    ...r,
    groups: grouped.get(r.id) ?? [],
  }));

  if (filter.ungrouped) {
    result = result.filter((r) => r.groups.length === 0);
  } else if (filter.groupId) {
    result = result.filter((r) =>
      r.groups.some((g) => g.id === filter.groupId),
    );
  }
  return result;
}

export function getItem(id: string): ItemDetail | undefined {
  const row = db.select().from(items).where(eq(items.id, id)).get();
  if (!row || row.deletedAt) return undefined;

  const membership = db
    .select({
      collectionId: collections.id,
      collectionName: collections.name,
    })
    .from(collectionItems)
    .innerJoin(collections, eq(collections.id, collectionItems.collectionId))
    .where(eq(collectionItems.itemId, id))
    .get();

  const grouped = groupsForItems([id]);
  const linkIds = db
    .select({ toId: itemLinks.toId })
    .from(itemLinks)
    .where(eq(itemLinks.fromId, id))
    .all()
    .map((r) => r.toId);
  const links: ItemLink[] =
    linkIds.length === 0
      ? []
      : db
          .select({ id: items.id, title: items.title, type: items.type })
          .from(items)
          .where(inArray(items.id, linkIds))
          .all();

  const ancestors: { id: string; title: string }[] = [];
  let cursor = row.parentId;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    seen.add(cursor);
    const parent = db
      .select({ id: items.id, title: items.title, parentId: items.parentId })
      .from(items)
      .where(eq(items.id, cursor))
      .get();
    if (!parent) break;
    ancestors.unshift({ id: parent.id, title: parent.title });
    cursor = parent.parentId;
  }

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    body: row.body,
    author: row.author,
    originalAt: row.originalAt,
    sourceUrl: row.sourceUrl,
    contentKind: row.contentKind,
    importedAt: row.importedAt,
    parentId: row.parentId,
    sortOrder: row.sortOrder ?? 0,
    status: row.status,
    dueAt: row.dueAt,
    completedAt: row.completedAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    groups: grouped.get(id) ?? [],
    collectionId: membership?.collectionId ?? null,
    collectionName: membership?.collectionName ?? null,
    links,
    ancestors,
  };
}

export function importItem(input: {
  collectionName: string;
  title: string;
  body: string;
  sourceUrl?: string | null;
  author?: string | null;
  contentKind?: string | null;
  originalAt?: number | null;
  groups?: string[];
}) {
  const collection = createCollection(input.collectionName);
  const ts = now();
  const item = {
    id: nid(),
    type: "collection_item",
    title: input.title,
    body: input.body,
    sourceUrl: input.sourceUrl ?? null,
    author: input.author ?? null,
    contentKind: input.contentKind ?? null,
    originalAt: input.originalAt ?? null,
    importedAt: ts,
    createdAt: ts,
    updatedAt: ts,
  };
  db.insert(items).values(item).run();
  db.insert(collectionItems)
    .values({ collectionId: collection.id, itemId: item.id })
    .run();
  for (const name of input.groups ?? []) {
    if (!name.trim()) continue;
    const g = getOrCreateGroup(name);
    db.insert(itemGroups)
      .values({ itemId: item.id, groupId: g.id })
      .onConflictDoNothing()
      .run();
  }
  return getItem(item.id)!;
}

export function tagItem(itemId: string, groupName: string) {
  const g = getOrCreateGroup(groupName);
  db.insert(itemGroups)
    .values({ itemId, groupId: g.id })
    .onConflictDoNothing()
    .run();
  return getItem(itemId);
}

export function untagItem(itemId: string, groupId: string) {
  db.delete(itemGroups)
    .where(and(eq(itemGroups.itemId, itemId), eq(itemGroups.groupId, groupId)))
    .run();
  return getItem(itemId);
}

export function getOrCreateConversation(itemId: string) {
  const existing = db
    .select()
    .from(conversations)
    .where(eq(conversations.itemId, itemId))
    .get();
  if (existing) return existing;
  const row = {
    id: nid(),
    itemId,
    cursorAgentId: null as string | null,
    createdAt: now(),
  };
  db.insert(conversations).values(row).run();
  return row;
}

export function setConversationAgent(id: string, cursorAgentId: string) {
  db.update(conversations)
    .set({ cursorAgentId })
    .where(eq(conversations.id, id))
    .run();
}

export function listMessages(itemId: string) {
  const conv = db
    .select()
    .from(conversations)
    .where(eq(conversations.itemId, itemId))
    .get();
  if (!conv) return [];
  return db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conv.id))
    .orderBy(messages.createdAt)
    .all();
}

export function hasMessages(itemId: string) {
  return listMessages(itemId).length > 0;
}

export function clearItemMessages(itemId: string) {
  const conv = db
    .select()
    .from(conversations)
    .where(eq(conversations.itemId, itemId))
    .get();
  if (!conv) return false;
  db.delete(messages).where(eq(messages.conversationId, conv.id)).run();
  db.update(conversations).set({ cursorAgentId: null }).where(eq(conversations.id, conv.id)).run();
  return true;
}

export function addMessage(
  conversationId: string,
  role: "user" | "assistant",
  content: string,
) {
  const row = {
    id: nid(),
    conversationId,
    role,
    content,
    createdAt: now(),
  };
  db.insert(messages).values(row).run();
  return row;
}

export function applyGroups(itemId: string, names: string[]) {
  for (const name of names) {
    if (!name.trim()) continue;
    const g = getOrCreateGroup(name);
    db.insert(itemGroups)
      .values({ itemId, groupId: g.id })
      .onConflictDoNothing()
      .run();
  }
}

export function setLinks(fromId: string, toIds: string[]) {
  db.delete(itemLinks).where(eq(itemLinks.fromId, fromId)).run();
  for (const toId of toIds) {
    if (toId === fromId) continue;
    db.insert(itemLinks)
      .values({ fromId, toId })
      .onConflictDoNothing()
      .run();
  }
}

export function addLink(fromId: string, toId: string) {
  if (fromId === toId) return getItem(fromId);
  db.insert(itemLinks)
    .values({ fromId, toId })
    .onConflictDoNothing()
    .run();
  return getItem(fromId);
}

export function removeLink(fromId: string, toId: string) {
  db.delete(itemLinks)
    .where(and(eq(itemLinks.fromId, fromId), eq(itemLinks.toId, toId)))
    .run();
  return getItem(fromId);
}

export function findItemByTitle(type: string, title: string) {
  return db
    .select()
    .from(items)
    .where(and(eq(items.type, type), eq(items.title, title), isNull(items.deletedAt)))
    .get();
}

export function isEmpty() {
  return db.select().from(collections).all().length === 0;
}
