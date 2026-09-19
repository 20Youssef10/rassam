export type LibraryRecord = {
  id: string;
  titleAr: string;
  titleEn: string;
  category: string;
  /** serialized element template (origin-relative factory output seed) */
  template: unknown[];
};

export const LIBRARY_LS_KEY = "rassam-library-v1";

export function loadLocalLibrary(): LibraryRecord[] {
  try {
    const raw = localStorage.getItem(LIBRARY_LS_KEY);
    if (!raw) {
      return [];
    }
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // Corrupt library cache is not fatal — start empty.
    return [];
  }
}

export function saveLocalLibrary(items: LibraryRecord[]): void {
  try {
    localStorage.setItem(LIBRARY_LS_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("rassam library save failed (quota?)", error);
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  // NOTE: VITE_* is bundled public — not a secret. Server should use
  // HttpOnly cookie sessions for real auth; this header is best-effort.
  const token = import.meta.env.VITE_RASSAM_AUTH_TOKEN;
  return token ? { ...extra, Authorization: `Bearer ${token}` } : extra;
}

function apiBase(): string {
  const base =
    import.meta.env.VITE_RASSAM_STORAGE_URL ||
    `${window.location.protocol}//${window.location.hostname}:8080`;
  return base.replace(/\/$/, "");
}

export async function fetchServerLibrary(userId?: string): Promise<LibraryRecord[]> {
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(`${apiBase()}/api/library${userId ? `?user=${encodeURIComponent(userId)}` : ""}`, {
        headers: authHeaders(),
        credentials: "same-origin",
        signal: ctrl.signal,
      });
    } finally {
      window.clearTimeout(t);
    }
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as { items?: LibraryRecord[] };
    const items = Array.isArray(json.items) ? json.items.slice(0, 500) : [];
    return items.filter((r) => r && typeof r.id === "string" && Array.isArray(r.template));
  } catch {
    // Library sync is best-effort — offline or server errors fall back to local.
    return [];
  }
}

export async function pushServerLibrary(
  items: LibraryRecord[],
  userId?: string,
): Promise<void> {
  await fetch(`${apiBase()}/api/library`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    credentials: "same-origin",
    body: JSON.stringify({ items: items.slice(0, 500), userId }),
  });
}
