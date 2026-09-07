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

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <div
      className={`hover-delete${className ? ` ${className}` : ""}`}
      onMouseEnter={() => {
        timer.current = window.setTimeout(() => setReady(true), 1000);
      }}
      onMouseLeave={() => {
        window.clearTimeout(timer.current);
        setReady(false);
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
