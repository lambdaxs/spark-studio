import { useEffect, useState } from "react";
import { api, streamChat, type ChatMessage } from "./api";
import { IconSend } from "./Icons";
import { MarkdownView } from "./MarkdownDoc";

export function AgentPanel({
  itemId,
  context,
  placeholder,
  extra,
  onDone,
}: {
  itemId?: string;
  context: string;
  placeholder: string;
  extra?: { surface?: string };
  onDone?: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    setDraft("");
    setErr(undefined);
    if (!itemId) {
      setMessages([]);
      return;
    }
    void api.messages(itemId).then(setMessages);
  }, [itemId]);

  async function send() {
    if (!itemId || !draft.trim() || busy) return;
    const text = draft.trim();
    setDraft("");
    setBusy(true);
    setErr(undefined);
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: text };
    const asst: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: "" };
    setMessages((m) => [...m, userMsg, asst]);
    const result = await streamChat(
      itemId,
      text,
      (chunk) => {
        asst.content += chunk;
        setMessages((m) => m.map((x) => (x.id === asst.id ? { ...asst } : x)));
      },
      extra,
    );
    if (result.error) {
      setErr(result.error);
      setMessages((m) => m.filter((x) => x.id !== asst.id || asst.content));
    }
    setBusy(false);
    onDone?.();
  }

  return (
    <aside className="col agent">
      <div className="agent-head">Agent</div>
      <div className="agent-ctx">{context}</div>
      <div className="agent-log" key={itemId ?? "none"}>
        {messages.map((m) => (
          <div key={m.id} className={`bubble ${m.role}`}>
            {m.role === "assistant" ? <MarkdownView compact>{m.content}</MarkdownView> : m.content}
          </div>
        ))}
      </div>
      {err ? (
        <div className="err" role="alert">
          {err}
        </div>
      ) : null}
      <form
        className="agent-form"
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
      >
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send();
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
