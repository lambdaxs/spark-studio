import { useState } from "react";
import { api } from "./api";
import { failureDetail } from "./feedback";
import { useShell } from "./shell";

type Action = "wiki" | "todo" | "draft" | "course";

const LABEL: Record<Action, string> = {
  wiki: "写成 Wiki",
  todo: "记一条待办",
  draft: "做成底稿",
  course: "拿去设计课",
};

export function SendOnward({
  title,
  body,
  sourceId,
  actions,
}: {
  title: string;
  body: string;
  sourceId: string;
  actions: Action[];
}) {
  const { openItem } = useShell();
  const [busy, setBusy] = useState<Action>();
  const [note, setNote] = useState("");

  async function run(action: Action) {
    if (busy) return;
    setBusy(action);
    setNote("");
    try {
      if (action === "wiki") {
        const page = await api.createWiki({ title, body });
        openItem({ module: "wiki", id: page.id });
      } else if (action === "todo") {
        const todo = await api.createTodo({
          title,
          body: body.slice(0, 400),
          linkIds: [sourceId],
        });
        openItem({ module: "todos", id: todo.id });
      } else if (action === "draft") {
        const draft = await api.createDraft({ title, body });
        openItem({ module: "publish", id: draft.item.id });
      } else {
        const course = await api.createCourse({ title });
        await api.addCourseBinding(course.item.id, "item", sourceId);
        openItem({ module: "courses", id: course.item.id, courseView: "studio" });
      }
    } catch (err) {
      const detail = failureDetail(err);
      setNote(detail || "没有送出去");
      setBusy(undefined);
    }
  }

  return (
    <div className="onward">
      {actions.map((action) => (
        <button key={action} type="button" className="chip" disabled={Boolean(busy)} onClick={() => void run(action)}>
          {busy === action ? "正在送…" : LABEL[action]}
        </button>
      ))}
      {note ? <span className="onward-note">{note}</span> : null}
    </div>
  );
}
