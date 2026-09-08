import { useEffect, useState, type FormEvent } from "react";
import { api, type SettingsStatus } from "./api";

function mcpConfigJson(mcpUrl: string, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        "spark-studio": {
          type: "http",
          url: mcpUrl,
          headers: {
            Authorization: `Bearer ${token || "YOUR_TOKEN"}`,
          },
        },
      },
    },
    null,
    2,
  );
}

export function SettingsPage({ username }: { username: string }) {
  const [status, setStatus] = useState<SettingsStatus>();
  const [key, setKey] = useState("");
  const [token, setToken] = useState("");
  const [publicUrl, setPublicUrl] = useState("");
  const [revealedToken, setRevealedToken] = useState("");
  const [accountName, setAccountName] = useState(username);
  const [accountPassword, setAccountPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string>();
  const [accountNote, setAccountNote] = useState<string>();
  const [mcpNote, setMcpNote] = useState<string>();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    void api.settings().then((next) => {
      setStatus(next);
      setPublicUrl(next.mcpPublicUrl);
    });
  }, []);

  async function saveKey(e: FormEvent) {
    e.preventDefault();
    if (!key.trim()) return;
    setBusy(true);
    setNote(undefined);
    try {
      const next = await api.saveSettings({ cursorApiKey: key.trim() });
      setStatus(next);
      setKey("");
      setNote("已保存。Agent 会立刻使用新的 key。");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "保存失败");
    }
    setBusy(false);
  }

  async function clearKey() {
    setBusy(true);
    setNote(undefined);
    const next = await api.saveSettings({ cursorApiKey: "" });
    setStatus(next);
    setKey("");
    setNote("已清除。");
    setBusy(false);
  }

  async function saveMcp(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMcpNote(undefined);
    try {
      const next = await api.saveSettings({
        workbenchToken: token.trim() || undefined,
        mcpPublicUrl: publicUrl.trim() || undefined,
      });
      setStatus(next);
      setPublicUrl(next.mcpPublicUrl);
      if (token.trim()) setRevealedToken(token.trim());
      setToken("");
      setMcpNote("已保存。外部 Agent 用这个 URL 和 Bearer token 接入。");
    } catch (err) {
      setMcpNote(err instanceof Error ? err.message : "保存失败");
    }
    setBusy(false);
  }

  async function generateToken() {
    setBusy(true);
    setMcpNote(undefined);
    const next = await api.generateWorkbenchToken();
    setStatus(next);
    setRevealedToken(next.token);
    setToken(next.token);
    setMcpNote("已生成新 token，完整值只在这次显示。复制配置前先保存公开地址。");
    setBusy(false);
  }

  async function clearToken() {
    setBusy(true);
    setMcpNote(undefined);
    const next = await api.saveSettings({ workbenchToken: "" });
    setStatus(next);
    setToken("");
    setRevealedToken("");
    setMcpNote("已清除 token。导入、导出和 MCP 会拒绝请求。");
    setBusy(false);
  }

  const configToken = token.trim() || revealedToken;
  const mcpUrl = status?.mcpUrl ?? "";

  async function copyConfig() {
    if (!mcpUrl) return;
    await navigator.clipboard.writeText(mcpConfigJson(mcpUrl, configToken));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  async function saveAccount(e: FormEvent) {
    e.preventDefault();
    if (!accountName.trim() || accountPassword.length < 8) return;
    setBusy(true);
    setAccountNote(undefined);
    try {
      await api.saveCredentials(accountName.trim(), accountPassword);
      setAccountPassword("");
      setAccountNote("已更新登录账号。其它浏览器里的会话会失效。");
    } catch (err) {
      setAccountNote(err instanceof Error ? err.message : "保存失败");
    }
    setBusy(false);
  }

  return (
    <div className="settings">
      <section className="settings-card">
        <div className="col-head">登录账号</div>
        <p className="settings-lead">
          公网站点靠这一组用户名和密码挡着。密码写成哈希存在 <code>.env</code>。改密码后当前浏览器会续上新会话。
        </p>
        <form className="settings-form" onSubmit={(e) => void saveAccount(e)}>
          <label>
            用户名
            <input
              autoComplete="username"
              value={accountName}
              onChange={(e) => setAccountName(e.target.value)}
            />
          </label>
          <label>
            新密码
            <input
              type="password"
              autoComplete="new-password"
              value={accountPassword}
              onChange={(e) => setAccountPassword(e.target.value)}
              placeholder="至少 8 位"
            />
          </label>
          <div className="settings-actions">
            <button
              type="submit"
              className="primary-btn"
              disabled={busy || !accountName.trim() || accountPassword.length < 8}
            >
              保存账号
            </button>
          </div>
        </form>
        {accountNote ? <p className="settings-note">{accountNote}</p> : null}
      </section>

      <section className="settings-card">
        <div className="col-head">设置</div>
        <p className="settings-lead">
          Cursor API Key 存在本机 <code>.env</code>，只给站内 Agent 用。界面不会回传完整 key。
        </p>
        <form className="settings-form" onSubmit={(e) => void saveKey(e)}>
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
              <button type="button" className="text-btn" disabled={busy} onClick={() => void clearKey()}>
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

      <section className="settings-card settings-card-wide">
        <div className="col-head">MCP 接入 · HTTP</div>
        <p className="settings-lead">
          外部 Agent 不必和本仓库在同一台机器。连 HTTP MCP：<code>{status?.mcpUrl ?? "/mcp"}</code>
          ，请求头带 <code>Authorization: Bearer &lt;token&gt;</code>
          。收藏导入、出稿导出的 REST 也用同一枚 token。未配置 token 时这些接口一律拒绝。
        </p>
        <p className="settings-lead">
          公开地址写成远程 Agent 能访问的根 URL，不要带 <code>/mcp</code>
          。站点默认听 <code>0.0.0.0:8787</code>。公网请用 HTTPS 反代，并把这里改成你的域名。
        </p>
        <form className="settings-form" onSubmit={(e) => void saveMcp(e)}>
          <label>
            公开地址
            <input
              type="url"
              autoComplete="off"
              value={publicUrl}
              onChange={(e) => setPublicUrl(e.target.value)}
              placeholder="http://127.0.0.1:8787"
            />
          </label>
          <label>
            Workbench Token
            <input
              type="text"
              autoComplete="off"
              spellCheck={false}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                status?.workbenchTokenConfigured
                  ? `已保存 · 末四位 ${status.workbenchTokenHint}`
                  : "生成或粘贴一枚 token"
              }
            />
          </label>
          <div className="settings-actions">
            <button type="submit" className="primary-btn" disabled={busy}>
              保存
            </button>
            <button type="button" className="text-btn" disabled={busy} onClick={() => void generateToken()}>
              生成 token
            </button>
            {status?.workbenchTokenConfigured ? (
              <button type="button" className="text-btn" disabled={busy} onClick={() => void clearToken()}>
                清除 token
              </button>
            ) : null}
          </div>
        </form>
        {status && !status.workbenchTokenConfigured && !mcpNote ? (
          <p className="settings-note">还没有 token，外部导入 / 导出 / MCP 现在不可用。</p>
        ) : null}
        {mcpNote ? <p className="settings-note">{mcpNote}</p> : null}

        <h3 className="settings-h">接到 Cursor / 其它 Agent</h3>
        <p className="settings-lead">
          把下面这段加到对方的 MCP 配置。token 只在这次生成或你刚填进输入框时写入 JSON；刷新后请自己替换{" "}
          <code>YOUR_TOKEN</code>。
        </p>
        <div className="settings-pre-wrap">
          <pre className="settings-pre">
            {mcpUrl ? mcpConfigJson(mcpUrl, configToken) : "读取接入地址中…"}
          </pre>
          <button
            type="button"
            className="text-btn"
            disabled={!mcpUrl}
            onClick={() => void copyConfig()}
          >
            {copied ? "已复制" : "复制"}
          </button>
        </div>
        <p className="settings-lead">
          REST 同样带 Bearer：<code>POST /api/import/items</code>、
          <code>GET /api/export/variants</code>、
          <code>GET /api/export/variants/:draftId/:platform</code>。
        </p>
      </section>

      <section className="settings-card settings-card-wide">
        <div className="col-head">收藏导入 · MCP</div>
        <p className="settings-lead">
          收藏页不登录知乎，也不在站内粘贴导入。外部 Agent 通过 HTTP MCP 把一篇标题 + Markdown
          正文推进来；夹名不存在会自动建夹。
        </p>

        <h3 className="settings-h">导入工具 import_collection_item</h3>
        <p className="settings-lead">一次导入一篇。正文请先转成 Markdown，不要丢 HTML 或截图。</p>
        <table className="settings-table">
          <thead>
            <tr>
              <th>字段</th>
              <th>必填</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>collectionName</code>
              </td>
              <td>是</td>
              <td>收藏夹名称，没有则新建</td>
            </tr>
            <tr>
              <td>
                <code>title</code>
              </td>
              <td>是</td>
              <td>标题</td>
            </tr>
            <tr>
              <td>
                <code>body</code>
              </td>
              <td>是</td>
              <td>Markdown 正文</td>
            </tr>
            <tr>
              <td>
                <code>sourceUrl</code>
              </td>
              <td>否</td>
              <td>原文链接</td>
            </tr>
            <tr>
              <td>
                <code>author</code>
              </td>
              <td>否</td>
              <td>作者名</td>
            </tr>
            <tr>
              <td>
                <code>contentKind</code>
              </td>
              <td>否</td>
              <td>
                <code>answer</code> 或 <code>article</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>originalAt</code>
              </td>
              <td>否</td>
              <td>原文时间，毫秒时间戳</td>
            </tr>
            <tr>
              <td>
                <code>groups</code>
              </td>
              <td>否</td>
              <td>字符串数组，可选主题；收藏页目前不展示</td>
            </tr>
          </tbody>
        </table>

        <h3 className="settings-h">查询工具</h3>
        <ul className="settings-tools">
          <li>
            <code>list_collections</code> — 列出收藏夹
          </li>
          <li>
            <code>list_collection_items</code> — 按 <code>collectionId</code> 列出该夹文章摘要
          </li>
        </ul>
      </section>

      <section className="settings-card settings-card-wide">
        <div className="col-head">出稿导出 · MCP</div>
        <p className="settings-lead">
          工作台不登录公众号 / 小红书 / 知乎，也不代发。出稿页把某平台变体标为「可导出」后，外部
          Agent 用同一套 HTTP MCP 取走素材包去发布。
        </p>

        <h3 className="settings-h">列出可导出 list_exportable_variants</h3>
        <p className="settings-lead">无入参。只返回 status 为 ready 的平台变体。</p>
        <table className="settings-table">
          <thead>
            <tr>
              <th>返回字段</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>draftId</code>
              </td>
              <td>底稿 id，导出时回传</td>
            </tr>
            <tr>
              <td>
                <code>draftTitle</code>
              </td>
              <td>底稿标题</td>
            </tr>
            <tr>
              <td>
                <code>platform</code>
              </td>
              <td>
                <code>wechat</code> / <code>xiaohongshu</code> / <code>zhihu</code>
              </td>
            </tr>
            <tr>
              <td>
                <code>title</code> · <code>body</code> · <code>summary</code>
              </td>
              <td>该平台标题、正文、摘要</td>
            </tr>
            <tr>
              <td>
                <code>tags</code>
              </td>
              <td>字符串数组</td>
            </tr>
            <tr>
              <td>
                <code>coverNote</code> · <code>imageBriefs</code>
              </td>
              <td>封面说明，以及配图说明数组</td>
            </tr>
            <tr>
              <td>
                <code>updatedAt</code>
              </td>
              <td>变体最近更新时间，毫秒</td>
            </tr>
          </tbody>
        </table>

        <h3 className="settings-h">取出变体包 export_variant</h3>
        <p className="settings-lead">
          一次取一份。变体未标可导出时返回错误。外部 Agent 拿到包后自行发布，工作台不跟踪发布结果。
        </p>
        <table className="settings-table">
          <thead>
            <tr>
              <th>入参</th>
              <th>必填</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>draftId</code>
              </td>
              <td>是</td>
              <td>
                底稿 id，从 <code>list_exportable_variants</code> 取
              </td>
            </tr>
            <tr>
              <td>
                <code>platform</code>
              </td>
              <td>是</td>
              <td>
                <code>wechat</code> / <code>xiaohongshu</code> / <code>zhihu</code>
              </td>
            </tr>
          </tbody>
        </table>
        <table className="settings-table">
          <thead>
            <tr>
              <th>返回字段</th>
              <th>说明</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <code>platform</code>
              </td>
              <td>平台</td>
            </tr>
            <tr>
              <td>
                <code>title</code> · <code>body</code> · <code>summary</code>
              </td>
              <td>可直接用于发布的文案</td>
            </tr>
            <tr>
              <td>
                <code>tags</code>
              </td>
              <td>话题 / 标签</td>
            </tr>
            <tr>
              <td>
                <code>coverNote</code> · <code>imageBriefs</code>
              </td>
              <td>封面与配图说明，不是图片文件</td>
            </tr>
            <tr>
              <td>
                <code>sourceDraftId</code> · <code>sourceTitle</code>
              </td>
              <td>来源底稿</td>
            </tr>
            <tr>
              <td>
                <code>exportedAt</code>
              </td>
              <td>本次取出时间，毫秒</td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
