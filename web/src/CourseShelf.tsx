import { HoverDelete } from "./HoverDelete";
import { StatusBlock } from "./feedback";
import { IconPlus } from "./Icons";
import type { CourseRow } from "./api";

function tone(id: string) {
  let n = 0;
  for (const ch of id) n = (n + ch.charCodeAt(0)) % 5;
  return `tone-${n}`;
}

export function CourseShelf({
  books,
  loaded,
  error,
  onOpen,
  onWrite,
  onDelete,
  onRetry,
  emptyTitle,
  emptyDetail,
}: {
  books: CourseRow[];
  loaded?: boolean;
  error?: string;
  onOpen: (id: string) => void;
  onWrite: () => void;
  onDelete: (id: string) => void;
  onRetry: () => void;
  emptyTitle?: string;
  emptyDetail?: string;
}) {
  return (
    <div className="shelf">
      <div className="shelf-head">
        <span>书架</span>
        <button type="button" className="text-btn" onClick={onWrite}>
          <IconPlus />
          写一本新书
        </button>
      </div>
      {!loaded ? (
        <StatusBlock title="正在打开书架…" />
      ) : error ? (
        <StatusBlock title="书架没有打开" detail={error} action={{ label: "重试", onClick: onRetry }} />
      ) : books.length === 0 ? (
        <div className="shelf-empty">
          <p>{emptyTitle ?? "还没有书。"}</p>
          {emptyDetail ? <p>{emptyDetail}</p> : null}
          {emptyTitle ? null : (
            <button type="button" className="primary-btn" onClick={onWrite}>
              写一本新书
            </button>
          )}
        </div>
      ) : (
        <div className="shelf-grid">
          {books.map((b) => (
            <HoverDelete key={b.id} className="book-wrap" onDelete={() => onDelete(b.id)}>
              <button type="button" className={`book-card ${tone(b.id)}`} onClick={() => onOpen(b.id)}>
                <span className="book-spine" />
                <span className="book-title">{b.title}</span>
                {b.subtitle ? <span className="book-sub">{b.subtitle}</span> : null}
                <span className="book-progress">
                  {b.lessonCount === 0 ? "尚无课时" : `${b.doneCount}/${b.lessonCount} 课`}
                </span>
                {b.lessonCount > 0 ? (
                  <span className="book-bar">
                    <span style={{ width: `${Math.round((b.doneCount / b.lessonCount) * 100)}%` }} />
                  </span>
                ) : null}
              </button>
            </HoverDelete>
          ))}
        </div>
      )}
    </div>
  );
}
