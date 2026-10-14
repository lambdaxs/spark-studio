import { useEffect, useRef } from "react";
import { MarkdownView } from "./MarkdownDoc";
import { presentChat } from "./presentChat";
import type { ChatMessage } from "./api";

export function ChatThread({
  messages,
  busy,
  resetKey,
  className,
}: {
  messages: ChatMessage[];
  busy: boolean;
  resetKey?: string;
  className?: string;
}) {
  const logRef = useRef<HTMLDivElement>(null);
  const stick = useRef(true);

  useEffect(() => {
    stick.current = true;
  }, [resetKey]);

  useEffect(() => {
    const el = logRef.current;
    if (!el || !stick.current) return;
    el.scrollTop = el.scrollHeight;
  }, [messages, busy]);

  return (
    <div
      className={className ?? "agent-log"}
      ref={logRef}
      onScroll={() => {
        const el = logRef.current;
        if (!el) return;
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 64;
      }}
    >
      {messages.map((m, index) => {
        const pending = busy && index === messages.length - 1 && m.role === "assistant";
        if (m.role === "user") {
          return (
            <div key={m.id} className="bubble user">
              {m.content}
            </div>
          );
        }
        const view = presentChat(m.content, pending);
        return (
          <div key={m.id} className={`bubble assistant${pending ? " pending" : ""}`}>
            {view.text ? <MarkdownView compact>{view.text}</MarkdownView> : null}
            {view.notes.map((note, noteIndex) => (
              <div key={`${m.id}-note-${noteIndex}`} className="artifact-note">
                {note}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function ChatError({
  message,
  code,
  onRetry,
  onSettings,
}: {
  message: string;
  code?: string;
  onRetry: () => void;
  onSettings: () => void;
}) {
  return (
    <div className="err err-row" role="alert">
      <span>{message}</span>
      {code === "UNCONFIGURED_API_KEY" ? (
        <button type="button" className="text-btn" onClick={onSettings}>
          去设置
        </button>
      ) : null}
      <button type="button" className="text-btn" onClick={onRetry}>
        重试
      </button>
    </div>
  );
}
