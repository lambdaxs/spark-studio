import { useEffect, useState } from "react";
import { ChatBubble } from "./AgentPanel";
import { CourseMindMap } from "./CourseMindMap";
import { HoverDelete } from "./HoverDelete";
import { IconBack, IconClip, IconHistory, IconPage, IconPlus, IconSend } from "./Icons";
import {
  api,
  streamChat,
  type BindTargets,
  type ChatMessage,
  type CourseDetail,
  type CourseHistoryRow,
  type CourseNode,
} from "./api";

function lessonCount(nodes: CourseNode[]): number {
  return nodes.reduce(
    (n, node) => n + (node.contentKind === "lesson" ? 1 : 0) + lessonCount(node.children),
    0,
  );
}

function OutlineList({ nodes, prefix = "" }: { nodes: CourseNode[]; prefix?: string }) {
  return (
    <ol className={`outline-list${prefix ? " nested" : ""}`}>
      {nodes.map((n, i) => {
        const num = `${prefix}${i + 1}`;
        return (
          <li key={n.id}>
            <span className="outline-row">
              <span className="outline-num">{num}</span>
              {n.title}
            </span>
            {n.children.length > 0 ? <OutlineList nodes={n.children} prefix={`${num}.`} /> : null}
          </li>
        );
      })}
    </ol>
  );
}

export function CourseStudio({
  courseId,
  onBack,
  onOpenBook,
  onSwitch,
}: {
  courseId: string;
  onBack: () => void;
  onOpenBook: (id: string) => void;
  onSwitch: (id: string) => void;
}) {
  const [course, setCourse] = useState<CourseDetail>();
  const [history, setHistory] = useState<CourseHistoryRow[]>([]);
  const [targets, setTargets] = useState<BindTargets>({ collections: [], items: [] });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();
  const [histOpen, setHistOpen] = useState(false);
  const [matsOpen, setMatsOpen] = useState(false);
  const [bindVal, setBindVal] = useState("");

  const locked = course?.item.status === "ready";
  const hasTree = Boolean(course && course.tree.length > 0);
  const leaves = course ? lessonCount(course.tree) : 0;

  async function refreshHistory() {
    setHistory(await api.courseHistory());
  }

  useEffect(() => {
    setDraft("");
    setErr(undefined);
    setHistOpen(false);
    setMatsOpen(false);
    void api.course(courseId).then(setCourse);
    void api.messages(courseId).then(setMessages);
    void api.bindTargets().then(setTargets);
    void refreshHistory();
  }, [courseId]);

  async function send() {
    if (!course || locked || !draft.trim() || busy) return;
    const text = draft.trim();
    setDraft("");
    setBusy(true);
    setErr(undefined);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const asst: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, asst]);
    if (course.item.title === "未命名课程") {
      void api.patchCourse(course.item.id, { title: text.slice(0, 24) }).then(setCourse);
    }
    const result = await streamChat(course.item.id, text, (chunk) => {
      asst.content += chunk;
      setMessages((m) => m.map((x) => (x.id === asst.id ? { ...asst } : x)));
    });
    if (result.error) {
      setErr(result.error);
      setMessages((m) => m.filter((x) => x.id !== asst.id || asst.content));
    }
    setBusy(false);
    setCourse(await api.course(course.item.id));
    void refreshHistory();
  }

  async function confirm() {
    if (!course || locked || leaves === 0) return;
    const next = await api.confirmCourse(course.item.id);
    onOpenBook(next.item.id);
  }

  async function startNew() {
    const created = await api.createCourse();
    onSwitch(created.item.id);
  }

  async function removeHistory(id: string, status: string) {
    if (status === "ready") await api.clearCourseArchive(id);
    else await api.trashItem(id);
    await refreshHistory();
    if (id === courseId) onBack();
  }

  async function onBind() {
    if (!course || !bindVal || locked) return;
    const [kind, targetId] = bindVal.split(":") as ["collection" | "item", string];
    const next = await api.addCourseBinding(course.item.id, kind, targetId);
    setCourse(next);
    setBindVal("");
  }

  return (
    <div className={`studio${hasTree ? " with-tree" : ""}`}>
      <header className="studio-head">
        <button type="button" className="text-btn back-btn" onClick={onBack}>
          <IconBack />
          返回书架
        </button>
        {course && !locked ? (
          <input
            className="studio-title"
            value={course.item.title}
            onChange={(e) => {
              const title = e.target.value;
              setCourse({ ...course, item: { ...course.item, title } });
              void api.patchCourse(course.item.id, { title }).then(setCourse);
            }}
          />
        ) : (
          <span className="studio-title-static">{course?.item.title ?? "写一本新书"}</span>
        )}
        {locked ? <span className="studio-flag">只读档案</span> : null}
        {course ? (
          <div className="bound-row">
            <span className="muted">已绑定：</span>
            {course.bindings.length + course.assets.length === 0 ? (
              <span className="muted">暂无材料</span>
            ) : null}
            {course.bindings.map((b) => (
              <span key={`${b.kind}:${b.targetId}`} className="bound-chip">
                {b.kind === "collection" ? "收藏夹" : "Wiki"}「{b.title}」
              </span>
            ))}
            {course.assets.map((a) => (
              <span key={a.id} className="bound-chip">
                <IconPage />
                {a.filename}
              </span>
            ))}
            {locked ? null : (
              <button
                type="button"
                className={`icon-btn${matsOpen ? " on" : ""}`}
                aria-label="管理参考材料"
                title="管理参考材料"
                onClick={() => {
                  setMatsOpen((v) => !v);
                  setHistOpen(false);
                }}
              >
                <IconClip />
              </button>
            )}
          </div>
        ) : null}
        {matsOpen && course ? (
          <div className="studio-pop">
            <div className="studio-pop-head">参考材料</div>
            {course.bindings.map((b) => (
              <span key={`${b.kind}:${b.targetId}`} className="pill">
                {b.kind === "collection" ? "收藏夹" : "Wiki"}「{b.title}」
                {locked ? null : (
                  <button
                    type="button"
                    aria-label="去掉"
                    onClick={() =>
                      void api.removeCourseBinding(course.item.id, b.kind, b.targetId).then(setCourse)
                    }
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {course.assets.map((a) => (
              <span key={a.id} className="pill">
                {a.filename}
                {locked ? null : (
                  <button
                    type="button"
                    aria-label="去掉"
                    onClick={() => void api.removeCourseAsset(course.item.id, a.id).then(setCourse)}
                  >
                    ×
                  </button>
                )}
              </span>
            ))}
            {locked ? null : (
              <>
                <form
                  className="link-add tight"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void onBind();
                  }}
                >
                  <select value={bindVal} onChange={(e) => setBindVal(e.target.value)}>
                    <option value="">绑定材料…</option>
                    <optgroup label="收藏夹">
                      {targets.collections.map((c) => (
                        <option key={c.id} value={`collection:${c.id}`}>
                          {c.title}
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Wiki / 收藏">
                      {targets.items.map((it) => (
                        <option key={it.id} value={`item:${it.id}`}>
                          {it.title}
                        </option>
                      ))}
                    </optgroup>
                  </select>
                  <button type="submit" className="chip" disabled={!bindVal}>
                    绑定
                  </button>
                </form>
                <label className="chip file-chip">
                  上传文件
                  <input
                    type="file"
                    accept=".pdf,.epub,.txt,.md,.html"
                    hidden
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void api.uploadCourseAsset(course.item.id, file).then(setCourse);
                    }}
                  />
                </label>
              </>
            )}
          </div>
        ) : null}
      </header>

      <section className="studio-chat">
        <div className="agent-log studio-log">
          {messages.length === 0 ? (
            <div className="studio-hint">
              {locked
                ? "这场设计对话已被清空，或还没有留下消息。"
                : "先说你要学什么、基础和范围。有目录之后，右侧才会出现大纲和导图。"}
            </div>
          ) : (
            messages.map((m) => <ChatBubble key={m.id} message={m} pending={busy} />)
          )}
        </div>
        {err ? (
          <div className="err" role="alert">
            {err}
          </div>
        ) : null}

        <div className="studio-dock">
          {histOpen ? (
            <aside className="studio-history">
              <button type="button" className="history-new" onClick={() => void startNew()}>
                <IconPlus />
                新对话
              </button>
              {history.length === 0 ? (
                <div className="empty-col">还没有写作记录。</div>
              ) : (
                history.map((h) => (
                  <HoverDelete
                    key={h.id}
                    className={`history-row ${h.id === courseId ? "active" : ""}`}
                    onDelete={() => void removeHistory(h.id, h.status)}
                  >
                    <button type="button" onClick={() => onSwitch(h.id)}>
                      <span className="title">{h.title}</span>
                      <span className="meta">{h.status === "ready" ? "已成书 · 只读" : "进行中"}</span>
                    </button>
                  </HoverDelete>
                ))
              )}
            </aside>
          ) : null}

          <form
            className="studio-form"
            onSubmit={(e) => {
              e.preventDefault();
              void send();
            }}
          >
            {locked ? (
              <div className="studio-locked-input">目录已锁定，只能回看这场对话。</div>
            ) : (
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="先说你要学什么、基础和范围…"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void send();
                  }
                }}
                disabled={busy}
              />
            )}
            {locked ? null : (
              <button type="submit" disabled={busy || !draft.trim()} aria-label="发送">
                <IconSend />
              </button>
            )}
            <button
              type="button"
              className={`icon-btn${histOpen ? " on" : ""}`}
              aria-label="对话历史"
              onClick={() => {
                setHistOpen((v) => !v);
                setMatsOpen(false);
                void refreshHistory();
              }}
            >
              <IconHistory />
            </button>
          </form>
        </div>
      </section>

      {hasTree && course ? (
        <aside className="studio-side">
          <div className="studio-cards">
            <section className="studio-card outline">
              <div className="studio-card-head">课程大纲</div>
              <div className="studio-card-body">
                <OutlineList nodes={course.tree} />
              </div>
            </section>
            <section className="studio-card">
              <div className="studio-card-head">思维导图</div>
              <div className="studio-card-body map">
                <CourseMindMap title={course.item.title} tree={course.tree} />
              </div>
            </section>
          </div>
          <div className="studio-side-foot">
            {locked ? (
              <button type="button" className="primary-btn" onClick={() => onOpenBook(course.item.id)}>
                打开这本书
              </button>
            ) : (
              <button type="button" className="primary-btn" disabled={leaves === 0} onClick={() => void confirm()}>
                确认目录，生成课程
              </button>
            )}
            <span className="muted">
              {locked ? "目录已锁定。" : `共 ${leaves} 个课时。确认后锁定目录，正文在第一次打开时生成。`}
            </span>
          </div>
        </aside>
      ) : null}
    </div>
  );
}
