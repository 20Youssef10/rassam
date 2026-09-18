import type { RassamElement } from "./types";
import { createId, randomSeed } from "./ids";

type MNode = {
  id: string;
  label: string;
  shape: "rect" | "diamond" | "round";
  col: number;
  row: number;
};

type MEdge = {
  from: string;
  to: string;
  label?: string;
};

/**
 * Minimal Mermaid flowchart parser (flowchart/graph LR|TD|TB|RL).
 * Supports: A[label], A(label), A{label}, edges A --> B, A --|text|--> B
 */
export function parseMermaidFlowchart(source: string): {
  nodes: MNode[];
  edges: MEdge[];
  direction: "LR" | "TD";
} {
  const nodes = new Map<string, MNode>();
  const edges: MEdge[] = [];
  let direction: "LR" | "TD" = "TD";

  const lines = source
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("%%"));

  for (const line of lines) {
    const dirMatch = line.match(/^(flowchart|graph)\s+(LR|RL|TD|TB|BT)/i);
    if (dirMatch) {
      const d = dirMatch[2].toUpperCase();
      direction = d === "LR" || d === "RL" ? "LR" : "TD";
      continue;
    }

    // edge with optional label: A[label] -->|yes| B{q}
    const parts = line.split(/-->(?:\|([^|]+)\|)?|---/);
    if (parts.length < 2) {
      continue;
    }

    const tokens = line
      .split(/(-->\|[^|]*\||-->|---)/)
      .map((t) => t.trim())
      .filter(Boolean);

    for (let i = 0; i < tokens.length; i += 2) {
      const nodeTok = tokens[i];
      const m = nodeTok.match(
        /^([A-Za-z0-9_]+)\s*(?:([\[\(\{])([^\]\)\}]*)([\]\)\}]))?$/,
      );
      if (!m) {
        continue;
      }
      const id = m[1];
      const open = m[2];
      const label = m[3] || id;
      const shape: MNode["shape"] =
        open === "{" ? "diamond" : open === "(" ? "round" : "rect";
      if (!nodes.has(id)) {
        nodes.set(id, { id, label, shape, col: 0, row: 0 });
      } else {
        const n = nodes.get(id)!;
        n.label = label || n.label;
        if (open) {
          n.shape = shape;
        }
      }

      if (i + 1 < tokens.length) {
        const arrow = tokens[i + 1];
        const edgeLabel = arrow.match(/-->\|([^|]+)\|/)?.[1];
        const nextTok = tokens[i + 2];
        const nMatch = nextTok?.match(
          /^([A-Za-z0-9_]+)\s*(?:([\[\(\{])([^\]\)\}]*)([\]\)\}]))?$/,
        );
        if (nMatch) {
          const toId = nMatch[1];
          if (!nodes.has(toId)) {
            nodes.set(toId, {
              id: toId,
              label: nMatch[3] || toId,
              shape: nMatch[2] === "{" ? "diamond" : nMatch[2] === "(" ? "round" : "rect",
              col: 0,
              row: 0,
            });
          }
          edges.push({ from: id, to: toId, label: edgeLabel });
        }
      }
    }
  }

  // layout grid
  const list = [...nodes.values()];
  const pos = new Map<string, { col: number; row: number }>();
  list.forEach((n, i) => {
    if (direction === "LR") {
      pos.set(n.id, { col: i % 4, row: Math.floor(i / 4) });
    } else {
      pos.set(n.id, { col: Math.floor(i / 4), row: i % 4 });
    }
  });
  // simple pass: parents before children in edge order
  for (const e of edges) {
    const a = pos.get(e.from);
    const b = pos.get(e.to);
    if (!a || !b) {
      continue;
    }
    if (direction === "LR" && b.col <= a.col) {
      b.col = a.col + 1;
    }
    if (direction !== "LR" && b.row <= a.row) {
      b.row = a.row + 1;
    }
  }

  return {
    nodes: list.map((n) => ({ ...n, ...(pos.get(n.id) || { col: 0, row: 0 }) })),
    edges,
    direction,
  };
}

export function mermaidToElements(
  source: string,
  origin = { x: 0, y: 0 },
): RassamElement[] {
  const { nodes, edges, direction } = parseMermaidFlowchart(source);
  const cellW = direction === "LR" ? 200 : 160;
  const cellH = direction === "LR" ? 140 : 120;
  const shapeW = 140;
  const shapeH = 70;
  const elements: RassamElement[] = [];
  const centers = new Map<string, { x: number; y: number }>();

  for (const n of nodes) {
    const x = origin.x + n.col * cellW;
    const y = origin.y + n.row * cellH;
    const cx = x + shapeW / 2;
    const cy = y + shapeH / 2;
    centers.set(n.id, { x: cx, y: cy });
    const fill = n.shape === "diamond" ? "#FEF3C7" : n.shape === "round" ? "#CCFBF1" : "#DBEAFE";
    const stroke = n.shape === "diamond" ? "#D97706" : n.shape === "round" ? "#0D9488" : "#2563EB";
    const type = n.shape === "diamond" ? "diamond" : "rectangle";
    const shape: RassamElement = {
      id: createId(),
      type,
      x,
      y,
      width: shapeW,
      height: shapeH,
      fill,
      stroke,
      strokeWidth: 2,
      opacity: 1,
      seed: randomSeed(),
      label: n.label,
    } as RassamElement;
    elements.push(shape);
  }

  for (const e of edges) {
    const a = centers.get(e.from);
    const b = centers.get(e.to);
    if (!a || !b) {
      continue;
    }
    const arrow: RassamElement = {
      id: createId(),
      type: "arrow",
      x: a.x,
      y: a.y,
      points: [a, b],
      fill: "transparent",
      stroke: "#0F172A",
      strokeWidth: 2,
      opacity: 1,
      seed: randomSeed(),
      elbow: true,
      label: e.label,
    } as RassamElement;
    elements.push(arrow);
  }

  return elements;
}

export const MERMAID_SAMPLE = `flowchart TD
  A[بداية] --> B{هل جاهز؟}
  B -->|نعم| C[ابدأ الرسم]
  B -->|لا| D[راجع الخطة]
  C --> E[نهاية]`;
