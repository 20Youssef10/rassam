/** Shared client-side security helpers (no deps). */

export const ROOM_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;

export function isValidRoomId(id: string): boolean {
  return ROOM_ID_RE.test(id || "");
}

export function isValidRoomKey(keyB64: string): boolean {
  if (!keyB64 || !B64URL_RE.test(keyB64) || keyB64.length < 22 || keyB64.length > 128) {
    return false;
  }
  try {
    const pad = keyB64.length % 4 === 0 ? "" : "=".repeat(4 - (keyB64.length % 4));
    const normalized = (keyB64 + pad).replace(/-/g, "+").replace(/_/g, "/");
    const bin = atob(normalized);
    return bin.length === 16 || bin.length === 24 || bin.length === 32;
  } catch {
    // Undecodable key is invalid by definition.
    return false;
  }
}

export function isEncryptedPayload(v: unknown): v is { c: string; iv: string } {
  if (!v || typeof v !== "object") return false;
  const p = v as Record<string, unknown>;
  return (
    typeof p.c === "string" &&
    typeof p.iv === "string" &&
    p.c.length > 0 &&
    p.c.length < 12_000_000 &&
    p.iv.length > 0 &&
    p.iv.length < 64 &&
    B64URL_RE.test(p.c.replace(/=+$/, "")) &&
    B64URL_RE.test(p.iv.replace(/=+$/, ""))
  );
}

const SAFE_URL_RE = /^(https?:\/\/|mailto:)/i;
const BLOCKED_URL_RE = /^(javascript|data|vbscript|file|blob):/i;

export function isSafeUrl(url: string): boolean {
  const t = (url || "").trim();
  if (!t || t.length > 2048) return false;
  if (BLOCKED_URL_RE.test(t)) return false;
  return SAFE_URL_RE.test(t);
}

export function sanitizeElementLink(link: string | undefined): string | undefined {
  if (!link) return undefined;
  const t = link.trim().slice(0, 2048);
  return isSafeUrl(t) ? t : undefined;
}

const HEX_COLOR_RE = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const NAMED_COLORS = new Set([
  "transparent",
  "currentcolor",
  "black",
  "white",
  "red",
  "green",
  "blue",
]);

export function sanitizeColor(c: string, fallback = "#0F172A"): string {
  const t = String(c || "").trim().slice(0, 64);
  if (HEX_COLOR_RE.test(t)) return t;
  if (NAMED_COLORS.has(t.toLowerCase())) return t.toLowerCase() === "transparent" ? "transparent" : t;
  return fallback;
}

export function toSafeNumber(n: unknown, fallback = 0): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(-100000, Math.min(100000, v));
}

export function escapeSvgAttr(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const ALLOWED_IMG_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export function isAllowedImageMime(mime: string): boolean {
  return ALLOWED_IMG_MIME.has(String(mime || "").toLowerCase().split(";")[0].trim());
}

export function isAllowedImageDataURL(dataURL: string): boolean {
  if (!dataURL || typeof dataURL !== "string") return false;
  if (dataURL.length > MAX_IMAGE_BYTES * 2) return false;
  const m = dataURL.match(/^data:([^;,]+)(;base64)?,/);
  if (!m) return false;
  const mime = m[1].toLowerCase().trim();
  if (!isAllowedImageMime(mime)) return false;
  if (/svg|html|javascript|ecmascript/i.test(mime)) return false;
  return true;
}

export function isAllowedLibraryUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return false;
    if (u.protocol === "http:") {
      const h = u.hostname.toLowerCase();
      if (h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]") return false;
    }
    return true;
  } catch {
    // Unparseable URL is not allowlisted by definition.
    return false;
  }
}

export function sanitizeProviderBaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const t = raw.trim().slice(0, 512);
  try {
    const u = new URL(t);
    if (u.protocol !== "https:" && u.protocol !== "http:") return undefined;
    return t;
  } catch {
    // Unparseable base URL is rejected by definition.
    return undefined;
  }
}
