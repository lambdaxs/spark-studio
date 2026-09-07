import { useEffect, useState, type FormEvent } from "react";
import { AgentPanel } from "./AgentPanel";
import { HoverDelete } from "./HoverDelete";
import { MarkdownDoc } from "./MarkdownDoc";
import {
  api,
  type DraftDetail,
  type DraftRow,
  type Platform,
} from "./api";
import { matchesQuery, useQuery } from "./shell";

type Tab = "base" | Platform;
type Filter = { kind: "all" } | { kind: "ready" };

const TABS: { id: Tab; label: string }[] = [
  { id: "base", label: "底稿" },
  { id: "wechat", label: "公众号" },
  { id: "xiaohongshu", label: "小红书" },
  { id: "zhihu", label: "知乎专栏" },
];

const TAB_LABEL: Record<Tab, string> = {
  base: "底稿",
  wechat: "公众号",
  xiaohongshu: "小红书",
  zhihu: "知乎专栏",
};

function marks(ready: Platform[]) {
  return TABS.filter((t) => t.id !== "base")
    .map((t) => `${t.label}${ready.includes(t.id as Platform) ? " ✓" : ""}`)
    .join(" · ");
}

export function PublishPage() {
  const query = useQuery();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [filter, setFilter] = useState<Filter>({ kind: "all" });
  const [draft, setDraft] = useState<DraftDetail>();
  const [tab, setTab] = useState<Tab>("base");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState("");
  const [cover, setCover] = useState("");
  const [briefs, setBriefs] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [dirty, setDirty] = useState(false);

  async function refreshList() {
    const q = filter.kind === "ready" ? { ready: true as const } : {};
    const list = await api.drafts(q);
    setRows(list);
    return list;
  }

  function loadFields(next: DraftDetail, nextTab: Tab) {
    if (nextTab === "base") {
      setTitle(next.item.title);
      setBody(next.item.body);
      setSummary("");
      setTags("");
      setCover("");
      setBriefs("");
    } else {
      const v = next.variants[nextTab];
      setTitle(v?.title ?? "");
      setBody(v?.body ?? "");
      setSummary(v?.summary ?? "");
      setTags((v?.tags ?? []).join(" "));
      setCover(v?.coverNote ?? "");
      setBriefs((v?.imageBriefs ?? []).join("\n"));
    }
    setDirty(false);
  }

  async function open(id: string, nextTab: Tab = "base") {
    const detail = await api.draft(id);
    setDraft(detail);
    setTab(nextTab);
    loadFields(detail, nextTab);
  }

  async function remove(id: string) {
    await api.trashItem(id);
    const list = await refreshList();
    if (draft?.item.id === id) {
      setDraft(undefined);
      if (list[0]) void open(list[0].id);
    }
  }

  useEffect(() => {
    void refreshList().then((list) => {
      setDraft((cur) => {
        if (cur && list.some((r) => r.id === cur.item.id)) return cur;
        return undefined;
      });
    });
  }, [filter]);

  useEffect(() => {
    if (draft) return;
    if (rows[0]) void open(rows[0].id);
  }, [rows, draft]);

  useEffect(() => {
    if (!draft || !dirty) return;
    const handle = window.setTimeout(() => {
      if (tab === "base") {
        void api.patchDraft(draft.item.id, { title, body }).then((next) => {
          setDraft(next);
          setDirty(false);
          void refreshList();
        });
      } else if (draft.variants[tab]) {
        void api
          .saveVariant(draft.item.id, tab, {
            title,
            body,
            summary,
            tags: tags.split(/[,，\s]+/).filter(Boolean),
            coverNote: cover,
            imageBriefs: briefs
              .split("\n")
              .map((l) => l.trim())
              .filter(Boolean),
          })
          .then((next) => {
            setDraft(next);
            setDirty(false);
            void refreshList();
          });
      }
    }, 450);
    return () => window.clearTimeout(handle);
  }, [title, body, summary, tags, cover, briefs, dirty, draft, tab]);

  const variant = tab === "base" ? undefined : draft?.variants[tab];

  return (
    <div className="publish">
      <aside className="col">
        <div className="col-head">稿件</div>
        <div className="filters stacked">
          <button
            className={filter.kind === "all" ? "active" : ""}
            onClick={() => setFilter({ kind: "all" })}
          >
            全部
          </button>
          <button
            className={filter.kind === "ready" ? "active" : ""}
            onClick={() => setFilter({ kind: "ready" })}
          >
            可导出
          </button>
        </div>
      </aside>

      <section className="col">
        <div className="col-head">底稿列表</div>
        {rows.filter((r) => matchesQuery(query, r.title)).length === 0 ? (
          <div className="empty-col">没有稿件。</div>
        ) : (
          rows.filter((r) => matchesQuery(query, r.title)).map((r) => (
            <HoverDelete key={r.id} onDelete={() => void remove(r.id)}>
              <button
                className={`row ${draft?.item.id === r.id ? "active" : ""}`}
                onClick={() => void open(r.id, tab === "base" ? "base" : tab)}
              >
                <span className="title">{r.title}</span>
                <span className="meta">{marks(r.ready)}</span>
              </button>
            </HoverDelete>
          ))
        )}
        <form
          className="add-todo"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            if (!newTitle.trim()) return;
            void api.createDraft({ title: newTitle.trim() }).then(async (created) => {
              setNewTitle("");
              await refreshList();
              await open(created.item.id);
            });
          }}
        >
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="新建底稿"
          />
        </form>
      </section>

      <article className="col">
        {draft ? (
          <div className="reader">
            <div className="filters">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={tab === t.id ? "active" : ""}
                  onClick={() => {
                    setTab(t.id);
                    loadFields(draft, t.id);
                  }}
                >
                  {t.label}
                  {t.id !== "base" && draft.variants[t.id]?.status === "ready" ? " ✓" : ""}
                </button>
              ))}
            </div>

            {tab !== "base" && !variant ? (
              <div className="empty-col">
                <p>还没有{TAB_LABEL[tab]}变体。</p>
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() =>
                    void api.generateVariant(draft.item.id, tab).then((next) => {
                      setDraft(next);
                      loadFields(next, tab);
                      void refreshList();
                    })
                  }
                >
                  从底稿生成
                </button>
              </div>
            ) : (
              <>
                <input
                  className="title-input"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                />
                {tab === "base" ? null : (
                  <div className="variant-fields">
                    <label className="field">
                      <span>摘要</span>
                      <input
                        value={summary}
                        onChange={(e) => {
                          setSummary(e.target.value);
                          setDirty(true);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>标签 / 话题</span>
                      <input
                        value={tags}
                        onChange={(e) => {
                          setTags(e.target.value);
                          setDirty(true);
                        }}
                        placeholder="空格分隔"
                      />
                    </label>
                    <label className="field">
                      <span>封面说明</span>
                      <input
                        value={cover}
                        onChange={(e) => {
                          setCover(e.target.value);
                          setDirty(true);
                        }}
                      />
                    </label>
                    <label className="field">
                      <span>配图说明（一行一张）</span>
                      <textarea
                        className="body-input short"
                        value={briefs}
                        onChange={(e) => {
                          setBriefs(e.target.value);
                          setDirty(true);
                        }}
                      />
                    </label>
                    <button
                      type="button"
                      className="chip"
                      onClick={() =>
                        void api
                          .saveVariant(draft.item.id, tab, {
                            status: variant?.status === "ready" ? "empty" : "ready",
                          })
                          .then((next) => {
                            setDraft(next);
                            void refreshList();
                          })
                      }
                    >
                      {variant?.status === "ready" ? "取消可导出" : "标为可导出"}
                    </button>
                  </div>
                )}
                <MarkdownDoc
                  value={body}
                  editable
                  defaultMode="view"
                  placeholder="写底稿或平台正文"
                  onChange={(next) => {
                    setBody(next);
                    setDirty(true);
                  }}
                />
              </>
            )}
          </div>
        ) : (
          <div className="empty-col">选择或新建一篇底稿。</div>
        )}
      </article>

      <AgentPanel
        itemId={draft?.item.id}
        extra={tab === "base" ? { surface: "base" } : { surface: tab }}
        context={
          draft
            ? `当前稿「${draft.item.title}」· ${TAB_LABEL[tab]}`
            : "选择一篇后，对话会跟这篇和当前标签走。"
        }
        placeholder="基于当前这篇提问…"
      />
    </div>
  );
}
