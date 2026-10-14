import { useEffect, useRef, useState } from "react";
import { ChatError, ChatThread } from "./ChatThread";
import { api, streamChat, type ChatMessage } from "./api";
import { IconSend } from "./Icons";
import { useShell } from "./shell";

export function AgentPanel({
  itemId,
  context,
  placeholder,
  extra,
  onDone,
  draftSeed,
  onDraftSeed,
}: {
  itemId?: string;
  context: string;
  placeholder: string;
  extra?: { surface?: string };
  onDone?: () => void;
  draftSeed?: string;
  onDraftSeed?: () => void;
}) {
  const { openSettings } = useShell();
  return (
    <AgentPanelBody
      key={itemId ?? "none"}
      itemId={itemId}
      context={context}
      placeholder={placeholder}
      extra={extra}
      onDone={onDone}
      openSettings={openSettings}
      draftSeed={draftSeed}
      onDraftSeed={onDraftSeed}
    />
  );
}

function AgentPanelBody({
  itemId,
  context,
  placeholder,
  extra,
  onDone,
  openSettings,
  draftSeed,
  onDraftSeed,
}: {
  itemId?: string;
  context: string;
  placeholder: string;
  extra?: { surface?: string };
  onDone?: () => void;
  openSettings: () => void;
  draftSeed?: string;
  onDraftSeed?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ message: string; code?: string }>();
  const lastText = useRef("");

  useEffect(() => {
    if (!itemId) return;
    void api.messages(itemId).then(setMessages);
  }, [itemId]);

  useEffect(() => {
    if (!draftSeed) return;
    setDraft(draftSeed);
    onDraftSeed?.();
  }, [draftSeed]);

  async function send(text: string) {
    if (!itemId || !text.trim() || busy) return;
    const content = text.trim();
    lastText.current = content;
    setDraft("");
    setBusy(true);
    setErr(undefined);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content };
    const asst: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, asst]);
    const result = await streamChat(
      itemId,
      content,
      (chunk) => {
        asst.content += chunk;
        setMessages((m) => m.map((x) => (x.id === asst.id ? { ...asst } : x)));
      },
      extra,
    );
    if (result.error) {
      setErr({ message: result.error, code: result.code });
      setMessages((m) => m.filter((x) => x.id !== asst.id || asst.content));
    }
    setBusy(false);
    onDone?.();
  }

  return (
    <aside className="col agent">
      <div className="agent-head">Agent</div>
      <div className="agent-ctx">{context}</div>
      {messages.length === 0 ? (
        <div className="agent-log">
          <div className="agent-empty">
            {itemId ? "从下面提问。这场对话会留在当前这一条上。" : "选择一条之后，对话会跟这一条走。"}
          </div>
        </div>
      ) : (
        <ChatThread messages={messages} busy={busy} resetKey={itemId} />
      )}
      {err ? (
        <ChatError
          message={err.message}
          code={err.code}
          onRetry={() => void send(lastText.current)}
          onSettings={openSettings}
        />
      ) : null}
      <form
        className="agent-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          disabled={!itemId || busy}
        />
        <button type="submit" disabled={!itemId || busy || !draft.trim()} aria-label="发送">
          <IconSend />
        </button>
      </form>
    </aside>
  );
}
