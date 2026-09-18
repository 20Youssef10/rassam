import type { Bounds, Point, RassamElement, ResizeHandle } from "./types";
import { HANDLE_SIZE, MIN_ELEMENT_SIZE } from "./types";

export function selectionBounds(
  elements: RassamElement[],
): Bounds | null {
  if (!elements.length) {
    return null;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    const b = elementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

export function clientToScene(
  client: Point,
  viewport: { scrollX: number; scrollY: number; zoom: number },
  canvasOrigin: { left: number; top: number },
): Point {
  return {
    x: (client.x - canvasOrigin.left) / viewport.zoom + viewport.scrollX,
    y: (client.y - canvasOrigin.top) / viewport.zoom + viewport.scrollY,
  };
}

export function normalizeRect(a: Point, b: Point) {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

export function elementBounds(el: RassamElement): Bounds {
  if (
    el.type === "rectangle" ||
    el.type === "diamond" ||
    el.type === "ellipse" ||
    el.type === "text" ||
    el.type === "image" ||
    el.type === "sticky" ||
    el.type === "frame" ||
    el.type === "comment"
  ) {
    return { x: el.x, y: el.y, width: el.width, height: el.height };
  }
  if (el.type === "draw" || el.type === "line" || el.type === "arrow") {
    const pts = el.points;
    if (!pts.length) {
      return { x: el.x, y: el.y, width: 0, height: 0 };
    }
    let minX = pts[0].x;
    let minY = pts[0].y;
    let maxX = pts[0].x;
    let maxY = pts[0].y;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  }
  return { x: el.x, y: el.y, width: 0, height: 0 };
}

export function handlePositions(b: Bounds): Record<ResizeHandle, Point> {
  return {
    nw: { x: b.x, y: b.y },
    n: { x: b.x + b.width / 2, y: b.y },
    ne: { x: b.x + b.width, y: b.y },
    e: { x: b.x + b.width, y: b.y + b.height / 2 },
    se: { x: b.x + b.width, y: b.y + b.height },
    s: { x: b.x + b.width / 2, y: b.y + b.height },
    sw: { x: b.x, y: b.y + b.height },
    w: { x: b.x, y: b.y + b.height / 2 },
  };
}

export function hitResizeHandle(
  p: Point,
  b: Bounds,
  zoom: number,
): ResizeHandle | null {
  const positions = handlePositions(b);
  const threshold = (HANDLE_SIZE + 4) / zoom;
  let best: ResizeHandle | null = null;
  let bestDist = threshold;
  (Object.keys(positions) as ResizeHandle[]).forEach((key) => {
    const hp = positions[key];
    const d = Math.hypot(p.x - hp.x, p.y - hp.y);
    if (d <= bestDist) {
      bestDist = d;
      best = key;
    }
  });
  return best;
}

export function handleCursor(handle: ResizeHandle): string {
  switch (handle) {
    case "n":
    case "s":
      return "ns-resize";
    case "e":
    case "w":
      return "ew-resize";
    case "ne":
    case "sw":
      return "nesw-resize";
    case "nw":
    case "se":
      return "nwse-resize";
    default:
      return "default";
  }
}

function boundsAfterResize(origin: Bounds, handle: ResizeHandle, pointer: Point): Bounds {
  const right = origin.x + origin.width;
  const bottom = origin.y + origin.height;
  let left = origin.x;
  let top = origin.y;
  let newRight = right;
  let newBottom = bottom;

  if (handle.includes("w")) {
    left = Math.min(pointer.x, right - MIN_ELEMENT_SIZE);
  }
  if (handle.includes("e")) {
    newRight = Math.max(pointer.x, left + MIN_ELEMENT_SIZE);
  }
  if (handle.includes("n")) {
    top = Math.min(pointer.y, bottom - MIN_ELEMENT_SIZE);
  }
  if (handle.includes("s")) {
    newBottom = Math.max(pointer.y, top + MIN_ELEMENT_SIZE);
  }

  return { x: left, y: top, width: newRight - left, height: newBottom - top };
}

export function resizeElement(
  origin: RassamElement,
  originBounds: Bounds,
  handle: ResizeHandle,
  pointer: Point,
): RassamElement {
  const next = boundsAfterResize(originBounds, handle, pointer);
  const sx = originBounds.width > 0 ? next.width / originBounds.width : 1;
  const sy = originBounds.height > 0 ? next.height / originBounds.height : 1;

  if (
    origin.type === "rectangle" ||
    origin.type === "diamond" ||
    origin.type === "ellipse" ||
    origin.type === "image" ||
    origin.type === "sticky" ||
    origin.type === "frame"
  ) {
    return { ...origin, x: next.x, y: next.y, width: next.width, height: next.height };
  }

  if (origin.type === "text") {
    const fontSize = Math.max(10, Math.round(origin.fontSize * Math.max(sx, sy)));
    return {
      ...origin,
      x: next.x,
      y: next.y,
      width: next.width,
      height: Math.max(fontSize * 1.35, next.height),
      fontSize,
    };
  }

  if (origin.type === "draw" || origin.type === "line" || origin.type === "arrow") {
    const ox = originBounds.x;
    const oy = originBounds.y;
    return {
      ...origin,
      x: next.x,
      y: next.y,
      points: origin.points.map((p) => ({
        x: next.x + (p.x - ox) * sx,
        y: next.y + (p.y - oy) * sy,
      })),
    };
  }

  return origin;
}

export function pointInBounds(p: Point, b: Bounds, pad = 0): boolean {
  return (
    p.x >= b.x - pad &&
    p.x <= b.x + b.width + pad &&
    p.y >= b.y - pad &&
    p.y <= b.y + b.height + pad
  );
}

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len2 = dx * dx + dy * dy;
  if (len2 === 0) {
    return Math.hypot(p.x - a.x, p.y - a.y);
  }
  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
}

export function hitTestElement(el: RassamElement, p: Point, pad = 6): boolean {
  if (el.type === "text" || el.type === "image") {
    return pointInBounds(p, elementBounds(el), pad);
  }
  if (el.type === "draw" || el.type === "line" || el.type === "arrow") {
    const pts = el.points;
    if (pts.length < 2) {
      return pointInBounds(p, elementBounds(el), pad);
    }
    for (let i = 0; i < pts.length - 1; i++) {
      if (distToSegment(p, pts[i], pts[i + 1]) <= pad + el.strokeWidth) {
        return true;
      }
    }
    return false;
  }
  const b = elementBounds(el);
  if (!pointInBounds(p, b, pad)) {
    return false;
  }
  if (el.fill === "transparent" || el.fill === "none") {
    const inset = 8 + el.strokeWidth;
    const inner = {
      x: b.x + inset,
      y: b.y + inset,
      width: Math.max(0, b.width - inset * 2),
      height: Math.max(0, b.height - inset * 2),
    };
    return !pointInBounds(p, inner, 0);
  }
  return true;
}

export function hitTestElements(
  elements: RassamElement[],
  p: Point,
  pad = 6,
): RassamElement | null {
  for (let i = elements.length - 1; i >= 0; i--) {
    const el = elements[i];
    if (el.locked) {
      continue;
    }
    if (hitTestElement(el, p, pad)) {
      return el;
    }
  }
  return null;
}

export function translateElement(
  el: RassamElement,
  dx: number,
  dy: number,
): RassamElement {
  if (el.type === "draw" || el.type === "line" || el.type === "arrow") {
    return {
      ...el,
      x: el.x + dx,
      y: el.y + dy,
      points: el.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy })),
    };
  }
  return { ...el, x: el.x + dx, y: el.y + dy };
}

export function clampZoom(zoom: number, min = 0.2, max = 4): number {
  return Math.min(max, Math.max(min, zoom));
}

export function cloneElements(elements: RassamElement[]): RassamElement[] {
  return elements.map((el) => {
    if (el.type === "draw" || el.type === "line" || el.type === "arrow") {
      return { ...el, points: el.points.map((p) => ({ ...p })) };
    }
    return { ...el };
  });
}
