import { useEffect, useState } from "react";
import { api, type TrashRow } from "./api";
import { StatusBlock, failureDetail } from "./feedback";
import { matchesQuery, useQuery } from "./shell";

function formatWhen(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const KINDS = ["全部", "收藏", "Wiki", "待办", "课程", "出稿"] as const;

export function TrashPage() {
  const query = useQuery();
  const [rows, setRows] = useState<TrashRow[]>([]);
  const [kind, setKind] = useState<(typeof KINDS)[number]>("全部");
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");

  async function refresh() {
    try {
      setRows(await api.trash());
      setError("");
    } catch (err) {
      const detail = failureDetail(err);
      if (detail) setError(detail);
    } finally {
      setLoaded(true);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  const byKind = rows.filter((r) => kind === "全部" || r.typeLabel === kind);
  const visible = byKind.filter((r) => matchesQuery(query, r.title, r.typeLabel));

  return (
    <div className="trash">
      <section className="col">
        <div className="col-head">回收站</div>
        <div className="filters">
          {KINDS.map((item) => (
            <button
              key={item}
              type="button"
              className={kind === item ? "active" : ""}
              onClick={() => setKind(item)}
            >
              {item}
            </button>
          ))}
        </div>
        {!loaded ? (
          <StatusBlock title="正在打开回收站…" />
        ) : error ? (
          <StatusBlock title="回收站没有打开" detail={error} action={{ label: "重试", onClick: () => void refresh() }} />
        ) : visible.length === 0 ? (
          <StatusBlock
            title={query.trim() ? "没有匹配的条目" : kind === "全部" ? "回收站是空的" : `没有${kind}`}
            detail={
              query.trim()
                ? "换个词，或清空顶栏搜索。"
                : "列表里悬停约 1 秒可以删除，焦点停在一行上也能删。删掉的会到这里。"
            }
          />
        ) : (
          visible.map((r) => (
            <div key={r.batchId} className="row trash-row">
              <div className="todo-copy">
                <span className="title">{r.title}</span>
                <span className="meta">
                  {r.typeLabel}
                  {r.extraCount > 0 ? ` · 含 ${r.extraCount} 项` : ""}
                  {` · ${formatWhen(r.deletedAt)}`}
                </span>
              </div>
              <button type="button" className="text-btn" onClick={() => void api.restore(r.batchId).then(refresh)}>
                恢复
              </button>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
