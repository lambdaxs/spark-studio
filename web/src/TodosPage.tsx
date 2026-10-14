import { useEffect, useRef, useState, type FormEvent } from "react";
import { AgentPanel } from "./AgentPanel";
import { useAutosave } from "./autosave";
import { formatLocalDate } from "./dates";
import { SaveStatus, StatusBlock, failureDetail } from "./feedback";
import { HoverDelete } from "./HoverDelete";
import { MarkdownDoc } from "./MarkdownDoc";
import { api, type ItemDetail, type ItemLink, type TodoRow } from "./api";
import { matchesQuery, useQuery, useShell } from "./shell";

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
  return formatLocalDate(ms);
}

export function TodosPage() {
  const query = useQuery();
  const { pending, consumePending, openItem } = useShell();
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
  const [linkQuery, setLinkQuery] = useState("");
  const [listLoaded, setListLoaded] = useState(false);
  const [listError, setListError] = useState("");
  const composeRef = useRef<HTMLInputElement>(null);

  async function refreshList() {
    try {
      const [list, nextCounts] = await Promise.all([api.todos({ view }), api.todoCounts()]);
      setRows(list);
      setCounts(nextCounts);
      setListError("");
      setListLoaded(true);
      return list;
    } catch (err) {
      const detail = failureDetail(err);
      if (detail) setListError(detail);
      setListLoaded(true);
      return [];
    }
  }

  async function open(id: string) {
    const detail = await api.item(id);
    setItem(detail);
    setTitle(detail.title);
    setNote(detail.body);
    setDue(toDateInput(detail.dueAt));
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

  const snapshot = JSON.stringify({ key: item?.id ?? "", title, note, due });
  const saveState = useAutosave(item?.id, snapshot, async (raw) => {
    const data = JSON.parse(raw) as { key: string; title: string; note: string; due: string };
    if (!data.key) return;
    const dueAt = data.due ? new Date(`${data.due}T12:00:00`).getTime() : null;
    const next = await api.patchTodo(data.key, { title: data.title, body: data.note, dueAt });
    setItem((cur) => (cur?.id === next.id ? next : cur));
    void refreshList();
  });

  useEffect(() => {
    if (composing) composeRef.current?.focus();
  }, [composing]);

  useEffect(() => {
    if (pending?.module !== "todos") return;
    void open(pending.id);
    consumePending();
  }, [pending]);

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
  const linkMatches = unusedTargets
    .filter((t) => matchesQuery(linkQuery, t.title, t.type === "wiki" ? "Wiki" : "收藏"))
    .slice(0, 8);

  async function jump(link: ItemLink) {
    if (link.type === "wiki") {
      openItem({ module: "wiki", id: link.id });
      return;
    }
    const detail = await api.item(link.id);
    if (detail.type === "collection_item") {
      openItem({ module: "collections", id: detail.id, collectionId: detail.collectionId });
    } else if (detail.type === "draft") {
      openItem({ module: "publish", id: detail.id });
    } else if (detail.type === "course") {
      openItem({ module: "courses", id: detail.id, courseView: "read" });
    }
  }

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
              setListLoaded(false);
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
          <StatusBlock
            title={
              !listLoaded ? "正在打开待办…" : listError ? "待办没有打开" : query.trim() ? "没有匹配的待办" : "没有待办"
            }
            detail={
              !listLoaded
                ? undefined
                : listError
                ? listError
                : query.trim()
                  ? "换个词，或清空顶栏搜索。"
                  : view === "today"
                    ? "今天没有到期的任务。可以新建一条，或切到未完成。"
                    : "点「新建任务」写一条。"
            }
            action={listError ? { label: "重试", onClick: () => void refreshList() } : undefined}
          />
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
        <div className="col-head split">
          <span>任务备注</span>
          <SaveStatus phase={saveState.phase} onRetry={saveState.retry} />
        </div>
        {item ? (
          <div className="reader todo-note">
            <input
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <div className="todo-meta">
              {editingDue ? (
                <label className="due-edit">
                  <span>截止日期</span>
                  <input
                    type="date"
                    value={due}
                    autoFocus
                    onChange={(e) => setDue(e.target.value)}
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
              onChange={setNote}
            />
            <div className="todo-links">
              {wikiLinks.length > 0 ? (
                <div className="link-line">
                  <span className="link-k">链接到 Wiki：</span>
                  {wikiLinks.map((l) => (
                    <span key={l.id} className="wiki-pill">
                      <button type="button" className="pill-jump" onClick={() => void jump(l)}>
                        {l.title}
                      </button>
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
                      <button type="button" className="pill-jump" onClick={() => void jump(l)}>
                        {l.title}
                      </button>
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
                      setLinkQuery("");
                      setAddingLink(false);
                    });
                  }}
                >
                  <input
                    value={linkQuery}
                    onChange={(e) => {
                      setLinkQuery(e.target.value);
                      setLinkId("");
                    }}
                    placeholder="搜索 Wiki 或收藏"
                    autoFocus
                  />
                  {linkQuery.trim() ? (
                    <div className="link-results">
                      {linkMatches.length === 0 ? (
                        <span className="meta">没有匹配</span>
                      ) : (
                        linkMatches.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={linkId === t.id ? "active" : ""}
                            onClick={() => {
                              setLinkId(t.id);
                              setLinkQuery(t.title);
                            }}
                          >
                            {t.type === "wiki" ? "Wiki" : "收藏"} · {t.title}
                          </button>
                        ))
                      )}
                    </div>
                  ) : null}
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
          <StatusBlock title="选择一条待办" detail="在中间列表点开，备注和对话会跟这一条走。" />
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
