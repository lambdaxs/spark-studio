import { useEffect, useState } from "react";
import { api, type TrashRow } from "./api";
import { matchesQuery, useQuery } from "./shell";

function formatWhen(ms: number) {
  const d = new Date(ms);
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

export function TrashPage() {
  const query = useQuery();
  const [rows, setRows] = useState<TrashRow[]>([]);

  async function refresh() {
    setRows(await api.trash());
  }

  useEffect(() => {
    void refresh();
  }, []);

  const visible = rows.filter((r) => matchesQuery(query, r.title, r.typeLabel));

  return (
    <div className="trash">
      <section className="col">
        <div className="col-head">回收站</div>
        {visible.length === 0 ? (
          <div className="empty-col">回收站是空的。列表里悬停 1 秒后可以删除，条目会到这里。</div>
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
