import { useEffect, useState } from "react";
import { CollectionsPage } from "./CollectionsPage";
import { TodosPage } from "./TodosPage";
import { WikiPage } from "./WikiPage";
import { PublishPage } from "./PublishPage";
import { CoursesPage } from "./CoursesPage";
import { TrashPage } from "./TrashPage";
import { SettingsPage } from "./SettingsPage";
import { LoginPage } from "./LoginPage";
import { IconCap, IconCheck, IconGear, IconPen, IconSearch, IconStar, IconWiki } from "./Icons";
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

function Workbench({ user, onLogout }: { user: string; onLogout: () => void }) {
  const [mod, setMod] = useState<ModuleId>("collections");
  const [seen, setSeen] = useState<ReadonlySet<ModuleId>>(() => new Set(["collections"]));
  const [query, setQuery] = useState("");
  const [trashOpen, setTrashOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  function openModule(id: ModuleId) {
    setSeen((prev) => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setTrashOpen(false);
    setSettingsOpen(false);
    setMod(id);
  }

  return (
    <ShellContext.Provider value={{ query }}>
      <div className="app">
        <header className="topbar">
          <div className="brand">个人知识工作台</div>
          <label className="search-wrap">
            <IconSearch />
            <input
              className="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="搜索当前列表"
              aria-label="搜索当前列表"
            />
          </label>
          <div className="topbar-meta">
            <button
              type="button"
              className={trashOpen ? "active" : ""}
              onClick={() => {
                setSettingsOpen(false);
                setTrashOpen((v) => !v);
              }}
            >
              回收站
            </button>
            <span>{user}</span>
            <button type="button" onClick={() => void onLogout()}>
              退出
            </button>
          </div>
        </header>
        <nav className="rail">
          {modules.map((m) => (
            <button
              key={m.id}
              className={mod === m.id && !settingsOpen ? "active" : ""}
              onClick={() => openModule(m.id)}
            >
              <m.Icon />
              <span>{m.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={`rail-settings${settingsOpen ? " active" : ""}`}
            onClick={() => {
              setTrashOpen(false);
              setSettingsOpen((v) => !v);
            }}
          >
            <IconGear />
            <span>设置</span>
          </button>
        </nav>
        <main className="workspace">
          {seen.has("collections") ? (
            <div className="workspace-pane" hidden={trashOpen || settingsOpen || mod !== "collections"}>
              <CollectionsPage />
            </div>
          ) : null}
          {seen.has("wiki") ? (
            <div className="workspace-pane" hidden={trashOpen || settingsOpen || mod !== "wiki"}>
              <WikiPage />
            </div>
          ) : null}
          {seen.has("todos") ? (
            <div className="workspace-pane" hidden={trashOpen || settingsOpen || mod !== "todos"}>
              <TodosPage />
            </div>
          ) : null}
          {seen.has("courses") ? (
            <div className="workspace-pane" hidden={trashOpen || settingsOpen || mod !== "courses"}>
              <CoursesPage />
            </div>
          ) : null}
          {seen.has("publish") ? (
            <div className="workspace-pane" hidden={trashOpen || settingsOpen || mod !== "publish"}>
              <PublishPage />
            </div>
          ) : null}
          {settingsOpen ? <SettingsPage username={user} /> : null}
          {trashOpen ? <TrashPage /> : null}
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
