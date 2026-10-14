import { useEffect, useRef, useState, type ReactNode } from "react";

export function HoverDelete({
  onDelete,
  children,
  className,
}: {
  onDelete: () => void;
  children: ReactNode;
  className?: string;
}) {
  const [ready, setReady] = useState(false);
  const timer = useRef(0);
  const hovered = useRef(false);
  const focused = useRef(false);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function hideIfIdle() {
    if (hovered.current || focused.current) return;
    window.clearTimeout(timer.current);
    setReady(false);
  }

  return (
    <div
      ref={root}
      className={`hover-delete${className ? ` ${className}` : ""}`}
      onMouseEnter={() => {
        hovered.current = true;
        if (focused.current) {
          setReady(true);
          return;
        }
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setReady(true), 1000);
      }}
      onMouseLeave={() => {
        hovered.current = false;
        hideIfIdle();
      }}
      onFocusCapture={() => {
        focused.current = true;
        window.clearTimeout(timer.current);
        setReady(true);
      }}
      onBlurCapture={(e) => {
        if (root.current?.contains(e.relatedTarget as Node | null)) return;
        focused.current = false;
        hideIfIdle();
      }}
    >
      {children}
      {ready ? (
        <button
          type="button"
          className="row-delete"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        >
          删除
        </button>
      ) : null}
    </div>
  );
}
