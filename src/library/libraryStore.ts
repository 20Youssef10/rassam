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
    return [];
  }
}

export function saveLocalLibrary(items: LibraryRecord[]): void {
  try {
    localStorage.setItem(LIBRARY_LS_KEY, JSON.stringify(items));
  } catch (error) {
    console.warn("rassam library save failed", error);
  }
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
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
    const res = await fetch(`${apiBase()}/api/library${userId ? `?user=${encodeURIComponent(userId)}` : ""}`, {
      headers: authHeaders(),
    });
    if (!res.ok) {
      return [];
    }
    const json = (await res.json()) as { items?: LibraryRecord[] };
    return json.items ?? [];
  } catch {
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
    body: JSON.stringify({ items, userId }),
  });
}
