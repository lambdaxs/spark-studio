import { createContext, useContext } from "react";

export type ModuleId = "collections" | "wiki" | "todos" | "courses" | "publish";

export type OpenTarget = {
  module: ModuleId;
  id: string;
  collectionId?: string | null;
  courseView?: "read" | "studio";
};

export type ShellValue = {
  query: string;
  openSettings: () => void;
  pending: OpenTarget | null;
  openItem: (target: OpenTarget) => void;
  consumePending: () => void;
};

export const ShellContext = createContext<ShellValue>({
  query: "",
  openSettings: () => {},
  pending: null,
  openItem: () => {},
  consumePending: () => {},
});

export function useShell() {
  return useContext(ShellContext);
}

export function useQuery() {
  return useShell().query;
}

export function matchesQuery(query: string, ...parts: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => (p ?? "").toLowerCase().includes(q));
}

