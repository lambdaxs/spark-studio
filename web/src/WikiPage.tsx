import { useEffect, useState } from "react";
import { AgentPanel } from "./AgentPanel";
import { useAutosave } from "./autosave";
import { SaveStatus, StatusBlock, failureDetail } from "./feedback";
import { IconPlus } from "./Icons";
import { MarkdownDoc } from "./MarkdownDoc";
import { SendOnward } from "./SendOnward";
import { WikiTree } from "./WikiTree";
import { api, type ItemDetail, type WikiNode } from "./api";
import { matchesQuery, useQuery, useShell } from "./shell";

function hasId(nodes: WikiNode[], id: string): boolean {
  return nodes.some((n) => n.id === id || hasId(n.children, id));
}

function firstLeaf(nodes: WikiNode[]): string | undefined {
  for (const n of nodes) {
    if (n.children.length === 0) return n.id;
    const child = firstLeaf(n.children);
    if (child) return child;
  }
  return nodes[0]?.id;
}

function filterWiki(nodes: WikiNode[], query: string): WikiNode[] {
  if (!query.trim()) return nodes;
  const walk = (n: WikiNode): WikiNode | null => {
    const kids = n.children.map(walk).filter((x): x is WikiNode => x != null);
    if (matchesQuery(query, n.title) || kids.length) return { ...n, children: kids };
    return null;
  };
  return nodes.map(walk).filter((x): x is WikiNode => x != null);
}

export function WikiPage() {
  const query = useQuery();
  const { pending, consumePending } = useShell();
  const [tree, setTree] = useState<WikiNode[]>([]);
  const [page, setPage] = useState<ItemDetail>();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [expandId, setExpandId] = useState<string | null>(null);
  const [treeLoaded, setTreeLoaded] = useState(false);
  const [treeError, setTreeError] = useState("");

  async function refreshTree() {
    try {
      const t = await api.wikiTree();
      setTree(t);
      setTreeError("");
      setTreeLoaded(true);
      return t;
    } catch (err) {
      const detail = failureDetail(err);
      if (detail) setTreeError(detail);
      setTreeLoaded(true);
      return [];
    }
  }

  async function open(id: string) {
    const detail = await api.item(id);
    setPage(detail);
    setTitle(detail.title);
    setBody(detail.body);
  }

  useEffect(() => {
    void refreshTree().then((t) => {
      const id = firstLeaf(t);
      if (id) void open(id);
    });
  }, []);

  useEffect(() => {
    if (pending?.module !== "wiki") return;
    void open(pending.id);
    consumePending();
  }, [pending]);

  const snapshot = JSON.stringify({ key: page?.id ?? "", title, body });
  const saveState = useAutosave(page?.id, snapshot, async (raw) => {
    const data = JSON.parse(raw) as { key: string; title: string; body: string };
    if (!data.key) return;
    const next = await api.patchWiki(data.key, { title: data.title, body: data.body });
    setPage((cur) => (cur?.id === next.id ? next : cur));
    void refreshTree();
  });

  async function create(asChild: boolean) {
    const parentId = asChild ? page?.id ?? null : null;
    const created = await api.createWiki({
      title: asChild ? "未命名子页" : "未命名页面",
      parentId,
    });
    if (parentId) setExpandId(parentId);
    await refreshTree();
    await open(created.id);
  }

  async function remove(id: string) {
    await api.trashItem(id);
    const t = await refreshTree();
    if (!page || !hasId(t, page.id)) {
      const next = firstLeaf(t);
      if (next) void open(next);
      else {
        setPage(undefined);
        setTitle("");
        setBody("");
      }
    }
  }

  async function move(id: string, dest: { parentId: string | null; index: number }) {
    const t = await api.moveWiki(id, dest);
    setTree(t);
    if (page?.id === id) void open(id);
  }

  const crumb = page
    ? [...page.ancestors.map((a) => a.title), page.title].join(" / ")
    : "";

  return (
    <div className="wiki">
      <aside className="col wiki-nav">
        <div className="col-head split">
          <span>页面树</span>
          <button
            type="button"
            className="icon-btn"
            aria-label="新建页面"
            onClick={() => void create(false)}
          >
            <IconPlus />
          </button>
        </div>
        {!treeLoaded ? (
          <StatusBlock title="正在打开页面树…" />
        ) : treeError ? (
          <StatusBlock
            title="页面树没有打开"
            detail={treeError}
            action={{ label: "重试", onClick: () => void refreshTree() }}
          />
        ) : filterWiki(tree, query).length === 0 ? (
          <StatusBlock
            title={query.trim() ? "没有匹配的页面" : "还没有页面"}
            detail={query.trim() ? "换个词，或清空顶栏搜索。" : "点右上角加号新建一页。"}
          />
        ) : (
          <WikiTree
            nodes={filterWiki(tree, query)}
            selectedId={page?.id}
            expandId={expandId}
            forceOpen={Boolean(query.trim())}
            onSelect={(id) => void open(id)}
            onDelete={(id) => void remove(id)}
            onMove={(id, dest) => void move(id, dest)}
          />
        )}
        {page ? (
          <div className="tree-actions">
            <button type="button" className="chip" onClick={() => void create(true)}>
              在当前页下新建
            </button>
          </div>
        ) : null}
      </aside>

      <article className="col">
        {page ? (
          <div className="reader wiki-editor">
            <div className="reader-status">
              <SaveStatus phase={saveState.phase} onRetry={saveState.retry} />
            </div>
            <div className="byline crumb">
              {page.ancestors.map((ancestor) => (
                <span key={ancestor.id} className="crumb-part">
                  <button type="button" onClick={() => void open(ancestor.id)}>
                    {ancestor.title}
                  </button>
                  <span>/</span>
                </span>
              ))}
              <span>{title || page.title}</span>
            </div>
            <input
              className="title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <SendOnward
              title={title || page.title}
              body={body}
              sourceId={page.id}
              actions={["todo", "draft", "course"]}
            />
            <MarkdownDoc
              value={body}
              editable
              defaultMode="view"
              placeholder="写这一页。预览是阅读形态，编辑才改 Markdown。"
              onChange={setBody}
            />
          </div>
        ) : (
          <StatusBlock title="选择或新建一页" detail="页面树里点一页，或用加号从空白开始。" />
        )}
      </article>

      <AgentPanel
        itemId={page?.id}
        context={page ? `当前 Wiki「${crumb}」` : "选择一页后，对话会跟这一页走。"}
        placeholder="基于当前这页提问…"
      />
    </div>
  );
}
