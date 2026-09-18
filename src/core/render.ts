import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";

import type { FilePayload, RassamElement, Viewport } from "./types";
import { ARABIC_FONT, HANDLE_SIZE } from "./types";
import { elementBounds, handlePositions } from "./geometry";
import { elementCenter } from "./transform";
import { elbowPoints } from "./elbow";
import { laserAlpha } from "./laser";
import type { LaserStroke } from "./laser";
import { drawSnapGuides, type SnapGuide } from "./snapGuides";
import { canvasPaper } from "../styles/tokens";
import type { Theme } from "../styles/tokens";
import { getCachedImage, primeImageCache } from "./imageCache";
import { hasArabic } from "./fonts";

export { primeImageCache, getCachedImage } from "./imageCache";

export function createRough(canvas: HTMLCanvasElement): RoughCanvas {
  return rough.canvas(canvas);
}

export function resizeCanvas(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  dpr: number,
): CanvasRenderingContext2D {
  canvas.width = Math.floor(width * dpr);
  canvas.height = Math.floor(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  const ctx = canvas.getContext("2d")!;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

function arrowHead(
  from: { x: number; y: number },
  to: { x: number; y: number },
  size: number,
): { x: number; y: number }[] {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const a1 = angle + Math.PI - Math.PI / 7;
  const a2 = angle + Math.PI + Math.PI / 7;
  return [
    { x: to.x + size * Math.cos(a1), y: to.y + size * Math.sin(a1) },
    { x: to.x + size * Math.cos(a2), y: to.y + size * Math.sin(a2) },
  ];
}

function drawHandles(
  ctx: CanvasRenderingContext2D,
  b: { x: number; y: number; width: number; height: number },
  zoom: number,
  opts?: { locked?: boolean; rotation?: number },
): void {
  const pad = 4 / zoom;
  ctx.save();
  ctx.strokeStyle = opts?.locked ? "#D97706" : "#2563EB";
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash(opts?.locked ? [2 / zoom, 2 / zoom] : [4 / zoom, 4 / zoom]);
  ctx.strokeRect(b.x - pad, b.y - pad, b.width + pad * 2, b.height + pad * 2);
  ctx.setLineDash([]);
  if (!opts?.locked) {
    const hs = HANDLE_SIZE / zoom;
    for (const p of Object.values(handlePositions(b))) {
      ctx.fillStyle = "#FFFFFF";
      ctx.strokeStyle = "#2563EB";
      ctx.lineWidth = 1.5 / zoom;
      ctx.beginPath();
      ctx.rect(p.x - hs / 2, p.y - hs / 2, hs, hs);
      ctx.fill();
      ctx.stroke();
    }
    // rotate handle above north
    const rx = b.x + b.width / 2;
    const ry = b.y - 22 / zoom;
    ctx.beginPath();
    ctx.arc(rx, ry, hs * 0.7, 0, Math.PI * 2);
    ctx.fillStyle = "#0D9488";
    ctx.fill();
    ctx.strokeStyle = "#0F172A";
    ctx.stroke();
  }
  ctx.restore();
}

function drawLinkBadge(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.fillStyle = "#2563EB";
  ctx.fillRect(x, y, 18, 18);
  ctx.fillStyle = "#fff";
  ctx.font = "11px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("→", x + 9, y + 10);
  ctx.restore();
}

export function drawLaserLayer(
  ctx: CanvasRenderingContext2D,
  strokes: LaserStroke[],
  now = Date.now(),
): void {
  for (const stroke of strokes) {
    const alpha = laserAlpha(stroke, now);
    if (alpha <= 0 || stroke.points.length < 2) {
      if (stroke.points.length === 1 && alpha > 0) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = "#EF4444";
        ctx.beginPath();
        ctx.arc(stroke.points[0].x, stroke.points[0].y, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      continue;
    }
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = "#EF4444";
    ctx.lineWidth = 3;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

function textMatches(el: RassamElement, query: string): boolean {
  if (!query || el.type !== "text") {
    return false;
  }
  return el.text.toLowerCase().includes(query.toLowerCase());
}

export function drawElement(
  rc: RoughCanvas,
  ctx: CanvasRenderingContext2D,
  el: RassamElement,
  options: {
    selected?: boolean;
    zoom?: number;
    files?: Record<string, FilePayload>;
    searchQuery?: string;
    theme?: Theme;
  } = {},
): void {
  const rot = el.rotation || 0;
  ctx.save();
  if (rot) {
    const c = elementCenter(el);
    ctx.translate(c.x, c.y);
    ctx.rotate(rot);
    ctx.translate(-c.x, -c.y);
  }

  const common = {
    stroke: el.stroke,
    strokeWidth: el.strokeWidth,
    roughness: 1.1,
    bowing: 1.2,
    seed: el.seed,
    fill: el.fill === "transparent" ? undefined : el.fill,
    fillStyle: "hachure" as const,
    hachureGap: 6,
    disableMultiStroke: false,
  };

  // dashed / dotted strokes (canvas overlay for linear; rough approx via stroke)
  if (el.strokeStyle === "dashed" || el.strokeStyle === "dotted") {
    ctx.save();
    ctx.setLineDash(el.strokeStyle === "dashed" ? [8, 6] : [2, 4]);
  }

  if (el.type === "rectangle") {
    rc.rectangle(el.x, el.y, el.width, el.height, common);
  } else if (el.type === "comment") {
    const r = 12;
    ctx.save();
    ctx.fillStyle = "#2563EB";
    ctx.beginPath();
    ctx.arc(el.x + r, el.y + r, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = `600 12px ${ARABIC_FONT}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("•", el.x + r, el.y + r);
    const note = el.label || "";
    if (note) {
      ctx.textAlign = "start";
      ctx.textBaseline = "top";
      ctx.fillStyle =
        options.theme === "dark" ? "#F8FAFC" : "#0F172A";
      ctx.font = `400 12px ${ARABIC_FONT}`;
      ctx.fillText(note.slice(0, 40), el.x + 28, el.y + 4);
    }
    ctx.restore();
  } else if (el.type === "frame") {
    ctx.save();
    ctx.globalAlpha = el.opacity;
    ctx.strokeStyle = "#2563EB";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.strokeRect(el.x, el.y, el.width, el.height);
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(37,99,235,0.08)";
    ctx.fillRect(el.x, el.y, el.width, 28);
    ctx.fillStyle = "#2563EB";
    ctx.font = `600 14px ${ARABIC_FONT}`;
    ctx.textBaseline = "middle";
    ctx.fillText(el.name || "إطار", el.x + 8, el.y + 14);
    ctx.restore();
  } else if (el.type === "sticky") {
    const fill = el.fill === "transparent" ? "#FEF3C7" : el.fill;
    rc.rectangle(el.x, el.y, el.width, el.height, {
      ...common,
      fill,
      fillStyle: "solid",
      stroke: el.stroke,
    });
    ctx.save();
    ctx.globalAlpha = el.opacity;
    ctx.fillStyle = "#0F172A";
    ctx.font = `600 16px ${ARABIC_FONT}`;
    ctx.textBaseline = "top";
    const stickyText = el.label || "ملاحظة";
    const lines: string[] = stickyText.split("\n").slice(0, 6);
    lines.forEach((line: string, i: number) => {
      ctx.fillText(line, el.x + 12, el.y + 14 + i * 22);
    });
    ctx.restore();
  } else if (el.type === "diamond") {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    rc.polygon(
      [
        [cx, el.y],
        [el.x + el.width, cy],
        [cx, el.y + el.height],
        [el.x, cy],
      ],
      common,
    );
  } else if (el.type === "ellipse") {
    rc.ellipse(
      el.x + el.width / 2,
      el.y + el.height / 2,
      Math.max(1, el.width),
      Math.max(1, el.height),
      common,
    );
  } else if (el.type === "arrow") {
    if (el.points.length >= 2) {
      const pts =
        el.elbow && el.points.length === 2
          ? elbowPoints(el.points[0], el.points[el.points.length - 1])
          : el.points;
      const start = pts[0];
      const end = pts[pts.length - 1];
      rc.linearPath(
        pts.map((p) => [p.x, p.y] as [number, number]),
        common,
      );
      const head = arrowHead(start, end, 12 + el.strokeWidth * 2);
      rc.linearPath(
        [
          [head[0].x, head[0].y],
          [end.x, end.y],
          [head[1].x, head[1].y],
        ],
        { ...common, fill: el.stroke, fillStyle: "solid" },
      );
      if (el.label) {
        const mid = pts[Math.floor((pts.length - 1) / 2)];
        const mid2 = pts[Math.min(pts.length - 1, Math.floor((pts.length - 1) / 2) + 1)];
        const mx = (mid.x + mid2.x) / 2;
        const my = (mid.y + mid2.y) / 2;
        ctx.save();
        ctx.font = `600 14px ${ARABIC_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = el.stroke;
        ctx.fillText(el.label, mx, my - 10);
        ctx.restore();
      }
      if (el.link) {
        drawLinkBadge(ctx, end.x + 10, end.y - 10);
      }
    }
  } else if (el.type === "line") {
    if (el.points.length >= 2) {
      const pts =
        el.elbow && el.points.length === 2
          ? elbowPoints(el.points[0], el.points[el.points.length - 1])
          : el.points;
      rc.linearPath(
        pts.map((p) => [p.x, p.y] as [number, number]),
        common,
      );
      if (el.label) {
        const mid = pts[Math.floor((pts.length - 1) / 2)];
        ctx.save();
        ctx.font = `600 14px ${ARABIC_FONT}`;
        ctx.textAlign = "center";
        ctx.fillStyle = el.stroke;
        ctx.fillText(el.label, mid.x, mid.y - 10);
        ctx.restore();
      }
    }
  } else if (el.type === "draw") {
    if (el.points.length === 1) {
      rc.circle(el.points[0].x, el.points[0].y, el.strokeWidth + 2, {
        ...common,
        fill: el.stroke,
        fillStyle: "solid",
      });
    } else if (el.points.length >= 2) {
      rc.linearPath(
        el.points.map((p) => [p.x, p.y] as [number, number]),
        common,
      );
    }
  } else if (el.type === "text") {
    ctx.save();
    ctx.globalAlpha = el.opacity;
    // Dark-theme contrast: use light ink on dark paper
    ctx.fillStyle = el.stroke === "#0F172A" ? "#F8FAFC" : el.stroke;
    if (options.theme === "dark" && (el.stroke === "#0F172A" || el.stroke === "#000000")) {
      ctx.fillStyle = "#F8FAFC";
    }
    const family =
      el.fontFamily ||
      (hasArabic(el.text) ? ARABIC_FONT : "Segoe UI, system-ui, sans-serif");
    ctx.font = `600 ${el.fontSize}px ${family}`;
    ctx.textBaseline = "top";
    ctx.textAlign = "left";
    const lines = el.text.split("\n");
    lines.forEach((line, i) => {
      ctx.fillText(line, el.x, el.y + i * el.fontSize * 1.35);
    });
    // search highlight (RTL-safe: measure each line)
    if (options.searchQuery && textMatches(el, options.searchQuery)) {
      ctx.globalAlpha = 0.28;
      ctx.fillStyle = "#FBBF24";
      lines.forEach((line, i) => {
        if (!line.toLowerCase().includes(options.searchQuery!.toLowerCase())) {
          return;
        }
        const w = ctx.measureText(line).width;
        ctx.fillRect(el.x - 2, el.y + i * el.fontSize * 1.35 - 2, w + 4, el.fontSize * 1.25);
      });
    }
    ctx.restore();
  } else if (el.type === "image") {
    const img =
      getCachedImage(el.fileId) ||
      (() => {
        const file = options.files?.[el.fileId];
        if (!file) {
          return null;
        }
        const next = new Image();
        next.src = file.dataURL;
        return next;
      })();
    ctx.save();
    ctx.globalAlpha = el.opacity;
    if (img && img.complete && img.naturalWidth > 0) {
      if (el.crop) {
        const sx = el.crop.x * img.naturalWidth;
        const sy = el.crop.y * img.naturalHeight;
        const sw = el.crop.w * img.naturalWidth;
        const sh = el.crop.h * img.naturalHeight;
        ctx.drawImage(img, sx, sy, sw, sh, el.x, el.y, el.width, el.height);
      } else {
        ctx.drawImage(img, el.x, el.y, el.width, el.height);
      }
    } else {
      ctx.fillStyle = "#E2E8F0";
      ctx.fillRect(el.x, el.y, el.width, el.height);
      ctx.strokeStyle = "#94A3B8";
      ctx.strokeRect(el.x, el.y, el.width, el.height);
    }
    ctx.restore();
    if (el.link) {
      drawLinkBadge(ctx, el.x + el.width - 16, el.y + 2);
    }
  }

  if (el.strokeStyle === "dashed" || el.strokeStyle === "dotted") {
    ctx.restore();
  }

  if (el.link && el.type !== "image" && el.type !== "arrow") {
    const b = elementBounds(el);
    drawLinkBadge(ctx, b.x + b.width - 16, b.y + 2);
  }

  ctx.restore();

  if (options.selected && options.zoom) {
    drawHandles(ctx, elementBounds(el), options.zoom, {
      locked: el.locked,
      rotation: el.rotation,
    });
  }
}

export function renderScene(
  canvas: HTMLCanvasElement,
  rc: RoughCanvas,
  elements: RassamElement[],
  viewport: Viewport,
  theme: Theme,
  selectedId: string | null,
  draft?: RassamElement | null,
  files?: Record<string, FilePayload>,
  selectedIds: string[] = [],
  cursors: Record<string, { x: number; y: number; name?: string }> = {},
  searchQuery = "",
  gridEnabled = false,
  lasers: LaserStroke[] = [],
  snapGuides: SnapGuide[] = [],
): void {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  const dpr = window.devicePixelRatio || 1;
  const ctx = resizeCanvas(canvas, width, height, dpr);

  if (files) {
    primeImageCache(files);
  }

  ctx.save();
  ctx.fillStyle = canvasPaper(theme);
  ctx.fillRect(0, 0, width, height);

  const grid = 24 * viewport.zoom;
  if (gridEnabled || grid > 8) {
    ctx.strokeStyle =
      theme === "dark" ? "rgba(148,163,184,0.12)" : "rgba(15,23,42,0.06)";
    ctx.lineWidth = gridEnabled ? 1.2 : 1;
    const ox = (viewport.scrollX * viewport.zoom) % grid;
    const oy = (viewport.scrollY * viewport.zoom) % grid;
    for (let x = ox; x < width; x += grid) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    for (let y = oy; y < height; y += grid) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  ctx.translate(viewport.scrollX * viewport.zoom, viewport.scrollY * viewport.zoom);
  ctx.scale(viewport.zoom, viewport.zoom);

  const multi = selectedIds.length > 1;
  for (const el of elements) {
    const isSelected =
      (selectedId && el.id === selectedId) || selectedIds.includes(el.id);
    drawElement(rc, ctx, el, {
      selected: isSelected && !multi,
      zoom: viewport.zoom,
      files,
      searchQuery,
      theme,
    });
  }

  if (multi) {
    const selectedEls = elements.filter((el) => selectedIds.includes(el.id));
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const el of selectedEls) {
      const b = elementBounds(el);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.width);
      maxY = Math.max(maxY, b.y + b.height);
    }
    if (selectedEls.length) {
      ctx.save();
      ctx.strokeStyle = "#2563EB";
      ctx.lineWidth = 1.5 / viewport.zoom;
      ctx.setLineDash([6 / viewport.zoom, 4 / viewport.zoom]);
      ctx.strokeRect(minX - 6, minY - 6, maxX - minX + 12, maxY - minY + 12);
      ctx.restore();
    }
  }

  if (draft) {
    drawElement(rc, ctx, draft, { zoom: viewport.zoom, files });
  }

  if (lasers.length) {
    ctx.save();
    drawLaserLayer(ctx, lasers);
    ctx.restore();
  }

  if (snapGuides.length) {
    drawSnapGuides(ctx, snapGuides, viewport.zoom);
  }

  for (const [id, c] of Object.entries(cursors)) {
    ctx.save();
    ctx.fillStyle = "#2563EB";
    ctx.beginPath();
    ctx.arc(c.x, c.y, 5, 0, Math.PI * 2);
    ctx.fill();
    const label = c.name ? `${c.name}` : id.slice(0, 4);
    ctx.font = `12px ${ARABIC_FONT}`;
    ctx.fillStyle = "#0F172A";
    ctx.fillText(label, c.x + 8, c.y - 8);
    ctx.restore();
  }

  ctx.restore();
}
