import { useEffect, useRef, useState } from "react";

export type SavePhase = "idle" | "editing" | "saving" | "saved" | "error";

function recordKey(snapshot: string) {
  try {
    const data = JSON.parse(snapshot) as { key?: string };
    return data.key ?? "";
  } catch {
    return "";
  }
}

export function useAutosave(
  key: string | undefined,
  snapshot: string,
  save: (snapshot: string) => Promise<void>,
) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const latest = useRef(snapshot);
  latest.current = snapshot;
  const applied = useRef(snapshot);
  const seen = useRef(snapshot);
  const keyRef = useRef(key);
  const chain = useRef(Promise.resolve());
  const [phase, setPhase] = useState<SavePhase>("idle");
  const [detail, setDetail] = useState("");

  function visible(snap: string) {
    return recordKey(snap) === (keyRef.current ?? "");
  }

  async function flush(snap: string, force: boolean) {
    if (!recordKey(snap)) return;
    if (!force && snap === applied.current) return;
    if (!force && snap !== latest.current && recordKey(snap) === recordKey(latest.current)) return;
    if (visible(snap)) setPhase("saving");
    try {
      await saveRef.current(snap);
      const same = recordKey(latest.current) === recordKey(snap);
      if (same && latest.current !== snap) {
        await flush(latest.current, false);
        return;
      }
      if (same) applied.current = snap;
      if (visible(snap)) {
        setPhase("saved");
        setDetail("");
      }
    } catch (err) {
      const same = recordKey(latest.current) === recordKey(snap);
      if (same && latest.current !== snap) {
        await flush(latest.current, false);
        return;
      }
      if (visible(snap)) {
        setPhase("error");
        setDetail(err instanceof Error ? err.message : "保存失败");
      }
    }
  }

  function enqueue(snap: string, force = false) {
    chain.current = chain.current.then(() => flush(snap, force));
  }

  useEffect(() => {
    if (keyRef.current !== key) {
      const leaving = seen.current;
      if (recordKey(leaving) && leaving !== applied.current) enqueue(leaving);
      keyRef.current = key;
      applied.current = snapshot;
      seen.current = snapshot;
      setPhase("idle");
      setDetail("");
      return;
    }
    seen.current = snapshot;
    if (!key || snapshot === applied.current) return;
    setPhase("editing");
    const timer = window.setTimeout(() => enqueue(snapshot), 450);
    return () => window.clearTimeout(timer);
  }, [key, snapshot]);

  return {
    phase,
    detail,
    retry: () => enqueue(latest.current, true),
  };
}
