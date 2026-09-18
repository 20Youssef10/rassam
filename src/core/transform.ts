import type { Bounds, Point, RassamElement } from "./types";
import { BIND_SNAP_DISTANCE } from "./types";
import { elementBounds } from "./geometry";

export function rotatePoint(
  p: Point,
  center: Point,
  angle: number,
): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const dx = p.x - center.x;
  const dy = p.y - center.y;
  return {
    x: center.x + dx * cos - dy * sin,
    y: center.y + dx * sin + dy * cos,
  };
}

export function elementCenter(el: RassamElement): Point {
  const b = elementBounds(el);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/** Axis-aligned bounds after rotation around element center. */
export function rotatedBounds(el: RassamElement): Bounds {
  const rot = el.rotation || 0;
  const b = elementBounds(el);
  if (!rot) {
    return b;
  }
  const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
  const corners: Point[] = [
    { x: b.x, y: b.y },
    { x: b.x + b.width, y: b.y },
    { x: b.x + b.width, y: b.y + b.height },
    { x: b.x, y: b.y + b.height },
  ].map((p) => rotatePoint(p, c, rot));
  const xs = corners.map((p) => p.x);
  const ys = corners.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return {
    x: minX,
    y: minY,
    width: Math.max(...xs) - minX,
    height: Math.max(...ys) - minY,
  };
}

export function setRotation(
  el: RassamElement,
  rotation: number,
): RassamElement {
  return { ...el, rotation: ((rotation % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) };
}

export function setLocked(el: RassamElement, locked: boolean): RassamElement {
  return { ...el, locked };
}

export function isLocked(el: RassamElement): boolean {
  return !!el.locked;
}

/** Expand selection to full groups. */
export function expandGroupSelection(
  elements: RassamElement[],
  ids: string[],
): string[] {
  const byId = new Map(elements.map((el) => [el.id, el]));
  const groups = new Set<string>();
  for (const id of ids) {
    const el = byId.get(id);
    el?.groupIds?.forEach((g) => groups.add(g));
  }
  if (!groups.size) {
    return ids;
  }
  const out = new Set(ids);
  for (const el of elements) {
    if (el.groupIds?.some((g) => groups.has(g))) {
      out.add(el.id);
    }
  }
  return [...out];
}

export function groupElements(
  elements: RassamElement[],
  selectedIds: string[],
  groupId: string,
): RassamElement[] {
  if (selectedIds.length < 2) {
    return elements;
  }
  const sel = new Set(selectedIds);
  return elements.map((el) => {
    if (!sel.has(el.id)) {
      return el;
    }
    const groupIds = [...(el.groupIds || []), groupId].filter(
      (v, i, a) => a.indexOf(v) === i,
    );
    return { ...el, groupIds };
  });
}

export function ungroupElements(
  elements: RassamElement[],
  selectedIds: string[],
): RassamElement[] {
  const sel = new Set(selectedIds);
  return elements.map((el) => {
    if (!sel.has(el.id) || !el.groupIds?.length) {
      return el;
    }
    return { ...el, groupIds: [] };
  });
}

export function findBindableShape(
  elements: RassamElement[],
  point: Point,
  excludeId?: string,
): RassamElement | null {
  let best: RassamElement | null = null;
  let bestDist = BIND_SNAP_DISTANCE;
  for (const el of elements) {
    if (el.id === excludeId) {
      continue;
    }
    if (
      el.type !== "rectangle" &&
      el.type !== "diamond" &&
      el.type !== "ellipse" &&
      el.type !== "image" &&
      el.type !== "sticky" &&
      el.type !== "frame"
    ) {
      continue;
    }
    if (el.locked) {
      continue;
    }
    const c = elementCenter(el);
    const d = Math.hypot(point.x - c.x, point.y - c.y);
    if (d < bestDist) {
      bestDist = d;
      best = el;
    }
  }
  return best;
}

/** Snap arrow endpoints to bound shape edges (center → border). */
export function rebindLinearPoints(
  elements: RassamElement[],
  linear: Extract<RassamElement, { type: "line" | "arrow" }>,
): Extract<RassamElement, { type: "line" | "arrow" }> {
  if (!linear.startBinding && !linear.endBinding) {
    return linear;
  }
  const byId = new Map(elements.map((el) => [el.id, el]));
  const pts = [...linear.points];
  if (!pts.length) {
    return linear;
  }

  const snapTo = (el: RassamElement, from: Point): Point => {
    const b = elementBounds(el);
    const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    const dx = from.x - c.x;
    const dy = from.y - c.y;
    if (dx === 0 && dy === 0) {
      return c;
    }
    // intersect center→from with AABB border
    const hw = Math.max(1, b.width / 2);
    const hh = Math.max(1, b.height / 2);
    const scaleX = hw / Math.abs(dx);
    const scaleY = hh / Math.abs(dy);
    const s = Math.min(scaleX, scaleY);
    return { x: c.x + dx * s, y: c.y + dy * s };
  };

  if (linear.startBinding) {
    const target = byId.get(linear.startBinding.elementId);
    if (target && pts.length >= 2) {
      pts[0] = snapTo(target, pts[1] ?? pts[0]);
    }
  }
  if (linear.endBinding) {
    const target = byId.get(linear.endBinding.elementId);
    if (target && pts.length >= 2) {
      pts[pts.length - 1] = snapTo(target, pts[pts.length - 2]);
    }
  }

  return { ...linear, points: pts, x: pts[0].x, y: pts[0].y };
}

/** After moving shapes, refresh arrows bound to them. */
export function refreshBindings(
  elements: RassamElement[],
  movedIds: Set<string>,
): RassamElement[] {
  if (!movedIds.size) {
    return elements;
  }
  return elements.map((el) => {
    if (el.type !== "arrow" && el.type !== "line") {
      return el;
    }
    const boundToMoved =
      (el.startBinding && movedIds.has(el.startBinding.elementId)) ||
      (el.endBinding && movedIds.has(el.endBinding.elementId));
    if (!boundToMoved) {
      return el;
    }
    return rebindLinearPoints(elements, el);
  });
}
