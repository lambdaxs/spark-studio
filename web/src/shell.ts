import { createContext, useContext } from "react";

export const ShellContext = createContext({ query: "" });

export function useQuery() {
  return useContext(ShellContext).query;
}

export function matchesQuery(query: string, ...parts: Array<string | null | undefined>) {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return parts.some((p) => (p ?? "").toLowerCase().includes(q));
}
