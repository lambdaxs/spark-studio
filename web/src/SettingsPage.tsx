import { useEffect, useState, type FormEvent } from "react";
import { api, type SettingsStatus } from "./api";

export function SettingsPage() {
  const [status, setStatus] = useState<SettingsStatus>();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();

  useEffect(() => {
    void api.settings().then(setStatus);
  }, []);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setNote(undefined);
    try {
      const next = await api.saveSettings(key.trim());
      setStatus(next);
      setKey("");
      setNote("已保存。Agent 会立刻使用新的 key。");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "保存失败");
    }
    setBusy(false);
  }

  async function clear() {
    setBusy(true);
    setNote(undefined);
    const next = await api.saveSettings("");
    setStatus(next);
    setKey("");
    setNote("已清除。");
    setBusy(false);
  }

  return (
    <div className="settings">
      <section className="settings-card">
        <div className="col-head">设置</div>
        <p className="settings-lead">
          Cursor API Key 存在本机 <code>.env</code>，只给站内 Agent 用。界面不会回传完整 key。
        </p>
        <form className="settings-form" onSubmit={(e) => void save(e)}>
          <label>
            Cursor API Key
            <input
              type="password"
              autoComplete="off"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder={
                status?.cursorApiKeyConfigured
                  ? `已保存 · 末四位 ${status.cursorApiKeyHint}`
                  : "粘贴 Cursor API Key"
              }
            />
          </label>
          <div className="settings-actions">
            <button type="submit" className="primary-btn" disabled={busy || !key.trim()}>
              保存
            </button>
            {status?.cursorApiKeyConfigured ? (
              <button type="button" className="text-btn" disabled={busy} onClick={() => void clear()}>
                清除
              </button>
            ) : null}
          </div>
        </form>
        {status && !status.cursorApiKeyConfigured && !note ? (
          <p className="settings-note">还没有 key，右侧对话会提示来这里填写。</p>
        ) : null}
        {note ? <p className="settings-note">{note}</p> : null}
      </section>
    </div>
  );
}
