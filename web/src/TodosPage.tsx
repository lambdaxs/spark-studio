import { useEffect, useRef, useState, type FormEvent } from "react";
import { AgentPanel } from "./AgentPanel";
import { HoverDelete } from "./HoverDelete";
import { MarkdownDoc } from "./MarkdownDoc";
import { api, type ItemDetail, type ItemLink, type TodoRow } from "./api";
import { matchesQuery, useQuery } from "./shell";

type View = "open" | "today" | "all";

function startOfDay(ts: number) {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function isToday(ms: number) {
  return startOfDay(ms) === startOfDay(Date.now());
}

function formatDueShort(ms: number | null) {
  if (!ms) return "";
  if (isToday(ms)) return "今天";
  const d = new Date(ms);
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

function formatDueLong(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function toDateInput(ms: number | null) {
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

export function TodosPage() {
  const query = useQuery();
  const [view, setView] = useState<View>("open");
  const [counts, setCounts] = useState({ open: 0, today: 0, all: 0 });
  const [rows, setRows] = useState<TodoRow[]>([]);
  const [item, setItem] = useState<ItemDetail>();
  const [targets, setTargets] = useState<ItemLink[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [due, setDue] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [composing, setComposing] = useState(false);
  const [editingDue, setEditingDue] = useState(false);
  const [addingLink, setAddingLink] = useState(false);
  const [linkId, setLinkId] = useState("");
  const [dirty, setDirty] = useState(false);
  const composeRef = useRef<HTMLInputElement>(null);

  async function refreshList() {
    const [list, nextCounts] = await Promise.all([api.todos({ view }), api.todoCounts()]);
    setRows(list);
    setCounts(nextCounts);
    return list;
  }

  async function open(id: string) {
    const detail = await api.item(id);
    setItem(detail);
    setTitle(detail.title);
    setNote(detail.body);
    setDue(toDateInput(detail.dueAt));
    setDirty(false);
    setEditingDue(false);
    setAddingLink(false);
    setLinkId("");
  }

  useEffect(() => {
    void api.linkTargets().then(setTargets);
  }, []);

  useEffect(() => {
    void refreshList().then((list) => {
      setItem((cur) => {
        if (cur && list.some((r) => r.id === cur.id)) return cur;
        return undefined;
      });
    });
  }, [view]);

  useEffect(() => {
    if (item) return;
    const first = rows[0];
    if (first) void open(first.id);
  }, [rows, item]);

  useEffect(() => {
    if (!item || !dirty) return;
    const handle = window.setTimeout(() => {
      const dueAt = due ? new Date(`${due}T12:00:00`).getTime() : null;
      void api
        .patchTodo(item.id, { title, body: note, dueAt })
        .then((next) => {
          setItem(next);
          setDirty(false);
          void refreshList();
        });
    }, 450);
    return () => window.clearTimeout(handle);
  }, [title, note, due, dirty, item]);

  useEffect(() => {
    if (composing) composeRef.current?.focus();
  }, [composing]);

  async function toggle(row: TodoRow) {
    const nextStatus = row.status === "done" ? "open" : "done";
    await api.patchTodo(row.id, { status: nextStatus });
    const list = await refreshList();
    if (item?.id === row.id) {
      const detail = await api.item(row.id);
      setItem(detail);
      if (view === "open" && nextStatus === "done" && !list.some((x) => x.id === row.id)) {
        setItem(undefined);
      }
    }
  }

  async function addTodo(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;
    const created = await api.createTodo({ title: newTitle.trim() });
    setNewTitle("");
    setComposing(false);
    await refreshList();
    await open(created.id);
  }

  async function remove(id: string) {
    await api.trashItem(id);
    const list = await refreshList();
    if (item?.id === id) {
      setItem(undefined);
      if (list[0]) void open(list[0].id);
    }
  }

  const wikiLinks = item?.links.filter((l) => l.type === "wiki") ?? [];
  const otherLinks = item?.links.filter((l) => l.type !== "wiki") ?? [];
  const linkedIds = new Set(item?.links.map((l) => l.id));
  const unusedTargets = targets.filter((t) => !linkedIds.has(t.id));

  return (
    <div className="todos">
      <aside className="col views">
        <div className="col-head">视图</div>
        {(["open", "today", "all"] as const).map((v) => (
          <button
            key={v}
            className={`view-item ${view === v ? "active" : ""}`}
            onClick={() => {
              setView(v);
              setItem(undefined);
              setRows([]);
            }}
          >
            <span>{v === "open" ? "未完成" : v === "today" ? "今天" : "全部"}</span>
            <span className="count">{counts[v]}</span>
          </button>
        ))}
      </aside>

      <section className="col">
        <div className="col-head split">
          <span>任务列表</span>
          <button
            type="button"
            className="text-btn"
            onClick={() => {
              setComposing(true);
              setNewTitle("");
            }}
          >
            + 新建任务
          </button>
        </div>
        {composing ? (
          <form className="add-todo" onSubmit={(e) => void addTodo(e)}>
            <input
              ref={composeRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="任务标题，回车创建"
              onBlur={() => {
                if (!newTitle.trim()) setComposing(false);
              }}
            />
          </form>
        ) : null}
        {rows.filter((r) => matchesQuery(query, r.title)).length === 0 ? (
          <div className="empty-col">没有待办。</div>
        ) : (
          rows.filter((r) => matchesQuery(query, r.title)).map((r) => (
            <HoverDelete
              key={r.id}
              className={`row todo-row ${item?.id === r.id ? "active" : ""}`}
              onDelete={() => void remove(r.id)}
            >
              <span
                className={`check ${r.status === "done" ? "on" : ""}`}
                onClick={() => void toggle(r)}
                role="checkbox"
                aria-checked={r.status === "done"}
              />
              <button type="button" className="todo-copy" onClick={() => void open(r.id)}>
                <span className={`title ${r.status === "done" ? "done" : ""}`}>{r.title}</span>
                <span className={`meta${r.dueAt && isToday(r.dueAt) ? " today" : ""}`}>
                  {formatDueShort(r.dueAt)}
                </span>
              </button>
            </HoverDelete>
          ))
        )}
      </section>

      <article className="col">
        <div className="col-head">任务备注</div>
        {item ? (
          <div className="reader todo-note">
            <input
              className="title-input"
              value={title}
              onChange={(e) => {
                setTitle(e.target.value);
                setDirty(true);
              }}
            />
            <div className="todo-meta">
              {editingDue ? (
                <label className="due-edit">
                  <span>截止日期</span>
                  <input
                    type="date"
                    value={due}
                    autoFocus
                    onChange={(e) => {
                      setDue(e.target.value);
                      setDirty(true);
                    }}
                    onBlur={() => setEditingDue(false)}
                  />
                </label>
              ) : (
                <button type="button" onClick={() => setEditingDue(true)}>
                  截止日期 · {due ? formatDueLong(new Date(`${due}T12:00:00`).getTime()) : "未定"}
                </button>
              )}
            </div>
            <MarkdownDoc
              value={note}
              editable
              quiet
              defaultMode="view"
              placeholder="点这里写备注"
              onChange={(next) => {
                setNote(next);
                setDirty(true);
              }}
            />
            <div className="todo-links">
              {wikiLinks.length > 0 ? (
                <div className="link-line">
                  <span className="link-k">链接到 Wiki：</span>
                  {wikiLinks.map((l) => (
                    <span key={l.id} className="wiki-pill">
                      {l.title}
                      <button
                        type="button"
                        aria-label="移除"
                        onClick={() => void api.removeLink(item.id, l.id).then(setItem)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {otherLinks.length > 0 ? (
                <div className="link-line">
                  <span className="link-k">链接到收藏：</span>
                  {otherLinks.map((l) => (
                    <span key={l.id} className="wiki-pill">
                      {l.title}
                      <button
                        type="button"
                        aria-label="移除"
                        onClick={() => void api.removeLink(item.id, l.id).then(setItem)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
              {addingLink ? (
                <form
                  className="link-add"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!linkId) return;
                    void api.addLink(item.id, linkId).then((next) => {
                      setItem(next);
                      setLinkId("");
                      setAddingLink(false);
                    });
                  }}
                >
                  <select value={linkId} onChange={(e) => setLinkId(e.target.value)}>
                    <option value="">链到 Wiki 或收藏…</option>
                    {unusedTargets.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.type === "wiki" ? "Wiki" : "收藏"} · {t.title}
                      </option>
                    ))}
                  </select>
                  <button type="submit" className="chip" disabled={!linkId}>
                    添加
                  </button>
                </form>
              ) : (
                <button type="button" className="text-btn" onClick={() => setAddingLink(true)}>
                  + 链接
                </button>
              )}
            </div>
            <div className="created-at">
              创建时间 {formatDueLong(item.createdAt || Date.now())}
            </div>
          </div>
        ) : (
          <div className="empty-col">选择一条待办。</div>
        )}
      </article>

      <AgentPanel
        itemId={item?.id}
        context={item ? `当前任务「${item.title}」` : "选择一条后，对话会跟这条走。"}
        placeholder="基于当前任务提问…"
      />
    </div>
  );
}
