import type { Bounds, Point, RassamElement } from "./types";
import { ELBOW_GAP } from "./types";
import { elementBounds } from "./geometry";
import { elementCenter } from "./transform";

/** Orthogonal (elbow) polyline from → to with optional mid routing. */
export function elbowPoints(from: Point, to: Point, gap = ELBOW_GAP): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const pad = Math.max(4, gap * 0.25);
  if (Math.abs(dx) < 1 || Math.abs(dy) < 1) {
    return [from, to];
  }
  // Prefer horizontal-then-vertical or vertical-then-horizontal by larger delta
  if (Math.abs(dx) >= Math.abs(dy)) {
    const midX = from.x + dx / 2 + (dx > 0 ? 0 : 0);
    void pad;
    return [
      from,
      { x: midX, y: from.y },
      { x: midX, y: to.y },
      to,
    ];
  }
  const midY = from.y + dy / 2;
  return [
    from,
    { x: from.x, y: midY },
    { x: to.x, y: midY },
    to,
  ];
}

/** Snap elbow endpoints to shape borders when bound. */
export function elbowBetweenShapes(
  fromEl: RassamElement | null,
  toEl: RassamElement | null,
  fallbackFrom: Point,
  fallbackTo: Point,
): Point[] {
  const from = fromEl ? borderPoint(fromEl, fallbackFrom) : fallbackFrom;
  const to = toEl ? borderPoint(toEl, fallbackTo) : fallbackTo;
  return elbowPoints(from, to);
}

function borderPoint(el: RassamElement, toward: Point): Point {
  const b = elementBounds(el);
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const dx = toward.x - c.x;
  const dy = toward.y - c.y;
  if (dx === 0 && dy === 0) {
    return c;
  }
  const hw = Math.max(1, b.width / 2);
  const hh = Math.max(1, b.height / 2);
  const s = Math.min(hw / Math.abs(dx || 1e-6), hh / Math.abs(dy || 1e-6));
  return { x: c.x + dx * s, y: c.y + dy * s };
}

export function isElbow(
  el: RassamElement,
): el is Extract<RassamElement, { type: "line" | "arrow" }> {
  return (
    (el.type === "arrow" || el.type === "line") && el.elbow === true
  );
}

export function boundsCenter(b: Bounds): Point {
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

export { elementCenter };
