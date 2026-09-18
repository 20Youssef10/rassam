import type { RassamElement, Viewport } from "./types";
import { elementBounds } from "./geometry";

export type SceneStats = {
  count: number;
  selected: number;
  bounds: { x: number; y: number; width: number; height: number } | null;
  zoom: number;
  byType: Record<string, number>;
};

export function computeStats(
  elements: RassamElement[],
  selectedIds: string[],
  viewport: Viewport,
): SceneStats {
  const byType: Record<string, number> = {};
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of elements) {
    byType[el.type] = (byType[el.type] || 0) + 1;
    const b = elementBounds(el);
    minX = Math.min(minX, b.x);
    minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width);
    maxY = Math.max(maxY, b.y + b.height);
  }
  return {
    count: elements.length,
    selected: selectedIds.length,
    bounds: elements.length
      ? {
          x: minX,
          y: minY,
          width: maxX - minX,
          height: maxY - minY,
        }
      : null,
    zoom: viewport.zoom,
    byType,
  };
}

export function sceneOverviewBounds(
  elements: RassamElement[],
  viewport: Viewport,
  pad = 80,
): { x: number; y: number; width: number; height: number } {
  const viewW = 1200 / Math.max(viewport.zoom, 0.01);
  const viewH = 800 / Math.max(viewport.zoom, 0.01);
  const vx = -viewport.scrollX;
  const vy = -viewport.scrollY;
  let minX = vx - pad;
  let minY = vy - pad;
  let maxX = vx + viewW + pad;
  let maxY = vy + viewH + pad;
  for (const el of elements) {
    const b = elementBounds(el);
    minX = Math.min(minX, b.x - pad);
    minY = Math.min(minY, b.y - pad);
    maxX = Math.max(maxX, b.x + b.width + pad);
    maxY = Math.max(maxY, b.y + b.height + pad);
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}
