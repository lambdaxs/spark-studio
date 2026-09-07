import { HoverDelete } from "./HoverDelete";
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
  onOpen,
  onWrite,
  onDelete,
}: {
  books: CourseRow[];
  loaded?: boolean;
  onOpen: (id: string) => void;
  onWrite: () => void;
  onDelete: (id: string) => void;
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
        <div className="shelf-empty">
          <p>正在打开书架…</p>
        </div>
      ) : books.length === 0 ? (
        <div className="shelf-empty">
          <p>还没有书。</p>
          <button type="button" className="primary-btn" onClick={onWrite}>
            写一本新书
          </button>
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
