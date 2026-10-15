import { useEffect, useState, type FormEvent } from "react";
import { AgentPanel } from "./AgentPanel";
import { HoverDelete } from "./HoverDelete";
import { IconPlus } from "./Icons";
import { MarkdownDoc } from "./MarkdownDoc";
import { SearchBox } from "./SearchBox";
import { api, type DraftDetail, type DraftRow, type Platform, type Variant } from "./api";
import { matchesQuery, useQuery } from "./shell";

type Tab = "base" | Platform;
type Filter = "all" | "ready";

const PLATFORMS: { id: Platform; label: string; short: string }[] = [
  { id: "wechat", label: "公众号", short: "公众号" },
  { id: "xiaohongshu", label: "小红书", short: "小红书" },
  { id: "zhihu", label: "知乎专栏", short: "知乎" },
];

const TABS: { id: Tab; label: string }[] = [{ id: "base", label: "底稿" }, ...PLATFORMS];

const TAB_LABEL: Record<Tab, string> = {
  base: "底稿",
  wechat: "公众号",
  xiaohongshu: "小红书",
  zhihu: "知乎专栏",
};

function exportText(draftTitle: string, v: Variant) {
  const parts = [v.title || draftTitle];
  if (v.summary) parts.push(v.summary);
  if (v.body) parts.push(v.body);
  if (v.tags.length) parts.push(v.tags.map((t) => `#${t.replace(/^#/, "")}`).join(" "));
  if (v.coverNote) parts.push(`封面：${v.coverNote}`);
  if (v.imageBriefs.length) parts.push(v.imageBriefs.map((b, i) => `图 ${i + 1}：${b}`).join("\n"));
  return parts.join("\n\n");
}

export function PublishPage() {
  const query = useQuery();
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [draft, setDraft] = useState<DraftDetail>();
  const [tab, setTab] = useState<Tab>("base");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [summary, setSummary] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagDraft, setTagDraft] = useState("");
  const [cover, setCover] = useState("");
  const [briefs, setBriefs] = useState<string[]>([]);
  const [newTitle, setNewTitle] = useState("");
  const [composing, setComposing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  async function refreshList() {
    const list = await api.drafts(filter === "ready" ? { ready: true } : {});
    setRows(list);
    return list;
  }

  function loadFields(next: DraftDetail, nextTab: Tab) {
    if (nextTab === "base") {
      setTitle(next.item.title);
      setBody(next.item.body);
      setSummary("");
      setTags([]);
      setCover("");
      setBriefs([]);
    } else {
      const v = next.variants[nextTab];
      setTitle(v?.title ?? "");
      setBody(v?.body ?? "");
      setSummary(v?.summary ?? "");
      setTags(v?.tags ?? []);
      setCover(v?.coverNote ?? "");
      setBriefs(v?.imageBriefs ?? []);
    }
    setTagDraft("");
    setCopied(false);
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
            tags,
            coverNote: cover,
            imageBriefs: briefs.map((l) => l.trim()).filter(Boolean),
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
  const visible = rows.filter((r) => matchesQuery(query, r.title));

  function edit<T>(set: (v: T) => void) {
    return (v: T) => {
      set(v);
      setDirty(true);
    };
  }

  function addTag() {
    const next = tagDraft.trim().replace(/^#/, "");
    setTagDraft("");
    if (!next || tags.includes(next)) return;
    edit(setTags)([...tags, next]);
  }

  async function setReady(ready: boolean) {
    if (!draft || tab === "base") return;
    const next = await api.saveVariant(draft.item.id, tab, { status: ready ? "ready" : "empty" });
    setDraft(next);
    void refreshList();
  }

  async function copyExport() {
    if (!draft || !variant) return;
    await navigator.clipboard.writeText(exportText(draft.item.title, variant));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function generate(platform: Platform) {
    if (!draft) return;
    setGenerating(true);
    try {
      const next = await api.generateVariant(draft.item.id, platform);
      setDraft(next);
      loadFields(next, platform);
      void refreshList();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="publish">
      <aside className="col">
        <div className="col-head stack">
          <div className="col-title split">
            <span>稿件列表</span>
            <button
              type="button"
              className="icon-btn"
              aria-label="新建底稿"
              title="新建底稿"
              onClick={() => setComposing(true)}
            >
              <IconPlus />
            </button>
          </div>
          <SearchBox placeholder="搜索稿件…" />
          <div className="seg">
            <button type="button" className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>
              全部
            </button>
            <button
              type="button"
              className={filter === "ready" ? "active" : ""}
              onClick={() => setFilter("ready")}
            >
              有可导出
            </button>
          </div>
        </div>
        {composing ? (
          <form
            className="add-todo"
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              if (!newTitle.trim()) return;
              void api.createDraft({ title: newTitle.trim() }).then(async (created) => {
                setNewTitle("");
                setComposing(false);
                await refreshList();
                await open(created.item.id);
              });
            }}
          >
            <input
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onBlur={() => {
                if (!newTitle.trim()) setComposing(false);
              }}
              placeholder="底稿标题，回车创建"
            />
          </form>
        ) : null}
        {visible.length === 0 ? (
          <div className="empty-col">没有稿件。</div>
        ) : (
          visible.map((r) => (
            <HoverDelete key={r.id} onDelete={() => void remove(r.id)}>
              <button
                type="button"
                className={`row ${draft?.item.id === r.id ? "active" : ""}`}
                onClick={() => void open(r.id, tab)}
              >
                <span className="title">{r.title}</span>
                <span className="marks">
                  {PLATFORMS.map((p) => (
                    <span key={p.id} className={r.ready.includes(p.id) ? "on" : ""}>
                      {r.ready.includes(p.id) ? "✓ " : ""}
                      {p.short}
                    </span>
                  ))}
                </span>
              </button>
            </HoverDelete>
          ))
        )}
      </aside>

      <article className="col publish-main">
        {draft ? (
          <>
            <div className="tabs">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={tab === t.id ? "active" : ""}
                  onClick={() => {
                    setTab(t.id);
                    loadFields(draft, t.id);
                  }}
                >
                  {t.label}
                  {t.id !== "base" && draft.variants[t.id]?.status === "ready" ? (
                    <span className="tab-dot" aria-label="可导出" />
                  ) : null}
                </button>
              ))}
            </div>

            {tab !== "base" && !variant ? (
              <div className="variant-empty">
                <p>还没有{TAB_LABEL[tab]}版本。</p>
                <button
                  type="button"
                  className="primary-btn"
                  disabled={generating}
                  onClick={() => void generate(tab)}
                >
                  {generating ? "生成中…" : "从底稿生成"}
                </button>
              </div>
            ) : tab === "base" ? (
              <div className="reader">
                <input className="title-input" value={title} onChange={(e) => edit(setTitle)(e.target.value)} />
                <MarkdownDoc
                  value={body}
                  editable
                  defaultMode="view"
                  placeholder="写底稿。各平台版本都从这里生成。"
                  onChange={edit(setBody)}
                />
              </div>
            ) : (
              <>
                <div className="reader variant">
                  <h2 className="variant-title">{draft.item.title}</h2>
                  <div className="kv">
                    <label>
                      <span className="k">平台标题</span>
                      <input value={title} onChange={(e) => edit(setTitle)(e.target.value)} />
                    </label>
                    <label>
                      <span className="k">摘要</span>
                      <input
                        value={summary}
                        placeholder="一句话摘要"
                        onChange={(e) => edit(setSummary)(e.target.value)}
                      />
                    </label>
                    <div className="kv-row">
                      <span className="k">话题</span>
                      <div className="tag-chips">
                        {tags.map((t) => (
                          <span key={t} className="tag-chip">
                            #{t}
                            <button
                              type="button"
                              aria-label={`去掉 ${t}`}
                              onClick={() => edit(setTags)(tags.filter((x) => x !== t))}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                        <input
                          value={tagDraft}
                          placeholder="+ 话题"
                          onChange={(e) => setTagDraft(e.target.value)}
                          onBlur={addTag}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              addTag();
                            }
                          }}
                        />
                      </div>
                    </div>
                    <label>
                      <span className="k">封面</span>
                      <input
                        value={cover}
                        placeholder="封面画面描述"
                        onChange={(e) => edit(setCover)(e.target.value)}
                      />
                    </label>
                  </div>

                  <div className="section-h">图文说明</div>
                  <ol className="briefs">
                    {briefs.map((b, i) => (
                      <li key={i}>
                        <span className="brief-n">图 {i + 1}：</span>
                        <input
                          value={b}
                          placeholder="这张图画什么"
                          onChange={(e) => edit(setBriefs)(briefs.map((x, j) => (j === i ? e.target.value : x)))}
                        />
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label="删掉这张"
                          onClick={() => edit(setBriefs)(briefs.filter((_, j) => j !== i))}
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ol>
                  <button type="button" className="text-btn" onClick={() => edit(setBriefs)([...briefs, ""])}>
                    + 添加一张配图
                  </button>

                  <div className="section-h">正文</div>
                  <MarkdownDoc
                    value={body}
                    editable
                    defaultMode="view"
                    placeholder={`写${TAB_LABEL[tab]}正文`}
                    onChange={edit(setBody)}
                  />
                </div>
                <div className="export-bar">
                  {variant?.status === "ready" ? (
                    <>
                      <button type="button" className="primary-btn" onClick={() => void copyExport()}>
                        {copied ? "已复制到剪贴板" : `导出到${TAB_LABEL[tab]}（已就绪）`}
                      </button>
                      <button type="button" className="text-btn muted" onClick={() => void setReady(false)}>
                        撤回就绪
                      </button>
                    </>
                  ) : (
                    <button type="button" className="primary-btn" onClick={() => void setReady(true)}>
                      标为可导出
                    </button>
                  )}
                  <span className="badge ok">已生成</span>
                </div>
              </>
            )}
          </>
        ) : (
          <div className="empty-col">选择或新建一篇底稿。</div>
        )}
      </article>

      <AgentPanel
        itemId={draft?.item.id}
        extra={tab === "base" ? { surface: "base" } : { surface: tab }}
        context={
          draft
            ? `当前稿件：${draft.item.title} · 平台：${TAB_LABEL[tab]}`
            : "选择一篇后，对话会跟这篇和当前标签走。"
        }
        placeholder="基于当前稿件提问…"
      />
    </div>
  );
}
