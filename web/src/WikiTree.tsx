import { useEffect, useRef, useState, type DragEvent } from "react";
import { HoverDelete } from "./HoverDelete";
import { IconChevron, IconPage } from "./Icons";
import type { WikiNode } from "./api";

const COLLAPSED_KEY = "wiki-tree-collapsed";

type Place = "before" | "inside" | "after";
type Drop = { id: string; place: Place } | { id: null; place: "root" };

function loadCollapsed() {
  try {
    const raw = JSON.parse(localStorage.getItem(COLLAPSED_KEY) ?? "[]");
    return new Set<string>(Array.isArray(raw) ? raw.map(String) : []);
  } catch {
    return new Set<string>();
  }
}

function findNode(nodes: WikiNode[], id: string): WikiNode | undefined {
  for (const n of nodes) {
    if (n.id === id) return n;
    const hit = findNode(n.children, id);
    if (hit) return hit;
  }
}

function containsId(node: WikiNode, id: string): boolean {
  return node.id === id || node.children.some((c) => containsId(c, id));
}

function destFromDrop(tree: WikiNode[], draggingId: string, drop: Drop) {
  if (drop.id == null) {
    return { parentId: null as string | null, index: tree.filter((n) => n.id !== draggingId).length };
  }
  const target = findNode(tree, drop.id);
  const dragging = findNode(tree, draggingId);
  if (!target || !dragging) return null;
  if (drop.place === "inside") {
    if (containsId(dragging, drop.id)) return null;
    return {
      parentId: target.id,
      index: target.children.filter((c) => c.id !== draggingId).length,
    };
  }
  const parentId = target.parentId;
  if (parentId && containsId(dragging, parentId)) return null;
  if (parentId === draggingId) return null;
  const siblings = (parentId ? findNode(tree, parentId)?.children : tree) ?? [];
  const visible = siblings.filter((c) => c.id !== draggingId);
  const at = visible.findIndex((c) => c.id === target.id);
  if (at < 0) return null;
  return { parentId, index: drop.place === "after" ? at + 1 : at };
}

function sameDest(
  a: { parentId: string | null; index: number },
  node: WikiNode,
  tree: WikiNode[],
) {
  const siblings = (node.parentId ? findNode(tree, node.parentId)?.children : tree) ?? [];
  const current = siblings.findIndex((c) => c.id === node.id);
  return a.parentId === node.parentId && a.index === current;
}

export function WikiTree({
  nodes,
  selectedId,
  expandId,
  forceOpen,
  onSelect,
  onDelete,
  onMove,
}: {
  nodes: WikiNode[];
  selectedId?: string;
  expandId?: string | null;
  forceOpen?: boolean;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onMove: (id: string, dest: { parentId: string | null; index: number }) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(loadCollapsed);
  const [draggingId, setDraggingId] = useState<string>();
  const [drop, setDrop] = useState<Drop>();
  const draggingRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...collapsed]));
  }, [collapsed]);

  useEffect(() => {
    if (!expandId) return;
    setCollapsed((prev) => {
      if (!prev.has(expandId)) return prev;
      const next = new Set(prev);
      next.delete(expandId);
      return next;
    });
  }, [expandId]);

  function toggle(id: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function placeFromEvent(e: DragEvent, hasKids: boolean): Place {
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = (e.clientY - rect.top) / Math.max(rect.height, 1);
    if (y < (hasKids ? 0.28 : 0.32)) return "before";
    if (y > (hasKids ? 0.72 : 0.68)) return "after";
    return "inside";
  }

  function renderNodes(list: WikiNode[], depth: number) {
    return list.map((n) => {
      const hasKids = n.children.length > 0;
      const open = hasKids && (forceOpen || !collapsed.has(n.id));
      const rowDrop = drop && drop.id === n.id ? drop.place : undefined;
      const invalid =
        draggingId &&
        drop &&
        drop.id === n.id &&
        !destFromDrop(nodes, draggingId, drop);

      return (
        <div key={n.id} className="wiki-block">
          <HoverDelete
            className={[
              "wiki-row",
              n.id === selectedId ? "active" : "",
              draggingId === n.id ? "dragging" : "",
              rowDrop && !invalid ? `drop-${rowDrop}` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            onDelete={() => onDelete(n.id)}
          >
            <div
              className="wiki-node"
              style={{ paddingLeft: 8 + depth * 16 }}
              draggable
              onClick={() => onSelect(n.id)}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", n.id);
                draggingRef.current = n.id;
                setDraggingId(n.id);
              }}
              onDragEnd={() => {
                draggingRef.current = undefined;
                setDraggingId(undefined);
                setDrop(undefined);
              }}
              onDragOver={(e) => {
                const src = draggingRef.current;
                if (!src || src === n.id) return;
                e.preventDefault();
                e.stopPropagation();
                e.dataTransfer.dropEffect = "move";
                const place = placeFromEvent(e, hasKids);
                setDrop((prev) =>
                  prev?.id === n.id && prev.place === place ? prev : { id: n.id, place },
                );
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const id = draggingRef.current ?? e.dataTransfer.getData("text/plain");
                const hint = { id: n.id, place: placeFromEvent(e, hasKids) };
                const next = id ? destFromDrop(nodes, id, hint) : null;
                const src = id ? findNode(nodes, id) : undefined;
                draggingRef.current = undefined;
                setDraggingId(undefined);
                setDrop(undefined);
                if (!id || !next || !src || sameDest(next, src, nodes)) return;
                if (next.parentId) {
                  setCollapsed((prev) => {
                    if (!prev.has(next.parentId!)) return prev;
                    const copy = new Set(prev);
                    copy.delete(next.parentId!);
                    return copy;
                  });
                }
                onMove(id, next);
              }}
            >
              {hasKids ? (
                <button
                  type="button"
                  className="wiki-twist"
                  aria-label={open ? "折叠" : "展开"}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(n.id);
                  }}
                >
                  <IconChevron open={open} />
                </button>
              ) : (
                <span className="wiki-leaf">
                  <IconPage />
                </span>
              )}
              <span className="wiki-title">{n.title}</span>
            </div>
          </HoverDelete>
          {open ? renderNodes(n.children, depth + 1) : null}
        </div>
      );
    });
  }

  return (
    <div
      className={`wiki-tree${drop?.id == null && drop?.place === "root" ? " drop-root" : ""}`}
      onDragOver={(e) => {
        if (!draggingRef.current) return;
        if ((e.target as HTMLElement).closest(".wiki-node")) return;
        e.preventDefault();
        setDrop({ id: null, place: "root" });
      }}
      onDrop={(e) => {
        e.preventDefault();
        const id = draggingRef.current ?? e.dataTransfer.getData("text/plain");
        const next = id ? destFromDrop(nodes, id, { id: null, place: "root" }) : null;
        const src = id ? findNode(nodes, id) : undefined;
        draggingRef.current = undefined;
        setDraggingId(undefined);
        setDrop(undefined);
        if (!id || !next || !src || sameDest(next, src, nodes)) return;
        onMove(id, next);
      }}
    >
      {nodes.length === 0 ? <div className="empty-col">还没有 Wiki 页。</div> : renderNodes(nodes, 0)}
    </div>
  );
}
