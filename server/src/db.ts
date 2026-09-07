import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const sqlite = new Database(path.join(dataDir, "workbench.db"));
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

sqlite.exec(`
CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL DEFAULT '',
  source_url TEXT,
  author TEXT,
  content_kind TEXT,
  original_at INTEGER,
  imported_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (collection_id, item_id)
);
CREATE TABLE IF NOT EXISTS item_groups (
  item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  group_id TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  PRIMARY KEY (item_id, group_id)
);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  item_id TEXT NOT NULL UNIQUE REFERENCES items(id) ON DELETE CASCADE,
  cursor_agent_id TEXT,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS item_links (
  from_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  to_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  PRIMARY KEY (from_id, to_id)
);
CREATE TABLE IF NOT EXISTS draft_variants (
  draft_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  platform TEXT NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '[]',
  cover_note TEXT NOT NULL DEFAULT '',
  image_briefs TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'empty',
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (draft_id, platform)
);
CREATE TABLE IF NOT EXISTS course_assets (
  id TEXT PRIMARY KEY,
  course_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL DEFAULT '',
  extracted_text TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS course_bindings (
  course_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  target_id TEXT NOT NULL,
  PRIMARY KEY (course_id, kind, target_id)
);
CREATE TABLE IF NOT EXISTS lesson_canvases (
  item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
  spec TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`);

function addColumn(table: string, name: string, ddl: string) {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === name)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

addColumn("items", "parent_id", "parent_id TEXT");
addColumn("items", "sort_order", "sort_order INTEGER NOT NULL DEFAULT 0");
addColumn("items", "status", "status TEXT");
addColumn("items", "due_at", "due_at INTEGER");
addColumn("items", "completed_at", "completed_at INTEGER");
addColumn("items", "deleted_at", "deleted_at INTEGER");
addColumn("items", "trash_batch_id", "trash_batch_id TEXT");

export const db = drizzle(sqlite, { schema });
export { sqlite };
export const workspaceRoot = root;
