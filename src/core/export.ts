import type { FilePayload, RassamElement } from "./types";
import { ARABIC_FONT } from "./types";
import { selectionBounds } from "./geometry";
import { hasArabic } from "./fonts";
import type { Theme } from "../styles/tokens";
import { canvasPaper } from "../styles/tokens";
import {
  escapeSvgAttr,
  isAllowedImageDataURL,
  sanitizeColor,
  toSafeNumber,
} from "./security";

function escapeXml(s: string): string {
  return escapeSvgAttr(s);
}

function num(n: unknown): number {
  const v = toSafeNumber(n, 0);
  return Math.round(v * 100) / 100;
}

function elToSvg(el: RassamElement, files?: Record<string, FilePayload>): string {
  const stroke = sanitizeColor(el.stroke);
  const fillRaw = el.fill === "transparent" ? "none" : sanitizeColor(el.fill, "none");
  const strokeWidth = Math.max(0, Math.min(64, num(el.strokeWidth)));
  const opacity = Math.max(0, Math.min(1, Number(el.opacity) || 0));
  const common = `stroke="${escapeSvgAttr(stroke)}" stroke-width="${strokeWidth}" fill="${escapeSvgAttr(fillRaw)}" opacity="${opacity}"`;

  if (el.type === "rectangle") {
    return `<rect x="${num(el.x)}" y="${num(el.y)}" width="${Math.max(0, num(el.width))}" height="${Math.max(0, num(el.height))}" ${common} />`;
  }
  if (el.type === "ellipse") {
    return `<ellipse cx="${num(el.x + el.width / 2)}" cy="${num(el.y + el.height / 2)}" rx="${Math.max(0, num(el.width / 2))}" ry="${Math.max(0, num(el.height / 2))}" ${common} />`;
  }
  if (el.type === "diamond") {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    const points = `${num(cx)},${num(el.y)} ${num(el.x + el.width)},${num(cy)} ${num(cx)},${num(el.y + el.height)} ${num(el.x)},${num(cy)}`;
    return `<polygon points="${escapeSvgAttr(points)}" ${common} />`;
  }
  if (el.type === "line" || el.type === "arrow" || el.type === "draw") {
    const rawPts = Array.isArray(el.points) ? el.points.slice(0, 2000) : [];
    const pts = rawPts.map((p) => `${num(p.x)},${num(p.y)}`).join(" ");
    let extra = "";
    if (el.type === "arrow" && el.points.length >= 2) {
      const start = el.points[0];
      const end = el.points[el.points.length - 1];
      const angle = Math.atan2(end.y - start.y, end.x - start.x);
      const size = 12 + strokeWidth * 2;
      const a1 = angle + Math.PI - Math.PI / 7;
      const a2 = angle + Math.PI + Math.PI / 7;
      const h1 = `${num(end.x + size * Math.cos(a1))},${num(end.y + size * Math.sin(a1))}`;
      const h2 = `${num(end.x + size * Math.cos(a2))},${num(end.y + size * Math.sin(a2))}`;
      extra = `<polyline points="${escapeSvgAttr(`${h1} ${num(end.x)},${num(end.y)} ${h2}`)}" fill="none" stroke="${escapeSvgAttr(stroke)}" stroke-width="${strokeWidth}" />`;
    }
    return `<polyline points="${escapeSvgAttr(pts)}" fill="none" stroke="${escapeSvgAttr(stroke)}" stroke-width="${strokeWidth}" opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round" />${extra}`;
  }
  if (el.type === "text") {
    const family = hasArabic(el.text) ? el.fontFamily || ARABIC_FONT : el.fontFamily || "sans-serif";
    const safeText = String(el.text || "").slice(0, 5000);
    const fontSize = Math.max(1, Math.min(256, num(el.fontSize)));
    const lines = safeText.split("\n").slice(0, 200);
    const tspans = lines
      .map(
        (line, i) =>
          `<tspan x="${num(el.x)}" y="${num(el.y + fontSize * (i + 0.85))}">${escapeXml(line)}</tspan>`,
      )
      .join("");
    return `<text fill="${escapeSvgAttr(stroke)}" font-family="${escapeSvgAttr(family.slice(0, 128))}" font-size="${fontSize}" font-weight="600" opacity="${opacity}" direction="${hasArabic(safeText) ? "rtl" : "ltr"}" xml:space="preserve">${tspans}</text>`;
  }
  if (el.type === "image") {
    const file = files?.[el.fileId];
    if (!file || !isAllowedImageDataURL(file.dataURL)) {
      return `<rect x="${num(el.x)}" y="${num(el.y)}" width="${Math.max(0, num(el.width))}" height="${Math.max(0, num(el.height))}" fill="#E2E8F0" stroke="#94A3B8" />`;
    }
    return `<image x="${num(el.x)}" y="${num(el.y)}" width="${Math.max(0, num(el.width))}" height="${Math.max(0, num(el.height))}" href="${escapeSvgAttr(file.dataURL)}" opacity="${opacity}" preserveAspectRatio="xMidYMid meet" />`;
  }
  return "";
}

export function exportToSvg(
  elements: RassamElement[],
  files: Record<string, FilePayload> | undefined,
  theme: Theme,
  options?: {
    selectedOnly?: boolean;
    selectedIds?: string[];
    transparent?: boolean;
    scale?: number;
  },
): string {
  const list =
    options?.selectedOnly && options.selectedIds?.length
      ? elements.filter((el) => options.selectedIds!.includes(el.id))
      : elements;

  const bounds = selectionBounds(list);
  const pad = 24;
  const x = bounds ? bounds.x - pad : 0;
  const y = bounds ? bounds.y - pad : 0;
  const width = bounds ? bounds.width + pad * 2 : 800;
  const height = bounds ? bounds.height + pad * 2 : 600;
  const scale = options?.scale && options.scale > 0 ? options.scale : 1;
  const bg = options?.transparent ? "none" : canvasPaper(theme);
  const body = list.map((el) => elToSvg(el, files)).join("\n  ");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="${Math.ceil(width * scale)}" height="${Math.ceil(height * scale)}"
  viewBox="${x} ${y} ${width} ${height}">
  <title>Rassam</title>
  ${
    options?.transparent
      ? ""
      : `<rect x="${x}" y="${y}" width="${width}" height="${height}" fill="${bg}" />`
  }
  <g font-family="${ARABIC_FONT}">
  ${body}
  </g>
</svg>
`;
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportSvgFile(
  elements: RassamElement[],
  files: Record<string, FilePayload> | undefined,
  theme: Theme,
  options?: { selectedOnly?: boolean; selectedIds?: string[] },
): void {
  const svg = exportToSvg(elements, files, theme, options);
  downloadBlob(new Blob([svg], { type: "image/svg+xml;charset=utf-8" }), `rassam-${Date.now()}.svg`);
}

export function exportPngFromCanvas(
  canvas: HTMLCanvasElement,
  options?: { scale?: number; transparent?: boolean },
): void {
  const scale = options?.scale && options.scale > 0 ? options.scale : 1;
  const out = document.createElement("canvas");
  out.width = canvas.width * scale;
  out.height = canvas.height * scale;
  const ctx = out.getContext("2d");
  if (!ctx) {
    return;
  }
  if (options?.transparent) {
    // leave cleared
  } else {
    ctx.fillStyle = canvasPaper("light");
    ctx.fillRect(0, 0, out.width, out.height);
  }
  ctx.drawImage(canvas, 0, 0, out.width, out.height);
  const link = document.createElement("a");
  link.download = `rassam-${Date.now()}@${scale}x.png`;
  link.href = out.toDataURL("image/png");
  link.click();
}

export function copyCanvasToClipboard(canvas: HTMLCanvasElement): Promise<void> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("copy_failed"));
        return;
      }
      const item = new ClipboardItem({ "image/png": blob });
      navigator.clipboard.write([item]).then(() => resolve(), reject);
    }, "image/png");
  });
}
