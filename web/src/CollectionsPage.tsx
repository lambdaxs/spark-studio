import { useEffect, useState } from "react";
import { AgentPanel } from "./AgentPanel";
import { HoverDelete } from "./HoverDelete";
import { IconFolder, IconLink } from "./Icons";
import { MarkdownView } from "./MarkdownDoc";
import { api, type Collection, type ItemDetail, type ItemSummary } from "./api";
import { matchesQuery, useQuery } from "./shell";

function formatDate(ms: number | null) {
  if (!ms) return "";
  return new Date(ms).toISOString().slice(0, 10);
}

export function CollectionsPage() {
  const query = useQuery();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<string>();
  const [rows, setRows] = useState<ItemSummary[]>([]);
  const [item, setItem] = useState<ItemDetail>();

  const selectedCollection = collections.find((c) => c.id === collectionId);

  async function refreshMeta() {
    const cols = await api.collections();
    setCollections(cols);
    setCollectionId((id) => id ?? cols[0]?.id);
  }

  useEffect(() => {
    void refreshMeta();
  }, []);

  useEffect(() => {
    if (!collectionId) return;
    void api.items(collectionId, {}).then((list) => {
      setRows(list);
      setItem((cur) => {
        if (cur && list.some((r) => r.id === cur.id)) return cur;
        return undefined;
      });
    });
  }, [collectionId]);

  useEffect(() => {
    if (item) return;
    const first = rows[0];
    if (!first) return;
    void openItem(first.id);
  }, [rows, item]);

  async function openItem(id: string) {
    setItem(await api.item(id));
  }

  async function remove(id: string) {
    await api.trashItem(id);
    if (!collectionId) return;
    const list = await api.items(collectionId, {});
    setRows(list);
    await refreshMeta();
    if (item?.id === id) {
      setItem(undefined);
      if (list[0]) void openItem(list[0].id);
    }
  }

  return (
    <div className="collections">
      <aside className="col">
        <div className="col-head">收藏夹</div>
        {collections.map((c) => (
          <button
            key={c.id}
            className={`folder ${c.id === collectionId ? "active" : ""}`}
            onClick={() => {
              setCollectionId(c.id);
              setRows([]);
              setItem(undefined);
            }}
          >
            <span className="folder-name">
              <IconFolder />
              {c.name}
            </span>
            <span className="count">{c.itemCount}</span>
          </button>
        ))}
      </aside>

      <section className="col">
        <div className="col-head">{selectedCollection?.name ?? "文章"}</div>
        {rows.filter((r) => matchesQuery(query, r.title, r.author)).length === 0 ? (
          <div className="empty-col">这个夹里没有文章。</div>
        ) : (
          rows.filter((r) => matchesQuery(query, r.title, r.author)).map((r) => (
            <HoverDelete key={r.id} onDelete={() => void remove(r.id)}>
              <button
                className={`row ${item?.id === r.id ? "active" : ""}`}
                onClick={() => void openItem(r.id)}
              >
                <span className="title">{r.title}</span>
                <span className="meta">
                  {[r.author, formatDate(r.originalAt)].filter(Boolean).join(" · ")}
                </span>
              </button>
            </HoverDelete>
          ))
        )}
      </section>

      <article className="col">
        {item ? (
          <div className="reader">
            <h1>{item.title}</h1>
            <div className="byline">
              {[item.author, formatDate(item.originalAt)].filter(Boolean).join(" · ")}
              {item.sourceUrl ? (
                <>
                  {" · "}
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                    <IconLink /> 原文链接
                  </a>
                </>
              ) : null}
            </div>
            <MarkdownView>{item.body}</MarkdownView>
          </div>
        ) : (
          <div className="empty-col">选择一篇收藏。</div>
        )}
      </article>

      <AgentPanel
        itemId={item?.id}
        context={
          item
            ? `当前夹「${item.collectionName ?? ""}」· 当前篇「${item.title}」`
            : "选择一篇后，对话会跟这篇走。"
        }
        placeholder="基于当前这篇提问…"
      />
    </div>
  );
}
