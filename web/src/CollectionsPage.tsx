import { useEffect, useState } from "react";
import { AgentPanel } from "./AgentPanel";
import { formatLocalDate } from "./dates";
import { StatusBlock, failureDetail } from "./feedback";
import { HoverDelete } from "./HoverDelete";
import { IconFolder, IconLink } from "./Icons";
import { MarkdownView } from "./MarkdownDoc";
import { SendOnward } from "./SendOnward";
import { api, type Collection, type ItemDetail, type ItemSummary } from "./api";
import { matchesQuery, useQuery, useShell } from "./shell";

function formatDate(ms: number | null) {
  return formatLocalDate(ms);
}

export function CollectionsPage() {
  const query = useQuery();
  const { pending, consumePending } = useShell();
  const [collections, setCollections] = useState<Collection[]>([]);
  const [collectionId, setCollectionId] = useState<string>();
  const [rows, setRows] = useState<ItemSummary[]>([]);
  const [item, setItem] = useState<ItemDetail>();
  const [colsLoaded, setColsLoaded] = useState(false);
  const [colsError, setColsError] = useState("");
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [itemsError, setItemsError] = useState("");
  const [pendingItem, setPendingItem] = useState<string>();

  const selectedCollection = collections.find((c) => c.id === collectionId);

  async function refreshMeta() {
    try {
      const cols = await api.collections();
      setCollections(cols);
      setCollectionId((id) => id ?? cols[0]?.id);
      setColsError("");
      setColsLoaded(true);
    } catch (err) {
      const detail = failureDetail(err);
      if (detail) setColsError(detail);
      setColsLoaded(true);
    }
  }

  async function loadItems(id: string) {
    setItemsLoaded(false);
    setItemsError("");
    try {
      const list = await api.items(id, {});
      setRows(list);
      setItem((cur) => {
        if (cur && list.some((r) => r.id === cur.id)) return cur;
        return undefined;
      });
      setItemsLoaded(true);
    } catch (err) {
      const detail = failureDetail(err);
      if (detail) setItemsError(detail);
      setItemsLoaded(true);
    }
  }

  useEffect(() => {
    void refreshMeta();
  }, []);

  useEffect(() => {
    if (!collectionId) return;
    void loadItems(collectionId);
  }, [collectionId]);

  useEffect(() => {
    if (pending?.module !== "collections") return;
    if (pending.collectionId) setCollectionId(pending.collectionId);
    setPendingItem(pending.id);
    consumePending();
  }, [pending]);

  useEffect(() => {
    if (!pendingItem || !itemsLoaded) return;
    void openItem(pendingItem);
    setPendingItem(undefined);
  }, [pendingItem, itemsLoaded]);

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
        {!colsLoaded ? (
          <StatusBlock title="正在打开收藏夹…" />
        ) : colsError ? (
          <StatusBlock
            title="收藏夹没有打开"
            detail={colsError}
            action={{ label: "重试", onClick: () => void refreshMeta() }}
          />
        ) : collections.length === 0 ? (
          <StatusBlock title="还没有收藏夹" detail="外部 Agent 导入后，夹会自动出现在这里。" />
        ) : (
          collections.map((c) => (
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
          ))
        )}
      </aside>

      <section className="col">
        <div className="col-head">{selectedCollection?.name ?? "文章"}</div>
        {rows.filter((r) => matchesQuery(query, r.title, r.author)).length === 0 ? (
          <StatusBlock
            title={
              !collectionId
                ? "先选一个收藏夹"
                : !itemsLoaded
                  ? "正在打开文章…"
                  : itemsError
                    ? "文章没有打开"
                    : query.trim()
                      ? "没有匹配的文章"
                      : "这个夹里还没有文章"
            }
            detail={
              !collectionId || !itemsLoaded
                ? undefined
                : itemsError
                ? itemsError
                : query.trim()
                  ? "换个词，或清空顶栏搜索。"
                  : "外部 Agent 导入后会出现在这里。"
            }
            action={
              itemsError && collectionId
                ? {
                    label: "重试",
                    onClick: () => {
                      if (collectionId) void loadItems(collectionId);
                    },
                  }
                : undefined
            }
          />
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
            <SendOnward
              title={item.title}
              body={item.body}
              sourceId={item.id}
              actions={["wiki", "todo", "draft", "course"]}
            />
            <MarkdownView>{item.body}</MarkdownView>
          </div>
        ) : (
          <StatusBlock title="选择一篇收藏" detail="点开中间列表里的一篇，正文和对话会跟这篇走。" />
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
