import { createId } from "./ids";
import type { FilePayload, RassamElement } from "./types";
import { ARABIC_FONT } from "./types";
import { cloneElements } from "./geometry";
import { isAllowedImageDataURL, sanitizeElementLink } from "./security";

export type ClipboardPayload = {
  type: "rassam-clipboard";
  version: 1;
  elements: RassamElement[];
  files?: Record<string, FilePayload>;
};

const CLIP_KEY = "rassam-clipboard-v1";

export function writeClipboard(
  elements: RassamElement[],
  files?: Record<string, FilePayload>,
): ClipboardPayload {
  const payload: ClipboardPayload = {
    type: "rassam-clipboard",
    version: 1,
    elements: cloneElements(elements),
    files,
  };
  try {
    localStorage.setItem(CLIP_KEY, JSON.stringify(payload));
  } catch {
    // Clipboard persistence is best-effort (quota); the in-memory payload is returned.
  }
  return payload;
}

export function readClipboard(): ClipboardPayload | null {
  try {
    const raw = localStorage.getItem(CLIP_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as ClipboardPayload;
    if (parsed?.type !== "rassam-clipboard" || !Array.isArray(parsed.elements)) {
      return null;
    }
    return parsed;
  } catch {
    // Corrupt clipboard cache is not fatal — paste falls back to empty.
    return null;
  }
}

export function duplicateElements(
  elements: RassamElement[],
  offset = 24,
): RassamElement[] {
  return cloneElements(elements).map((el) => {
    const base = {
      ...el,
      id: createId(),
      x: el.x + offset,
      y: el.y + offset,
    };
    if (el.type === "draw" || el.type === "line" || el.type === "arrow") {
      return {
        ...base,
        points: el.points.map((p) => ({ x: p.x + offset, y: p.y + offset })),
      } as RassamElement;
    }
    return base as RassamElement;
  });
}

export function bringToFront(
  all: RassamElement[],
  ids: string[],
): RassamElement[] {
  const sel = all.filter((el) => ids.includes(el.id));
  const rest = all.filter((el) => !ids.includes(el.id));
  return [...rest, ...sel];
}

export function sendToBack(all: RassamElement[], ids: string[]): RassamElement[] {
  const sel = all.filter((el) => ids.includes(el.id));
  const rest = all.filter((el) => !ids.includes(el.id));
  return [...sel, ...rest];
}

export function bringForward(all: RassamElement[], ids: string[]): RassamElement[] {
  const out = [...all];
  for (let i = out.length - 2; i >= 0; i--) {
    if (ids.includes(out[i].id) && !ids.includes(out[i + 1].id)) {
      const swapped = out[i];
      out[i] = out[i + 1];
      out[i + 1] = swapped;
    }
  }
  return out;
}

export function sendBackward(all: RassamElement[], ids: string[]): RassamElement[] {
  const out = [...all];
  for (let i = 1; i < out.length; i++) {
    if (ids.includes(out[i].id) && !ids.includes(out[i - 1].id)) {
      const swapped = out[i];
      out[i] = out[i - 1];
      out[i - 1] = swapped;
    }
  }
  return out;
}

export function flipElements(
  all: RassamElement[],
  ids: string[],
  axis: "horizontal" | "vertical",
): RassamElement[] {
  const sel = all.filter((el) => ids.includes(el.id));
  if (!sel.length) {
    return all;
  }
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const el of sel) {
    minX = Math.min(minX, el.x);
    minY = Math.min(minY, el.y);
    maxX = Math.max(maxX, el.x + ("width" in el ? el.width : 0));
    maxY = Math.max(maxY, el.y + ("height" in el ? el.height : 0));
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  const idSet = new Set(ids);

  return all.map((el) => {
    if (!idSet.has(el.id)) {
      return el;
    }
    if (axis === "horizontal") {
      const nx = 2 * cx - el.x - ("width" in el ? el.width : 0);
      if (el.type === "draw" || el.type === "line" || el.type === "arrow") {
        return {
          ...el,
          x: nx,
          points: el.points.map((p) => ({ x: 2 * cx - p.x, y: p.y })),
        };
      }
      return { ...el, x: nx };
    }
    const ny = 2 * cy - el.y - ("height" in el ? el.height : 0);
    if (el.type === "draw" || el.type === "line" || el.type === "arrow") {
      return {
        ...el,
        y: ny,
        points: el.points.map((p) => ({ x: p.x, y: 2 * cy - p.y })),
      };
    }
    return { ...el, y: ny };
  });
}

export type SceneJson = {
  type: "rassam-scene" | "excalidraw";
  version: 1;
  elements: RassamElement[];
  files?: Record<string, FilePayload>;
  viewport?: { scrollX: number; scrollY: number; zoom: number };
};

/** Minimal runtime guard for untrusted element ingress (import/collab/clipboard). */
function isRassamElementLike(raw: unknown): raw is RassamElement {
  if (!raw || typeof raw !== "object") {
    return false;
  }
  const el = raw as Record<string, unknown>;
  return (
    typeof el.id === "string" &&
    typeof el.type === "string" &&
    typeof el.x === "number" &&
    typeof el.y === "number"
  );
}

/** Map a subset of Excalidraw JSON elements into Rassam elements. */
function fromExcalidrawEl(raw: Record<string, unknown>): RassamElement | null {
  const type = String(raw.type || "");
  const id = String(raw.id || createId());
  const x = Number(raw.x || 0);
  const y = Number(raw.y || 0);
  const stroke = String(raw.strokeColor || raw.stroke || "#0F172A");
  const fill =
    raw.backgroundColor && String(raw.backgroundColor) !== "transparent"
      ? String(raw.backgroundColor)
      : "transparent";
  const strokeWidth = Number(raw.strokeWidth || 2);
  const opacity = typeof raw.opacity === "number" ? raw.opacity : 1;
  const seed = Number(raw.seed || randomSeedSafe());
  const width = Number(raw.width || 0);
  const height = Number(raw.height || 0);

  const base = { id, x, y, stroke, fill, strokeWidth, opacity, seed };

  if (type === "rectangle" || type === "ellipse" || type === "diamond") {
    return {
      ...base,
      type,
      width: Math.max(1, width),
      height: Math.max(1, height),
    } as RassamElement;
  }
  if (type === "line" || type === "arrow") {
    const pts = Array.isArray(raw.points)
      ? (raw.points as number[][]).map((p) => ({
          x: x + Number(p[0] || 0),
          y: y + Number(p[1] || 0),
        }))
      : [{ x, y }, { x: x + width, y: y + height }];
    return {
      ...base,
      type,
      points: pts,
      label: typeof raw.text === "string" ? raw.text : undefined,
    } as RassamElement;
  }
  if (type === "freedraw" || type === "draw") {
    const pts = Array.isArray(raw.points)
      ? (raw.points as number[][]).map((p) => ({
          x: x + Number(p[0] || 0),
          y: y + Number(p[1] || 0),
        }))
      : [{ x, y }];
    return { ...base, type: "draw", points: pts } as RassamElement;
  }
  if (type === "text") {
    return {
      ...base,
      type: "text",
      text: String(raw.text || ""),
      fontSize: Number(raw.fontSize || 20),
      fontFamily: String(raw.fontFamily || ARABIC_FONT),
      width: Math.max(40, width || 80),
      height: Math.max(20, height || 28),
    } as RassamElement;
  }
  return null;
}

function randomSeedSafe() {
  return Math.floor(Math.random() * 2 ** 31);
}

export function parseExcalidrawJson(raw: string): SceneJson | null {
  try {
    const parsed = JSON.parse(raw) as {
      type?: string;
      elements?: Record<string, unknown>[];
      appState?: { scrollX?: number; scrollY?: number; zoom?: { value?: number } };
    };
    if (!parsed || !Array.isArray(parsed.elements)) {
      return null;
    }
    const looksExcalidraw =
      parsed.type === "excalidraw" ||
      parsed.elements.some((el) => "strokeColor" in el || el.type === "freedraw");
    const elements: RassamElement[] = [];
    for (const rawEl of parsed.elements) {
      if (looksExcalidraw) {
        const mapped = fromExcalidrawEl(rawEl);
        if (mapped) {
          elements.push(mapped);
        }
      } else if (isRassamElementLike(rawEl)) {
        elements.push(rawEl);
      }
    }
    return {
      type: looksExcalidraw ? "excalidraw" : "rassam-scene",
      version: 1,
      elements: sanitizeSceneElements(elements),
      viewport:
        parsed.appState && typeof parsed.appState.scrollX === "number"
          ? {
              scrollX: parsed.appState.scrollX,
              scrollY: parsed.appState.scrollY || 0,
              zoom: parsed.appState.zoom?.value || 1,
            }
          : undefined,
    };
  } catch {
    // Unparseable import payload — caller surfaces "invalid file".
    return null;
  }
}

function sanitizeSceneElements(elements: RassamElement[]): RassamElement[] {
  return elements.slice(0, 5000).map((el) => {
    if (!el || typeof el !== "object") return el;
    const safe = { ...el } as RassamElement & { link?: string };
    if (safe.link) {
      safe.link = sanitizeElementLink(safe.link);
      if (!safe.link) delete safe.link;
    }
    const maybeText = (safe as { text?: unknown }).text;
    if (typeof maybeText === "string" && maybeText.length > 20000) {
      (safe as { text: string }).text = maybeText.slice(0, 20000);
    }
    if (Array.isArray((safe as { points?: unknown }).points)) {
      const pts = (safe as { points: { x: number; y: number }[] }).points;
      if (pts.length > 5000) {
        (safe as { points: unknown }).points = pts.slice(0, 5000);
      }
    }
    return safe;
  });
}

function sanitizeFiles(files: Record<string, FilePayload> | undefined): Record<string, FilePayload> | undefined {
  if (!files || typeof files !== "object") return undefined;
  const out: Record<string, FilePayload> = {};
  for (const [k, v] of Object.entries(files).slice(0, 200)) {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(k)) continue;
    if (!v || typeof v.dataURL !== "string" || !isAllowedImageDataURL(v.dataURL)) continue;
    out[k] = v;
  }
  return out;
}

export function parseSceneJson(raw: string): SceneJson | null {
  try {
    const parsed = JSON.parse(raw) as SceneJson & { type?: string };
    if (!parsed || !Array.isArray(parsed.elements)) {
      // try excalidraw
      return parseExcalidrawJson(raw);
    }
    if (parsed.type === "excalidraw") {
      return parseExcalidrawJson(raw);
    }
    const looksExcal = parsed.elements.some(
      (el) => el && typeof el === "object" && "strokeColor" in (el as object),
    );
    if (looksExcal) {
      return parseExcalidrawJson(raw);
    }
    return {
      type: "rassam-scene",
      version: 1,
      elements: sanitizeSceneElements(parsed.elements),
      files: sanitizeFiles(parsed.files),
      viewport: parsed.viewport,
    };
  } catch {
    // Not Rassam JSON — fall through to the Excalidraw parser.
    return parseExcalidrawJson(raw);
  }
}

export function exportSceneJson(
  elements: RassamElement[],
  files?: Record<string, FilePayload>,
  viewport?: SceneJson["viewport"],
): string {
  const payload: SceneJson = {
    type: "rassam-scene",
    version: 1,
    elements,
    files,
    viewport,
  };
  return JSON.stringify(payload, null, 2);
}

export function downloadTextFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function snapValue(v: number, grid: number): number {
  return Math.round(v / grid) * grid;
}

export function midpoint(
  points: { x: number; y: number }[],
): { x: number; y: number } | null {
  if (!points.length) {
    return null;
  }
  if (points.length === 1) {
    return points[0];
  }
  const mid = Math.floor((points.length - 1) / 2);
  if (points.length % 2 === 1) {
    return points[mid];
  }
  const a = points[mid];
  const b = points[mid + 1];
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}
