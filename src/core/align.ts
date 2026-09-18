import type { RassamElement } from "./types";
import { elementBounds, selectionBounds, translateElement } from "./geometry";

export type AlignMode =
  | "left"
  | "centerH"
  | "right"
  | "top"
  | "centerV"
  | "bottom";

export function alignElements(
  all: RassamElement[],
  selectedIds: string[],
  mode: AlignMode,
): RassamElement[] {
  const selected = all.filter((el) => selectedIds.includes(el.id));
  if (selected.length < 2) {
    return all;
  }
  const group = selectionBounds(selected);
  if (!group) {
    return all;
  }

  const deltas = new Map<string, { dx: number; dy: number }>();

  for (const el of selected) {
    const b = elementBounds(el);
    let dx = 0;
    let dy = 0;
    if (mode === "left") {
      dx = group.x - b.x;
    } else if (mode === "right") {
      dx = group.x + group.width - (b.x + b.width);
    } else if (mode === "centerH") {
      dx = group.x + group.width / 2 - (b.x + b.width / 2);
    } else if (mode === "top") {
      dy = group.y - b.y;
    } else if (mode === "bottom") {
      dy = group.y + group.height - (b.y + b.height);
    } else if (mode === "centerV") {
      dy = group.y + group.height / 2 - (b.y + b.height / 2);
    }
    deltas.set(el.id, { dx, dy });
  }

  return all.map((el) => {
    const d = deltas.get(el.id);
    if (!d || (d.dx === 0 && d.dy === 0)) {
      return el;
    }
    return translateElement(el, d.dx, d.dy);
  });
}

export function distributeElements(
  all: RassamElement[],
  selectedIds: string[],
  axis: "x" | "y",
): RassamElement[] {
  const selected = all.filter((el) => selectedIds.includes(el.id));
  if (selected.length < 3) {
    return all;
  }
  const sorted = [...selected].sort((a, b) => {
    const ba = elementBounds(a);
    const bb = elementBounds(b);
    return axis === "x" ? ba.x - bb.x : ba.y - bb.y;
  });
  const first = elementBounds(sorted[0]);
  const last = elementBounds(sorted[sorted.length - 1]);
  const startPos = axis === "x" ? first.x : first.y;
  const endPos = axis === "x" ? last.x + last.width : last.y + last.height;
  const totalSize = sorted.reduce((sum, el) => {
    const b = elementBounds(el);
    return sum + (axis === "x" ? b.width : b.height);
  }, 0);
  const gap = (endPos - startPos - totalSize) / (sorted.length - 1);
  let cursor = startPos;
  const deltas = new Map<string, number>();
  for (const el of sorted) {
    const b = elementBounds(el);
    const pos = axis === "x" ? b.x : b.y;
    deltas.set(el.id, cursor - pos);
    cursor += (axis === "x" ? b.width : b.height) + gap;
  }
  return all.map((el) => {
    const d = deltas.get(el.id);
    if (!d) {
      return el;
    }
    return translateElement(el, axis === "x" ? d : 0, axis === "y" ? d : 0);
  });
}
