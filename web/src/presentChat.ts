const NAMED = ["outline", "brief", "lesson", "canvas", "save-wiki", "save-todo", "save-draft", "rewrite"] as const;
type NamedFence = (typeof NAMED)[number];

const FENCE = "outline|brief|lesson|canvas|save-wiki|save-todo|save-draft|rewrite";
const CLOSED = new RegExp("```(" + FENCE + ")\\s*([\\s\\S]*?)```", "gi");
const JSON_FENCE = /```json\s*([\s\S]*?)```/gi;
const OPEN = new RegExp("```(" + FENCE + ")\\b[\\s\\S]*$", "i");

const DONE: Record<NamedFence, string> = {
  outline: "已写入大纲",
  brief: "已写入设计备忘",
  lesson: "已写入讲义",
  canvas: "已写入逐步演示",
  "save-wiki": "已写成 Wiki",
  "save-todo": "已记成待办",
  "save-draft": "已做成底稿",
  rewrite: "已写回当前这条",
};

const WRITING: Record<NamedFence, string> = {
  outline: "正在写入大纲",
  brief: "正在写入设计备忘",
  lesson: "正在写入讲义",
  canvas: "正在写入逐步演示",
  "save-wiki": "正在写成 Wiki",
  "save-todo": "正在记成待办",
  "save-draft": "正在做成底稿",
  rewrite: "正在写回当前这条",
};

function isNamed(value: string): value is NamedFence {
  return (NAMED as readonly string[]).includes(value);
}

function looksLikeOutline(body: string) {
  try {
    const value = JSON.parse(body) as unknown;
    return (
      Array.isArray(value) &&
      value.every((row) => !!row && typeof row === "object" && "title" in row)
    );
  } catch {
    return false;
  }
}

export function presentChat(content: string, streaming: boolean) {
  const notes: string[] = [];
  let text = content.replace(CLOSED, (_all, kind: string) => {
    const name = kind.toLowerCase();
    if (!isNamed(name)) return _all;
    notes.push(streaming ? WRITING[name] : DONE[name]);
    return "";
  });
  text = text.replace(JSON_FENCE, (all, body: string) => {
    if (!looksLikeOutline(body.trim())) return all;
    notes.push(streaming ? WRITING.outline : DONE.outline);
    return "";
  });
  const open = text.match(OPEN);
  if (open && isNamed(open[1].toLowerCase())) {
    const name = open[1].toLowerCase() as NamedFence;
    notes.push(streaming ? WRITING[name] : `${DONE[name]}未完成`);
    text = text.slice(0, open.index);
  }
  return { text: text.trim(), notes };
}
