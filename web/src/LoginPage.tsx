import { useState, type FormEvent } from "react";
import { api, type AuthMe } from "./api";

export function LoginPage({
  setupRequired,
  onAuthed,
}: {
  setupRequired: boolean;
  onAuthed: (me: AuthMe) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      const me = setupRequired
        ? await api.setup(username, password)
        : await api.login(username, password);
      onAuthed(me);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败");
    }
    setBusy(false);
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={(e) => void submit(e)}>
        <div className="login-brand">个人知识工作台</div>
        <h1>{setupRequired ? "创建登录账号" : "登录"}</h1>
        <p className="login-lead">
          {setupRequired
            ? "上公网前先设好账号。密码至少 8 位，存在本机 .env，不会存明文。"
            : "这是单用户工作台。登录后才能看收藏、Wiki 和课程。"}
        </p>
        <label>
          用户名
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </label>
        <label>
          密码
          <input
            type="password"
            autoComplete={setupRequired ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={setupRequired ? 8 : undefined}
          />
        </label>
        {error ? <p className="login-error">{error}</p> : null}
        <button type="submit" className="primary-btn" disabled={busy || !username.trim() || !password}>
          {setupRequired ? "创建并进入" : "进入工作台"}
        </button>
      </form>
    </div>
  );
}
