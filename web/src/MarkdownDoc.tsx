import { useRef, useState, type ReactNode } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { MarkdownSource, type MarkdownSourceHandle } from "./MarkdownSource";

export function MarkdownView({
  children,
  compact,
}: {
  children: string;
  compact?: boolean;
}) {
  const text = children ?? "";
  if (!text.trim()) return null;
  return (
    <div className={`markdown${compact ? " compact" : ""}`}>
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {text}
      </Markdown>
    </div>
  );
}

export function MarkdownDoc({
  value,
  onChange,
  editable = false,
  defaultMode = "view",
  placeholder = "暂无正文",
  quiet = false,
}: {
  value: string;
  onChange?: (next: string) => void;
  editable?: boolean;
  defaultMode?: "view" | "source" | "split";
  placeholder?: string;
  quiet?: boolean;
}) {
  const [mode, setMode] = useState<"view" | "source" | "split">(
    editable ? defaultMode : "view",
  );
  const handleRef = useRef<MarkdownSourceHandle | null>(null);

  const tools: { id: string; label: string; run: () => void }[] = [
    { id: "h2", label: "标题", run: () => handleRef.current?.prefixLine("## ") },
    { id: "bold", label: "粗体", run: () => handleRef.current?.wrap("**", "**") },
    { id: "italic", label: "斜体", run: () => handleRef.current?.wrap("*", "*") },
    { id: "ul", label: "列表", run: () => handleRef.current?.prefixLine("- ") },
    { id: "quote", label: "引用", run: () => handleRef.current?.prefixLine("> ") },
    { id: "fence", label: "代码块", run: () => handleRef.current?.wrap("```\n", "\n```") },
  ];

  const editing = mode === "source" || mode === "split";
  const source = editing ? (
    <MarkdownSource
      value={value}
      onChange={(next) => onChange?.(next)}
      placeholder={placeholder}
      handleRef={handleRef}
    />
  ) : null;
  const preview = value.trim() ? (
    <MarkdownView>{value}</MarkdownView>
  ) : (
    <div className="md-empty">{placeholder}</div>
  );

  let body: ReactNode;
  if (!editable || mode === "view") {
    body = preview;
  } else if (mode === "split") {
    body = (
      <div className="md-split">
        <div className="md-split-pane">{source}</div>
        <div className="md-split-pane preview">{preview}</div>
      </div>
    );
  } else {
    body = source;
  }

  return (
    <div className={`md-doc${quiet ? " quiet" : ""}`}>
      {editable && (!quiet || editing) ? (
        <div className="md-toolbar">
          <button
            type="button"
            className={mode === "view" ? "active" : ""}
            onClick={() => setMode("view")}
          >
            预览
          </button>
          <button
            type="button"
            className={mode === "source" ? "active" : ""}
            onClick={() => setMode("source")}
          >
            编辑
          </button>
          <button
            type="button"
            className={mode === "split" ? "active" : ""}
            onClick={() => setMode("split")}
          >
            对照
          </button>
          {editing
            ? tools.map((t) => (
                <button key={t.id} type="button" onClick={t.run}>
                  {t.label}
                </button>
              ))
            : null}
        </div>
      ) : null}
      {quiet && editable && mode === "view" ? (
        <div
          className="md-open-edit"
          role="button"
          tabIndex={0}
          onClick={() => setMode("source")}
          onKeyDown={(e) => {
            if (e.key === "Enter") setMode("source");
          }}
        >
          {body}
        </div>
      ) : (
        body
      )}
    </div>
  );
}
