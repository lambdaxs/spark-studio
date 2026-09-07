import type { CourseNode } from "./api";

type Box = { id: string; title: string; x: number; y: number };
type Edge = { x1: number; y1: number; x2: number; y2: number };

const W = 132;
const H = 28;
const DX = 156;
const DY = 42;

function layout(
  nodes: CourseNode[],
  depth: number,
  startY: number,
): { boxes: Box[]; edges: Edge[]; height: number } {
  let y = startY;
  const boxes: Box[] = [];
  const edges: Edge[] = [];
  for (const node of nodes) {
    if (node.children.length === 0) {
      boxes.push({ id: node.id, title: node.title, x: depth * DX, y });
      y += DY;
      continue;
    }
    const child = layout(node.children, depth + 1, y);
    const top = Math.min(...child.boxes.map((b) => b.y));
    const bot = Math.max(...child.boxes.map((b) => b.y));
    const ny = (top + bot) / 2;
    boxes.push({ id: node.id, title: node.title, x: depth * DX, y: ny });
    for (const c of node.children) {
      const cb = child.boxes.find((b) => b.id === c.id);
      if (cb) {
        edges.push({
          x1: depth * DX + W,
          y1: ny + H / 2,
          x2: cb.x,
          y2: cb.y + H / 2,
        });
      }
    }
    boxes.push(...child.boxes);
    edges.push(...child.edges);
    y += child.height;
  }
  return { boxes, edges, height: Math.max(DY, y - startY) };
}

export function CourseMindMap({ tree }: { tree: CourseNode[] }) {
  if (tree.length === 0) {
    return <div className="empty-col">大纲还是空的。对话里拆完再出树，或点「生成建议大纲」。</div>;
  }
  const { boxes, edges } = layout(tree, 0, 8);
  const width = Math.max(...boxes.map((b) => b.x), 0) + W + 16;
  const height = Math.max(...boxes.map((b) => b.y), 0) + H + 16;
  return (
    <svg className="mindmap" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {edges.map((e, i) => (
        <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2} stroke="#e6e2da" strokeWidth="1" />
      ))}
      {boxes.map((b) => (
        <g key={b.id}>
          <rect
            x={b.x}
            y={b.y}
            width={W}
            height={H}
            rx="6"
            fill="#fff"
            stroke="#e6e2da"
          />
          <text
            x={b.x + 8}
            y={b.y + 18}
            fontSize="11"
            fill="#1c1917"
          >
            {b.title.length > 10 ? `${b.title.slice(0, 10)}…` : b.title}
          </text>
        </g>
      ))}
    </svg>
  );
}
