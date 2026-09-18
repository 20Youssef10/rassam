import type { Bounds, RassamElement } from "./types";
import { elementBounds } from "./geometry";

export function isFrame(el: RassamElement): el is Extract<RassamElement, { type: "frame" }> {
  return el.type === "frame";
}

export function frameElements(
  frame: RassamElement,
  all: readonly RassamElement[],
): RassamElement[] {
  if (frame.type !== "frame") {
    return [];
  }
  const frameId = frame.id;
  const fb = elementBounds(frame);
  const out: RassamElement[] = [];
  for (const el of all) {
    if (el.id === frameId || el.type === "frame") {
      continue;
    }
    const b = elementBounds(el);
    const cx = b.x + b.width / 2;
    const cy = b.y + b.height / 2;
    if (
      cx >= fb.x &&
      cx <= fb.x + fb.width &&
      cy >= fb.y &&
      cy <= fb.y + fb.height
    ) {
      out.push(el);
    }
  }
  return out;
}

export function selectFrameContents(
  frameId: string,
  all: RassamElement[],
): string[] {
  const frame = all.find((el) => el.id === frameId);
  if (!frame) {
    return [frameId];
  }
  return [frameId, ...frameElements(frame, all).map((el) => el.id)];
}

export function exportBoundsForFrame(
  frameId: string,
  all: RassamElement[],
): Bounds | null {
  const frame = all.find((el) => el.id === frameId);
  if (!frame) {
    return null;
  }
  return elementBounds(frame);
}

export function elementsInsideBounds(
  bounds: Bounds,
  all: RassamElement[],
  excludeFrameId?: string,
): RassamElement[] {
  return all.filter((el) => {
    if (el.id === excludeFrameId) {
      return false;
    }
    const b = elementBounds(el);
    return (
      b.x >= bounds.x &&
      b.y >= bounds.y &&
      b.x + b.width <= bounds.x + bounds.width &&
      b.y + b.height <= bounds.y + bounds.height
    );
  });
}
