import { useEffect, useState } from "react";
import { CollectionsPage } from "./CollectionsPage";
import { TodosPage } from "./TodosPage";
import { WikiPage } from "./WikiPage";
import { PublishPage } from "./PublishPage";
import { CoursesPage } from "./CoursesPage";
import { TrashPage } from "./TrashPage";
import { SettingsPage } from "./SettingsPage";
import { LoginPage } from "./LoginPage";
import {
  IconCap,
  IconCheck,
  IconGear,
  IconLogo,
  IconLogout,
  IconPen,
  IconStar,
  IconTrash,
  IconWiki,
} from "./Icons";
import { api, type AuthMe } from "./api";
import { ShellContext } from "./shell";

const modules = [
  { id: "collections", label: "收藏", Icon: IconStar },
  { id: "wiki", label: "Wiki", Icon: IconWiki },
  { id: "todos", label: "待办", Icon: IconCheck },
  { id: "courses", label: "课程", Icon: IconCap },
  { id: "publish", label: "出稿", Icon: IconPen },
] as const;

type ModuleId = (typeof modules)[number]["id"];
type Overlay = "trash" | "settings" | null;

function Workbench({ user, onLogout }: { user: string; onLogout: () => void }) {
  const [mod, setMod] = useState<ModuleId>("collections");
  const [seen, setSeen] = useState<ReadonlySet<ModuleId>>(() => new Set(["collections"]));
  const [query, setQuery] = useState("");
  const [overlay, setOverlay] = useState<Overlay>(null);

  function openModule(id: ModuleId) {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setOverlay(null);
    if (id !== mod) setQuery("");
    setMod(id);
  }

  function toggleOverlay(next: Exclude<Overlay, null>) {
    setQuery("");
    setOverlay((cur) => (cur === next ? null : next));
  }

  return (
    <ShellContext.Provider value={{ query, setQuery }}>
      <div className="app">
        <nav className="rail">
          <div className="brand">
            <IconLogo />
            <span>个人知识工作台</span>
          </div>
          {modules.map((m) => (
            <button
              key={m.id}
              type="button"
              className={`rail-item${mod === m.id && !overlay ? " active" : ""}`}
              onClick={() => openModule(m.id)}
            >
              <m.Icon />
              <span>{m.label}</span>
            </button>
          ))}
          <div className="rail-foot">
            <button
              type="button"
              className={`rail-item${overlay === "trash" ? " active" : ""}`}
              onClick={() => toggleOverlay("trash")}
            >
              <IconTrash />
              <span>回收站</span>
            </button>
            <button
              type="button"
              className={`rail-item${overlay === "settings" ? " active" : ""}`}
              onClick={() => toggleOverlay("settings")}
            >
              <IconGear />
              <span>设置</span>
            </button>
            <div className="rail-user">
              <span className="rail-avatar">{user.slice(0, 1).toUpperCase()}</span>
              <span className="rail-name">{user}</span>
              <button type="button" className="icon-btn" aria-label="退出登录" title="退出登录" onClick={onLogout}>
                <IconLogout />
              </button>
            </div>
          </div>
        </nav>
        <main className="workspace">
          {seen.has("collections") ? (
            <div className="workspace-pane" hidden={Boolean(overlay) || mod !== "collections"}>
              <CollectionsPage />
            </div>
          ) : null}
          {seen.has("wiki") ? (
            <div className="workspace-pane" hidden={Boolean(overlay) || mod !== "wiki"}>
              <WikiPage />
            </div>
          ) : null}
          {seen.has("todos") ? (
            <div className="workspace-pane" hidden={Boolean(overlay) || mod !== "todos"}>
              <TodosPage />
            </div>
          ) : null}
          {seen.has("courses") ? (
            <div className="workspace-pane" hidden={Boolean(overlay) || mod !== "courses"}>
              <CoursesPage />
            </div>
          ) : null}
          {seen.has("publish") ? (
            <div className="workspace-pane" hidden={Boolean(overlay) || mod !== "publish"}>
              <PublishPage />
            </div>
          ) : null}
          {overlay === "settings" ? <SettingsPage username={user} /> : null}
          {overlay === "trash" ? <TrashPage /> : null}
        </main>
      </div>
    </ShellContext.Provider>
  );
}

export function App() {
  const [auth, setAuth] = useState<AuthMe>();

  useEffect(() => {
    void api.me().then(setAuth);
    function onUnauth() {
      void api.me().then(setAuth);
    }
    window.addEventListener("workbench:unauthorized", onUnauth);
    return () => window.removeEventListener("workbench:unauthorized", onUnauth);
  }, []);

  async function logout() {
    await api.logout();
    setAuth({ authenticated: false, setupRequired: false, username: null });
  }

  if (!auth) return <div className="login" />;
  if (!auth.authenticated) {
    return <LoginPage setupRequired={auth.setupRequired} onAuthed={setAuth} />;
  }
  return <Workbench user={auth.username ?? ""} onLogout={() => void logout()} />;
}
