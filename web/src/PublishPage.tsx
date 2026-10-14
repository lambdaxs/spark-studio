import { useEffect, useState, type FormEvent } from "react";
import { AgentPanel } from "./AgentPanel";
import { useAutosave } from "./autosave";
import { SaveStatus, StatusBlock, failureDetail } from "./feedback";
import { HoverDelete } from "./HoverDelete";
import { MarkdownDoc } from "./MarkdownDoc";
import {
  api,
  type DraftDetail,
  type DraftRow,
  type Platform,
} from "./api";
import { matchesQuery, useQuery, useShell } from "./shell";

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

function PlatformMarks({ ready }: { ready: Platform[] }) {
  return (
    <span className="platform-marks">
      {TABS.filter((t) => t.id !== "base").map((t) => (
        <span key={t.id} className={ready.includes(t.id as Platform) ? "on" : ""}>
          {t.label}
        </span>
      ))}
    </span>
  );
}

export function PublishPage() {
  const query = useQuery();
  const { pending, consumePending } = useShell();
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
  const [listLoaded, setListLoaded] = useState(false);
  const [listError, setListError] = useState("");

  async function refreshList() {
    try {
      const q = filter.kind === "ready" ? { ready: true as const } : {};
      const list = await api.drafts(q);
      setRows(list);
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
    if (pending?.module !== "publish") return;
    void open(pending.id);
    consumePending();
  }, [pending]);

  const saveKey = draft ? `${draft.item.id}:${tab}` : undefined;
  const variantReady = tab !== "base" && Boolean(draft?.variants[tab]);
  const snapshot = JSON.stringify({
    key: saveKey ?? "",
    id: draft?.item.id ?? "",
    tab,
    title,
    body,
    summary,
    tags,
    cover,
    briefs,
    hasVariant: tab === "base" || variantReady,
  });
  const saveState = useAutosave(saveKey, snapshot, async (raw) => {
    const data = JSON.parse(raw) as {
      id: string;
      tab: Tab;
      title: string;
      body: string;
      summary: string;
      tags: string;
      cover: string;
      briefs: string;
      hasVariant: boolean;
    };
    if (!data.id) return;
    if (data.tab === "base") {
      const next = await api.patchDraft(data.id, { title: data.title, body: data.body });
      setDraft((cur) => (cur?.item.id === data.id ? next : cur));
      await refreshList();
      return;
    }
    if (!data.hasVariant) return;
    const next = await api.saveVariant(data.id, data.tab, {
      title: data.title,
      body: data.body,
      summary: data.summary,
      tags: data.tags.split(/[,，\s]+/).filter(Boolean),
      coverNote: data.cover,
      imageBriefs: data.briefs
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    });
    setDraft((cur) => (cur?.item.id === data.id ? next : cur));
    await refreshList();
  });

  const variant = tab === "base" ? undefined : draft?.variants[tab];

  return (
    <div className="publish">
      <aside className="col">
        <div className="col-head">稿件</div>
        <div className="filters stacked">
          <button
            className={filter.kind === "all" ? "active" : ""}
            onClick={() => {
              setFilter({ kind: "all" });
              setListLoaded(false);
            }}
          >
            全部
          </button>
          <button
            className={filter.kind === "ready" ? "active" : ""}
            onClick={() => {
              setFilter({ kind: "ready" });
              setListLoaded(false);
            }}
          >
            可导出
          </button>
        </div>
      </aside>

      <section className="col">
        <div className="col-head">底稿列表</div>
        {rows.filter((r) => matchesQuery(query, r.title)).length === 0 ? (
          <StatusBlock
            title={
              !listLoaded
                ? "正在打开稿件…"
                : listError
                  ? "稿件没有打开"
                  : query.trim()
                    ? "没有匹配的稿件"
                    : filter.kind === "ready"
                      ? "没有可导出的稿"
                      : "还没有底稿"
            }
            detail={
              !listLoaded
                ? undefined
                : listError
                ? listError
                : query.trim()
                  ? "换个词，或清空顶栏搜索。"
                  : filter.kind === "ready"
                    ? "把某个平台标为可导出后，会出现在这里。"
                    : "在下面输入标题，创建一篇底稿。"
            }
            action={listError ? { label: "重试", onClick: () => void refreshList() } : undefined}
          />
        ) : (
          rows.filter((r) => matchesQuery(query, r.title)).map((r) => (
            <HoverDelete key={r.id} onDelete={() => void remove(r.id)}>
              <button
                className={`row ${draft?.item.id === r.id ? "active" : ""}`}
                onClick={() => void open(r.id, tab === "base" ? "base" : tab)}
              >
                <span className="title">{r.title}</span>
                <PlatformMarks ready={r.ready} />
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
            <div className="reader-status">
              <SaveStatus phase={saveState.phase} onRetry={saveState.retry} />
            </div>
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
                  {t.id !== "base" && draft.variants[t.id]?.status === "ready" ? " · 可导出" : ""}
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
                  onChange={(e) => setTitle(e.target.value)}
                />
                {tab === "base" ? null : (
                  <div className="variant-panel">
                    <div className="variant-panel-head">
                      <span>
                        {TAB_LABEL[tab]}
                        {variant?.status === "ready" ? " · 可导出" : " · 未标可导出"}
                      </span>
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
                    <label className="field">
                      <span>摘要</span>
                      <input value={summary} onChange={(e) => setSummary(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>标签 / 话题</span>
                      <input
                        value={tags}
                        onChange={(e) => setTags(e.target.value)}
                        placeholder="空格分隔"
                      />
                    </label>
                    <label className="field">
                      <span>封面说明</span>
                      <input value={cover} onChange={(e) => setCover(e.target.value)} />
                    </label>
                    <label className="field">
                      <span>配图说明（一行一张）</span>
                      <textarea
                        className="body-input short"
                        value={briefs}
                        onChange={(e) => setBriefs(e.target.value)}
                      />
                    </label>
                  </div>
                )}
                <MarkdownDoc
                  value={body}
                  editable
                  defaultMode="view"
                  placeholder="写底稿或平台正文"
                  onChange={setBody}
                />
              </>
            )}
          </div>
        ) : (
          <StatusBlock title="选择或新建一篇底稿" detail="左边点开一篇，或在列表下输入标题。" />
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
