import {
  sqliteTable,
  text,
  integer,
  primaryKey,
} from "drizzle-orm/sqlite-core";

export const collections = sqliteTable("collections", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const groups = sqliteTable("groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique(),
  createdAt: integer("created_at").notNull(),
});

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  sourceUrl: text("source_url"),
  author: text("author"),
  contentKind: text("content_kind"),
  originalAt: integer("original_at"),
  importedAt: integer("imported_at"),
  parentId: text("parent_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  status: text("status"),
  dueAt: integer("due_at"),
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
  trashBatchId: text("trash_batch_id"),
});

export const collectionItems = sqliteTable(
  "collection_items",
  {
    collectionId: text("collection_id")
      .notNull()
      .references(() => collections.id, { onDelete: "cascade" }),
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.collectionId, t.itemId] })],
);

export const itemGroups = sqliteTable(
  "item_groups",
  {
    itemId: text("item_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    groupId: text("group_id")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.itemId, t.groupId] })],
);

export const conversations = sqliteTable("conversations", {
  id: text("id").primaryKey(),
  itemId: text("item_id")
    .notNull()
    .unique()
    .references(() => items.id, { onDelete: "cascade" }),
  cursorAgentId: text("cursor_agent_id"),
  createdAt: integer("created_at").notNull(),
});

export const itemLinks = sqliteTable(
  "item_links",
  {
    fromId: text("from_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    toId: text("to_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.fromId, t.toId] })],
);

export const messages = sqliteTable("messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id")
    .notNull()
    .references(() => conversations.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  content: text("content").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const draftVariants = sqliteTable(
  "draft_variants",
  {
    draftId: text("draft_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    platform: text("platform").notNull(),
    title: text("title").notNull().default(""),
    body: text("body").notNull().default(""),
    summary: text("summary").notNull().default(""),
    tags: text("tags").notNull().default("[]"),
    coverNote: text("cover_note").notNull().default(""),
    imageBriefs: text("image_briefs").notNull().default("[]"),
    status: text("status").notNull().default("empty"),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => [primaryKey({ columns: [t.draftId, t.platform] })],
);

export const courseAssets = sqliteTable("course_assets", {
  id: text("id").primaryKey(),
  courseId: text("course_id")
    .notNull()
    .references(() => items.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  mime: text("mime").notNull().default(""),
  extractedText: text("extracted_text").notNull().default(""),
  createdAt: integer("created_at").notNull(),
});

export const courseBindings = sqliteTable(
  "course_bindings",
  {
    courseId: text("course_id")
      .notNull()
      .references(() => items.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    targetId: text("target_id").notNull(),
  },
  (t) => [primaryKey({ columns: [t.courseId, t.kind, t.targetId] })],
);

export const lessonCanvases = sqliteTable("lesson_canvases", {
  itemId: text("item_id")
    .primaryKey()
    .references(() => items.id, { onDelete: "cascade" }),
  spec: text("spec").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
