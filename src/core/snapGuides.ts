import type { Bounds, Point, RassamElement } from "./types";
import { elementBounds } from "./geometry";

export type SnapGuide = {
  kind: "v" | "h";
  pos: number;
  from: number;
  to: number;
};

export type SnapResult = {
  x: number;
  y: number;
  guides: SnapGuide[];
};

const THRESHOLD = 8;

export function snapToObjects(
  moving: RassamElement,
  others: RassamElement[],
  proposed: Point,
): SnapResult {
  const guides: SnapGuide[] = [];
  let x = proposed.x;
  let y = proposed.y;

  const mb = elementBounds(moving);
  const mw = mb.width;
  const mh = mb.height;
  const targetsX: number[] = [];
  const targetsY: number[] = [];

  for (const el of others) {
    if (el.id === moving.id || el.locked) {
      continue;
    }
    const b = elementBounds(el);
    targetsX.push(b.x, b.x + b.width / 2, b.x + b.width);
    targetsY.push(b.y, b.y + b.height / 2, b.y + b.height);
  }
  if (!targetsX.length) {
    return { x, y, guides };
  }

  const edgesX = [
    { val: proposed.x, type: "left" as const },
    { val: proposed.x + mw / 2, type: "center" as const },
    { val: proposed.x + mw, type: "right" as const },
  ];
  const edgesY = [
    { val: proposed.y, type: "top" as const },
    { val: proposed.y + mh / 2, type: "center" as const },
    { val: proposed.y + mh, type: "bottom" as const },
  ];

  let bestX: { delta: number; target: number; type: string } | null = null;
  for (const edge of edgesX) {
    for (const t of targetsX) {
      const delta = t - edge.val;
      if (Math.abs(delta) <= THRESHOLD && (!bestX || Math.abs(delta) < Math.abs(bestX.delta))) {
        bestX = { delta, target: t, type: edge.type };
      }
    }
  }
  let bestY: { delta: number; target: number; type: string } | null = null;
  for (const edge of edgesY) {
    for (const t of targetsY) {
      const delta = t - edge.val;
      if (Math.abs(delta) <= THRESHOLD && (!bestY || Math.abs(delta) < Math.abs(bestY.delta))) {
        bestY = { delta, target: t, type: edge.type };
      }
    }
  }

  if (bestX) {
    x = proposed.x + bestX.delta;
    guides.push({
      kind: "v",
      pos: bestX.target,
      from: Math.min(y, y + mh) - 40,
      to: Math.max(y, y + mh) + 40,
    });
  }
  if (bestY) {
    y = proposed.y + bestY.delta;
    guides.push({
      kind: "h",
      pos: bestY.target,
      from: Math.min(x, x + mw) - 40,
      to: Math.max(x, x + mw) + 40,
    });
  }

  return { x, y, guides };
}

export function drawSnapGuides(
  ctx: CanvasRenderingContext2D,
  guides: SnapGuide[],
  zoom: number,
): void {
  if (!guides.length) {
    return;
  }
  ctx.save();
  ctx.strokeStyle = "#F43F5E";
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 3 / zoom]);
  for (const g of guides) {
    ctx.beginPath();
    if (g.kind === "v") {
      ctx.moveTo(g.pos, g.from);
      ctx.lineTo(g.pos, g.to);
    } else {
      ctx.moveTo(g.from, g.pos);
      ctx.lineTo(g.to, g.pos);
    }
    ctx.stroke();
  }
  ctx.restore();
}

export function boundsOfAll(els: RassamElement[]): Bounds | null {
  if (!els.length) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of els) {
    const b = elementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
