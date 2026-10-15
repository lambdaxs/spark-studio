import { IconSearch } from "./Icons";
import { useShell } from "./shell";

export function SearchBox({ placeholder = "搜索…" }: { placeholder?: string }) {
  const { query, setQuery } = useShell();
  return (
    <label className="pane-search">
      <IconSearch />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
    </label>
  );
}
