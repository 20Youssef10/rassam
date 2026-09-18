import type { Point } from "./types";

/** Chaikin-style smoothing for freehand strokes. */
export function smoothPoints(points: Point[], iterations = 2): Point[] {
  if (points.length < 3) {
    return points;
  }
  let pts = points;
  for (let iter = 0; iter < iterations; iter++) {
    const next: Point[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = pts[i];
      const p1 = pts[i + 1];
      next.push({
        x: p0.x * 0.75 + p1.x * 0.25,
        y: p0.y * 0.75 + p1.y * 0.25,
      });
      next.push({
        x: p0.x * 0.25 + p1.x * 0.75,
        y: p0.y * 0.25 + p1.y * 0.75,
      });
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

/** Drop near-duplicate points to shrink freehand payloads. */
export function simplifyPoints(points: Point[], minDist = 1.5): Point[] {
  if (points.length < 2) {
    return points;
  }
  const out = [points[0]];
  for (let i = 1; i < points.length; i++) {
    const last = out[out.length - 1];
    if (Math.hypot(points[i].x - last.x, points[i].y - last.y) >= minDist) {
      out.push(points[i]);
    }
  }
  return out;
}

export function finalizeFreehand(points: Point[]): Point[] {
  return smoothPoints(simplifyPoints(points), 1);
}
