export type Group = { id: string; name: string };

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

export type ItemLink = { id: string; title: string; type: string };

export type ItemDetail = ItemSummary & {
  type: string;
  body: string;
  sourceUrl: string | null;
  contentKind: string | null;
  importedAt: number | null;
  parentId: string | null;
  status: string | null;
  dueAt: number | null;
  completedAt: number | null;
  createdAt: number;
  collectionId: string | null;
  collectionName: string | null;
  links: ItemLink[];
  ancestors: { id: string; title: string }[];
};

export type WikiNode = {
  id: string;
  title: string;
  parentId: string | null;
  sortOrder: number;
  groups: Group[];
  children: WikiNode[];
};

export type TodoRow = {
  id: string;
  title: string;
  status: string;
  dueAt: number | null;
  completedAt: number | null;
  groups: Group[];
};

export type Platform = "wechat" | "xiaohongshu" | "zhihu";

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

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
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

export type CourseBinding = {
  kind: "collection" | "item";
  targetId: string;
  title: string;
};

export type CourseAsset = { id: string; filename: string; excerpt: string };

export type CourseDetail = {
  item: ItemDetail;
  tree: CourseNode[];
  assets: CourseAsset[];
  bindings: CourseBinding[];
};

export type CanvasSpec = {
  kind: "steps";
  title: string;
  steps: { title: string; body: string; figure?: string }[];
};

export type LessonDetail = {
  item: ItemDetail;
  canvas: CanvasSpec | null;
  courseId: string;
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

export type SettingsStatus = {
  cursorApiKeyConfigured: boolean;
  cursorApiKeyHint: string;
};

export type BindTargets = {
  collections: { id: string; title: string; kind: "collection" }[];
  items: { id: string; title: string; kind: "item"; type: string }[];
};

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const api = {
  settings: () => fetch("/api/settings").then((r) => json<SettingsStatus>(r)),
  saveSettings: (cursorApiKey: string) =>
    fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cursorApiKey }),
    }).then((r) => json<SettingsStatus>(r)),
  collections: () => fetch("/api/collections").then((r) => json<Collection[]>(r)),
  groups: () => fetch("/api/groups").then((r) => json<Group[]>(r)),
  items: (collectionId: string, query: { groupId?: string; ungrouped?: boolean }) => {
    const q = new URLSearchParams();
    if (query.groupId) q.set("groupId", query.groupId);
    if (query.ungrouped) q.set("ungrouped", "1");
    const qs = q.toString();
    const suffix = qs ? `?${qs}` : "";
    return fetch(`/api/collections/${collectionId}/items${suffix}`).then((r) =>
      json<ItemSummary[]>(r),
    );
  },
  item: (id: string) => fetch(`/api/items/${id}`).then((r) => json<ItemDetail>(r)),
  trashItem: (id: string) =>
    fetch(`/api/items/${id}/trash`, { method: "POST" }).then((r) =>
      json<{ batchId: string; ids: string[] }>(r),
    ),
  trash: () => fetch("/api/trash").then((r) => json<TrashRow[]>(r)),
  restore: (batchId: string) =>
    fetch(`/api/trash/${batchId}/restore`, { method: "POST" }).then((r) => json<{ ok: boolean }>(r)),
  messages: (id: string) =>
    fetch(`/api/items/${id}/messages`).then((r) => json<ChatMessage[]>(r)),
  tag: (itemId: string, name: string) =>
    fetch(`/api/items/${itemId}/groups`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<ItemDetail>(r)),
  untag: (itemId: string, groupId: string) =>
    fetch(`/api/items/${itemId}/groups/${groupId}`, { method: "DELETE" }).then((r) =>
      json<ItemDetail>(r),
    ),
  renameGroup: (id: string, name: string) =>
    fetch(`/api/groups/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((r) => json<Group>(r)),
  deleteGroup: (id: string) => fetch(`/api/groups/${id}`, { method: "DELETE" }),
  wikiTree: () => fetch("/api/wiki/tree").then((r) => json<WikiNode[]>(r)),
  createWiki: (input: { title: string; parentId?: string | null; body?: string; groups?: string[] }) =>
    fetch("/api/wiki/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<ItemDetail>(r)),
  patchWiki: (id: string, patch: { title?: string; body?: string }) =>
    fetch(`/api/wiki/pages/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<ItemDetail>(r)),
  moveWiki: (id: string, dest: { parentId: string | null; index: number }) =>
    fetch(`/api/wiki/pages/${id}/move`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(dest),
    }).then((r) => json<WikiNode[]>(r)),
  todoCounts: () =>
    fetch("/api/todos/counts").then((r) => json<{ open: number; today: number; all: number }>(r)),
  todos: (query: { view: "open" | "today" | "all"; groupId?: string; ungrouped?: boolean }) => {
    const q = new URLSearchParams();
    q.set("view", query.view);
    if (query.groupId) q.set("groupId", query.groupId);
    if (query.ungrouped) q.set("ungrouped", "1");
    return fetch(`/api/todos?${q.toString()}`).then((r) => json<TodoRow[]>(r));
  },
  createTodo: (input: { title: string; dueAt?: number | null; groups?: string[] }) =>
    fetch("/api/todos", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<ItemDetail>(r)),
  patchTodo: (
    id: string,
    patch: { title?: string; body?: string; status?: "open" | "done"; dueAt?: number | null },
  ) =>
    fetch(`/api/todos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<ItemDetail>(r)),
  linkTargets: () => fetch("/api/link-targets").then((r) => json<ItemLink[]>(r)),
  addLink: (fromId: string, toId: string) =>
    fetch(`/api/items/${fromId}/links`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toId }),
    }).then((r) => json<ItemDetail>(r)),
  removeLink: (fromId: string, toId: string) =>
    fetch(`/api/items/${fromId}/links/${toId}`, { method: "DELETE" }).then((r) =>
      json<ItemDetail>(r),
    ),
  drafts: (query: { groupId?: string; ungrouped?: boolean; ready?: boolean }) => {
    const q = new URLSearchParams();
    if (query.groupId) q.set("groupId", query.groupId);
    if (query.ungrouped) q.set("ungrouped", "1");
    if (query.ready) q.set("ready", "1");
    const qs = q.toString();
    return fetch(`/api/drafts${qs ? `?${qs}` : ""}`).then((r) => json<DraftRow[]>(r));
  },
  draft: (id: string) => fetch(`/api/drafts/${id}`).then((r) => json<DraftDetail>(r)),
  createDraft: (input: { title: string; body?: string }) =>
    fetch("/api/drafts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }).then((r) => json<DraftDetail>(r)),
  patchDraft: (id: string, patch: { title?: string; body?: string }) =>
    fetch(`/api/drafts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<DraftDetail>(r)),
  saveVariant: (id: string, platform: Platform, patch: Partial<Variant>) =>
    fetch(`/api/drafts/${id}/variants/${platform}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<DraftDetail>(r)),
  generateVariant: (id: string, platform: Platform) =>
    fetch(`/api/drafts/${id}/variants/${platform}/from-base`, { method: "POST" }).then((r) =>
      json<DraftDetail>(r),
    ),
  exportVariant: (id: string, platform: Platform) =>
    fetch(`/api/export/variants/${id}/${platform}`).then((r) => json<unknown>(r)),
  courses: () => fetch("/api/courses").then((r) => json<CourseRow[]>(r)),
  courseHistory: () => fetch("/api/courses/history").then((r) => json<CourseHistoryRow[]>(r)),
  course: (id: string) => fetch(`/api/courses/${id}`).then((r) => json<CourseDetail>(r)),
  createCourse: (input?: { title?: string }) =>
    fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input ?? {}),
    }).then((r) => json<CourseDetail>(r)),
  clearCourseArchive: (id: string) =>
    fetch(`/api/courses/${id}/archive`, { method: "DELETE" }).then((r) => json<{ ok: boolean }>(r)),
  patchCourse: (id: string, patch: { title?: string; body?: string }) =>
    fetch(`/api/courses/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).then((r) => json<CourseDetail>(r)),
  confirmCourse: (id: string) =>
    fetch(`/api/courses/${id}/confirm`, { method: "POST" }).then((r) => json<CourseDetail>(r)),
  suggestOutline: (id: string) =>
    fetch(`/api/courses/${id}/suggest-outline`, { method: "POST" }).then((r) =>
      json<CourseDetail>(r),
    ),
  addCourseBinding: (id: string, kind: "collection" | "item", targetId: string) =>
    fetch(`/api/courses/${id}/bindings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, targetId }),
    }).then((r) => json<CourseDetail>(r)),
  removeCourseBinding: (id: string, kind: string, targetId: string) =>
    fetch(`/api/courses/${id}/bindings/${kind}/${targetId}`, { method: "DELETE" }).then((r) =>
      json<CourseDetail>(r),
    ),
  uploadCourseAsset: (id: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return fetch(`/api/courses/${id}/assets`, { method: "POST", body }).then((r) =>
      json<CourseDetail>(r),
    );
  },
  removeCourseAsset: (id: string, assetId: string) =>
    fetch(`/api/courses/${id}/assets/${assetId}`, { method: "DELETE" }).then((r) =>
      json<CourseDetail>(r),
    ),
  bindTargets: () => fetch("/api/courses/bind-targets").then((r) => json<BindTargets>(r)),
  lesson: (id: string) => fetch(`/api/lessons/${id}`).then((r) => json<LessonDetail>(r)),
  patchLesson: (id: string, status: "not_started" | "in_progress" | "done") =>
    fetch(`/api/lessons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    }).then((r) => json<LessonDetail>(r)),
};

export async function streamChat(
  itemId: string,
  message: string,
  onDelta: (text: string) => void,
  extra?: { surface?: string },
): Promise<{ error?: string }> {
  const res = await fetch(`/api/items/${itemId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, extra }),
  });
  if (!res.ok || !res.body) {
    return { error: await res.text() };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let error: string | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = part.match(/^event: (.+)$/m)?.[1];
      const dataLine = part
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      if (!event || !dataLine) continue;
      if (event === "delta") {
        const payload = JSON.parse(dataLine) as { text: string };
        onDelta(payload.text);
      } else if (event === "error") {
        const payload = JSON.parse(dataLine) as { code: string; detail: string };
        error =
          payload.code === "UNCONFIGURED_API_KEY"
            ? "未配置 Cursor API Key。打开左下角设置填入。"
            : payload.detail || payload.code;
      }
    }
  }
  return { error };
}

export async function streamLesson(
  id: string,
  onDelta: (text: string) => void,
): Promise<{ error?: string; lesson?: LessonDetail }> {
  const res = await fetch(`/api/lessons/${id}/generate`, { method: "POST" });
  if (!res.ok || !res.body) {
    return { error: await res.text() };
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let error: string | undefined;
  let lesson: LessonDetail | undefined;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const parts = buffer.split("\n\n");
    buffer = parts.pop() ?? "";
    for (const part of parts) {
      const event = part.match(/^event: (.+)$/m)?.[1];
      const dataLine = part
        .split("\n")
        .filter((l) => l.startsWith("data: "))
        .map((l) => l.slice(6))
        .join("\n");
      if (!event || !dataLine) continue;
      if (event === "delta") {
        const payload = JSON.parse(dataLine) as { text: string };
        onDelta(payload.text);
      } else if (event === "done") {
        const payload = JSON.parse(dataLine) as LessonDetail;
        if (payload?.item) lesson = payload;
      } else if (event === "error") {
        const payload = JSON.parse(dataLine) as { code: string; detail: string };
        error = payload.detail || payload.code;
      }
    }
  }
  return { error, lesson };
}
