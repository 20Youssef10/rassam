import type { Point } from "./types";

export type LaserStroke = {
  id: string;
  points: Point[];
  /** ms timestamp for fade */
  ts: number;
};

const FADE_MS = 1200;

export function createLaserStroke(id: string, start: Point): LaserStroke {
  return { id, points: [start], ts: Date.now() };
}

export function appendLaserPoint(stroke: LaserStroke, p: Point): LaserStroke {
  return { ...stroke, points: [...stroke.points, p], ts: Date.now() };
}

export function pruneLasers(strokes: LaserStroke[], now = Date.now()): LaserStroke[] {
  return strokes.filter((s) => now - s.ts < FADE_MS);
}

export function laserAlpha(stroke: LaserStroke, now = Date.now()): number {
  const age = now - stroke.ts;
  return Math.max(0, 1 - age / FADE_MS);
}
