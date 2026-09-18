import type { RassamElement } from "./types";
import { createId, randomSeed } from "./ids";
import { ARABIC_FONT } from "./types";

function shape(
  type: RassamElement["type"],
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  stroke = "#2563EB",
  fill = "#DBEAFE",
): RassamElement {
  return {
    id: createId(),
    type,
    x,
    y,
    width: w,
    height: h,
    fill,
    stroke,
    strokeWidth: 2,
    opacity: 1,
    seed: randomSeed(),
    label,
  } as RassamElement;
}

function textEl(x: number, y: number, text: string, size = 14): RassamElement {
  return {
    id: createId(),
    type: "text",
    x,
    y,
    text,
    fontSize: size,
    fontFamily: ARABIC_FONT,
    width: Math.max(40, text.length * 8),
    height: size * 1.4,
    fill: "transparent",
    stroke: "#0F172A",
    strokeWidth: 1,
    opacity: 1,
    seed: randomSeed(),
  } as RassamElement;
}

function arrow(x1: number, y1: number, x2: number, y2: number, label?: string): RassamElement {
  return {
    id: createId(),
    type: "arrow",
    x: x1,
    y: y1,
    points: [
      { x: x1, y: y1 },
      { x: x2, y: y2 },
    ],
    fill: "transparent",
    stroke: "#0F172A",
    strokeWidth: 2,
    opacity: 1,
    seed: randomSeed(),
    elbow: true,
    label,
  } as RassamElement;
}

/** sequenceDiagram participant A ->> B: message */
export function parseMermaidSequence(source: string, origin = { x: 0, y: 0 }): RassamElement[] {
  const lines = source.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const actors: string[] = [];
  const msgs: { from: string; to: string; text: string }[] = [];
  for (const line of lines) {
    if (/^(sequenceDiagram|sequencegraph)/i.test(line)) {
      continue;
    }
    const part = line.match(/^participant\s+([A-Za-z0-9_\u0600-\u06FF]+)(?:\s+as\s+(.+))?$/i);
    if (part) {
      actors.push(part[2] || part[1]);
      continue;
    }
    const m = line.match(
      /^([A-Za-z0-9_\u0600-\u06FF]+)\s*(->>|-->|->)\s*([A-Za-z0-9_\u0600-\u06FF]+)\s*:\s*(.+)$/,
    );
    if (m) {
      msgs.push({ from: m[1], to: m[3], text: m[4].trim() });
      if (!actors.includes(m[1])) actors.push(m[1]);
      if (!actors.includes(m[3])) actors.push(m[3]);
    }
  }
  if (!actors.length) {
    return [];
  }
  const els: RassamElement[] = [];
  const colW = 180;
  const actorsY = origin.y;
  const positions = new Map<string, { x: number; y: number }>();
  actors.forEach((a, i) => {
    const x = origin.x + i * colW;
    positions.set(a, { x: x + 50, y: actorsY });
    els.push(shape("rectangle", x, actorsY, 100, 48, a, "#0D9488", "#CCFBF1"));
  });
  // lifelines
  msgs.forEach((msg, i) => {
    const y = actorsY + 80 + i * 70;
    const a = positions.get(msg.from);
    const b = positions.get(msg.to);
    if (!a || !b) {
      return;
    }
    els.push(arrow(a.x, y, b.x, y, msg.text));
    els.push(textEl((a.x + b.x) / 2 - 20, y - 22, msg.text, 13));
  });
  return els;
}

/** classDiagram class Foo { +bar() } */
export function parseMermaidClass(source: string, origin = { x: 0, y: 0 }): RassamElement[] {
  const lines = source.split(/\r?\n/).map((l) => l.trim());
  const classes: { name: string; members: string[] }[] = [];
  let current: { name: string; members: string[] } | null = null;
  for (const line of lines) {
    if (/^classDiagram/i.test(line)) {
      continue;
    }
    const open = line.match(/^class\s+([A-Za-z0-9_\u0600-\u06FF]+)\s*\{/);
    if (open) {
      current = { name: open[1], members: [] };
      classes.push(current);
      continue;
    }
    if (line.startsWith("}") && current) {
      current = null;
      continue;
    }
    if (current && line && !line.startsWith("class")) {
      current.members.push(line.replace(/[:|]$/, ""));
    }
  }
  const els: RassamElement[] = [];
  classes.forEach((c, i) => {
    const x = origin.x + (i % 3) * 220;
    const y = origin.y + Math.floor(i / 3) * 200;
    const h = 48 + c.members.length * 22;
    els.push(shape("rectangle", x, y, 200, h, c.name, "#2563EB", "#FFFFFF"));
    els.push(textEl(x + 12, y + 36, c.name, 16));
    c.members.forEach((m, mi) => {
      els.push(textEl(x + 12, y + 60 + mi * 20, m, 13));
    });
  });
  return els;
}

/** stateDiagram [*] --> Idle; Idle --> Active: run */
export function parseMermaidState(source: string, origin = { x: 0, y: 0 }): RassamElement[] {
  const lines = source.split(/\r?\n/).map((l) => l.trim());
  const nodes = new Set<string>();
  const edges: { from: string; to: string; label?: string }[] = [];
  for (const line of lines) {
    if (/^stateDiagram/i.test(line)) {
      continue;
    }
    const m = line.match(
      /^(?:\[\*\]|([A-Za-z0-9_\u0600-\u06FF]+))\s*-->\s*(?:\[\*\]|([A-Za-z0-9_\u0600-\u06FF]+))\s*(?::\s*(.+))?$/,
    );
    if (m) {
      const from = m[1] || "start";
      const to = m[2] || "end";
      nodes.add(from);
      nodes.add(to);
      edges.push({ from, to, label: m[3] });
    }
  }
  const els: RassamElement[] = [];
  const list = [...nodes];
  const positions = new Map<string, { x: number; y: number }>();
  list.forEach((n, i) => {
    const x = origin.x + (i % 4) * 160;
    const y = origin.y + Math.floor(i / 4) * 120;
    positions.set(n, { x: x + 70, y: y + 35 });
    els.push(shape("ellipse", x, y, 140, 70, n, "#D97706", "#FEF3C7"));
  });
  for (const e of edges) {
    const a = positions.get(e.from);
    const b = positions.get(e.to);
    if (a && b) {
      els.push(arrow(a.x, a.y, b.x, b.y, e.label));
    }
  }
  return els;
}

export function detectMermaidKind(source: string): "sequence" | "class" | "state" | "flow" | "unknown" {
  if (/sequenceDiagram/i.test(source)) {
    return "sequence";
  }
  if (/classDiagram/i.test(source)) {
    return "class";
  }
  if (/stateDiagram/i.test(source)) {
    return "state";
  }
  if (/^(flowchart|graph)\s/i.test(source.trim())) {
    return "flow";
  }
  return "unknown";
}

export function parseMermaidAny(source: string, origin = { x: 0, y: 0 }): RassamElement[] | null {
  const kind = detectMermaidKind(source);
  if (kind === "sequence") {
    const els = parseMermaidSequence(source, origin);
    return els.length ? els : null;
  }
  if (kind === "class") {
    const els = parseMermaidClass(source, origin);
    return els.length ? els : null;
  }
  if (kind === "state") {
    const els = parseMermaidState(source, origin);
    return els.length ? els : null;
  }
  return null;
}
