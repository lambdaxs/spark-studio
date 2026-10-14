import { applyChatArtifacts } from "./courses.js";
import { createDraft, getDraft, saveVariant, updateDraft, type Platform } from "./drafts.js";
import { getItem } from "./store.js";
import { createTodo, updateTodo } from "./todos.js";
import { createWikiPage, updateWikiPage } from "./wiki.js";

type Payload = { title?: string; body?: string };

const PLATFORMS = new Set<Platform>(["wechat", "xiaohongshu", "zhihu"]);

function fence(text: string, lang: string) {
  const match = text.match(new RegExp("```" + lang + "\\s*([\\s\\S]*?)```", "i"));
  return match?.[1]?.trim() ?? null;
}

function payload(raw: string | null): Payload | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Payload;
    if (!value || typeof value !== "object") return null;
    const title = typeof value.title === "string" ? value.title.trim() : "";
    const body = typeof value.body === "string" ? value.body : undefined;
    if (!title && body === undefined) return null;
    return { title, body };
  } catch {
    return null;
  }
}

export function applyItemArtifacts(itemId: string, text: string, surface?: string) {
  applyChatArtifacts(itemId, text);
  const item = getItem(itemId);
  if (!item) return;

  const wiki = payload(fence(text, "save-wiki"));
  const todo = payload(fence(text, "save-todo"));
  const draft = payload(fence(text, "save-draft"));
  const rewrite = payload(fence(text, "rewrite"));

  if (wiki?.title) createWikiPage({ title: wiki.title, body: wiki.body ?? "" });
  if (todo?.title) createTodo({ title: todo.title, body: todo.body ?? "", linkIds: [itemId] });
  if (draft?.title) createDraft({ title: draft.title, body: draft.body ?? "", linkIds: [itemId] });

  if (!rewrite) return;
  if (item.type === "wiki") {
    updateWikiPage(itemId, {
      ...(rewrite.title ? { title: rewrite.title } : {}),
      ...(rewrite.body !== undefined ? { body: rewrite.body } : {}),
    });
    return;
  }
  if (item.type === "todo") {
    updateTodo(itemId, {
      ...(rewrite.title ? { title: rewrite.title } : {}),
      ...(rewrite.body !== undefined ? { body: rewrite.body } : {}),
    });
    return;
  }
  if (item.type !== "draft") return;
  if (!surface || surface === "base") {
    updateDraft(itemId, {
      ...(rewrite.title ? { title: rewrite.title } : {}),
      ...(rewrite.body !== undefined ? { body: rewrite.body } : {}),
    });
    return;
  }
  if (!PLATFORMS.has(surface as Platform)) return;
  const current = getDraft(itemId);
  if (!current?.variants[surface as Platform]) return;
  saveVariant(itemId, surface as Platform, {
    ...(rewrite.title ? { title: rewrite.title } : {}),
    ...(rewrite.body !== undefined ? { body: rewrite.body } : {}),
  });
}
