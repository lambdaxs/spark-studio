import { useEffect, useRef, type MutableRefObject } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown } from "@codemirror/lang-markdown";
import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { tags as t } from "@lezer/highlight";

const highlight = HighlightStyle.define([
  { tag: t.heading, fontWeight: "650", color: "#1c1917" },
  { tag: t.heading1, fontSize: "1.4em" },
  { tag: t.heading2, fontSize: "1.15em" },
  { tag: t.heading3, fontSize: "1.05em" },
  { tag: t.strong, fontWeight: "650" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, color: "#2563eb" },
  { tag: t.url, color: "#2563eb" },
  { tag: t.monospace, color: "#9a3412", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },
  { tag: t.processingInstruction, color: "#a8a29e" },
  { tag: t.comment, color: "#78716c" },
  { tag: t.meta, color: "#78716c" },
  { tag: t.keyword, color: "#2563eb" },
  { tag: t.string, color: "#0f766e" },
  { tag: t.number, color: "#9a3412" },
]);

const theme = EditorView.theme({
  "&": {
    background: "transparent",
    color: "#1c1917",
    fontSize: "16px",
    height: "100%",
  },
  ".cm-content": {
    fontFamily: '"Source Han Sans SC", "Noto Sans SC", Inter, "PingFang SC", sans-serif',
    lineHeight: "1.8",
    padding: "0",
    caretColor: "#2563eb",
  },
  ".cm-line": {
    padding: "0",
  },
  "&.cm-focused": {
    outline: "none",
  },
  ".cm-gutters": {
    display: "none",
  },
  ".cm-activeLine": {
    background: "transparent",
  },
  ".cm-placeholder": {
    color: "#78716c",
    fontStyle: "normal",
  },
});

export type MarkdownSourceHandle = {
  wrap(before: string, after: string): void;
  prefixLine(prefix: string): void;
};

export function MarkdownSource({
  value,
  onChange,
  placeholder,
  handleRef,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
  handleRef?: MutableRefObject<MarkdownSourceHandle | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const skipRef = useRef(false);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!host.current) return;
    const view = new EditorView({
      parent: host.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          markdown(),
          EditorView.lineWrapping,
          syntaxHighlighting(highlight),
          theme,
          cmPlaceholder(placeholder ?? ""),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          EditorView.updateListener.of((update) => {
            if (!update.docChanged || skipRef.current) return;
            onChangeRef.current(update.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (handleRef) {
      handleRef.current = {
        wrap(before, after) {
          const { from, to } = view.state.selection.main;
          const selected = view.state.sliceDoc(from, to) || "文本";
          view.dispatch({
            changes: { from, to, insert: before + selected + after },
            selection: {
              anchor: from + before.length,
              head: from + before.length + selected.length,
            },
          });
          view.focus();
        },
        prefixLine(prefix) {
          const { from } = view.state.selection.main;
          const line = view.state.doc.lineAt(from);
          view.dispatch({
            changes: { from: line.from, insert: prefix },
            selection: { anchor: from + prefix.length },
          });
          view.focus();
        },
      };
    }
    return () => {
      if (handleRef) handleRef.current = null;
      view.destroy();
      viewRef.current = null;
    };
    // Recreate when placeholder changes; value is synced below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placeholder]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (view.state.doc.toString() === value) return;
    skipRef.current = true;
    view.dispatch({
      changes: { from: 0, to: view.state.doc.length, insert: value },
    });
    skipRef.current = false;
  }, [value]);

  return <div className="md-cm" ref={host} />;
}
