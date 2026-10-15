import type { CourseNode } from "./api";

type Box = { id: string; label: string; x: number; y: number; w: number; depth: number };
type Edge = { x1: number; y1: number; x2: number; y2: number };

const H = 30;
const DY = 42;
const GAP = 36;
const COL = 136;
const MAX_CHARS = 10;

function label(title: string) {
  return title.length > MAX_CHARS ? `${title.slice(0, MAX_CHARS)}…` : title;
}

function textWidth(text: string, size: number) {
  let w = 0;
  for (const ch of text) w += ch.charCodeAt(0) > 255 ? size : size * 0.58;
  return w;
}

function nodeWidth(text: string, depth: number) {
  return Math.min(COL, Math.max(64, textWidth(text, depth <= 1 ? 13 : 12) + 28));
}

function layoutSide(nodes: CourseNode[], dir: 1 | -1) {
  const boxes: Box[] = [];
  const edges: Edge[] = [];
  let cursor = 0;

  function place(node: CourseNode, depth: number): Box {
    const text = label(node.title);
    const w = nodeWidth(text, depth);
    const inner = (depth - 1) * (COL + GAP);
    let y: number;
    const kids = node.children.map((c) => place(c, depth + 1));
    if (kids.length === 0) {
      y = cursor;
      cursor += DY;
    } else {
      y = (kids[0].y + kids[kids.length - 1].y) / 2;
    }
    const box: Box = { id: node.id, label: text, x: dir === 1 ? inner : -inner - w, y, w, depth };
    for (const k of kids) {
      edges.push({
        x1: dir === 1 ? box.x + box.w : box.x,
        y1: y + H / 2,
        x2: dir === 1 ? k.x : k.x + k.w,
        y2: k.y + H / 2,
      });
    }
    boxes.push(box);
    return box;
  }

  const tops = nodes.map((n) => place(n, 1));
  return { boxes, edges, tops, height: Math.max(cursor - (DY - H), H) };
}

function curve(e: Edge) {
  const mx = (e.x1 + e.x2) / 2;
  return `M${e.x1},${e.y1} C${mx},${e.y1} ${mx},${e.y2} ${e.x2},${e.y2}`;
}

export function CourseMindMap({ title, tree }: { title: string; tree: CourseNode[] }) {
  if (tree.length === 0) {
    return <div className="empty-col">大纲还是空的。</div>;
  }
  const splitAt = tree.length === 1 ? 1 : Math.ceil(tree.length / 2);
  const right = layoutSide(tree.slice(0, splitAt), 1);
  const left = layoutSide(tree.slice(splitAt), -1);

  const rootLabel = label(title || "课程");
  const rootW = Math.max(96, textWidth(rootLabel, 15) + 36);
  const rootH = 40;
  const height = Math.max(right.height, left.height, rootH) + 24;
  const midY = height / 2;

  const shift = (side: ReturnType<typeof layoutSide>) => midY - side.height / 2;
  const rShift = shift(right);
  const lShift = shift(left);
  const rx = rootW / 2 + GAP;

  const all: Box[] = [
    ...right.boxes.map((b) => ({ ...b, x: b.x + rx, y: b.y + rShift })),
    ...left.boxes.map((b) => ({ ...b, x: b.x - rx, y: b.y + lShift })),
  ];
  const edges: Edge[] = [
    ...right.edges.map((e) => ({ x1: e.x1 + rx, y1: e.y1 + rShift, x2: e.x2 + rx, y2: e.y2 + rShift })),
    ...left.edges.map((e) => ({ x1: e.x1 - rx, y1: e.y1 + lShift, x2: e.x2 - rx, y2: e.y2 + lShift })),
    ...right.tops.map((t) => ({ x1: rootW / 2, y1: midY, x2: t.x + rx, y2: t.y + rShift + H / 2 })),
    ...left.tops.map((t) => ({ x1: -rootW / 2, y1: midY, x2: t.x + t.w - rx, y2: t.y + lShift + H / 2 })),
  ];

  const minX = Math.min(-rootW / 2, ...all.map((b) => b.x)) - 8;
  const maxX = Math.max(rootW / 2, ...all.map((b) => b.x + b.w)) + 8;
  const width = maxX - minX;

  return (
    <svg
      className="mindmap"
      width={width}
      height={height}
      viewBox={`${minX} 0 ${width} ${height}`}
      role="img"
      aria-label={`${title} 思维导图`}
    >
      {edges.map((e, i) => (
        <path key={i} d={curve(e)} fill="none" stroke="#bfd3f2" strokeWidth="1.4" />
      ))}
      <rect x={-rootW / 2} y={midY - rootH / 2} width={rootW} height={rootH} rx="10" fill="#2563eb" />
      <text x={0} y={midY + 5} fontSize="15" fontWeight="600" fill="#fff" textAnchor="middle">
        {rootLabel}
      </text>
      {all.map((b) => (
        <g key={b.id}>
          <rect
            x={b.x}
            y={b.y}
            width={b.w}
            height={H}
            rx="8"
            fill={b.depth === 1 ? "#eff6ff" : "#fff"}
            stroke={b.depth === 1 ? "#bfdbfe" : "#dbe3ef"}
          />
          <text
            x={b.x + b.w / 2}
            y={b.y + 19}
            fontSize={b.depth === 1 ? 13 : 12}
            fill={b.depth === 1 ? "#1e3a8a" : "#1c1917"}
            textAnchor="middle"
          >
            {b.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
