import type { EncryptedPayload } from "./crypto";

export type StorageUrls = {
  wsUrl: string;
  storageUrl: string;
  authToken?: string;
};

const env = import.meta.env;

export function getConfig(): StorageUrls {
  return {
    wsUrl:
      env.VITE_RASSAM_WS_URL ||
      (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:3002`
        : "http://localhost:3002"),
    storageUrl:
      env.VITE_RASSAM_STORAGE_URL ||
      (typeof window !== "undefined"
        ? `${window.location.protocol}//${window.location.hostname}:8080`
        : "http://localhost:8080"),
    authToken: env.VITE_RASSAM_AUTH_TOKEN || undefined,
  };
}

function apiBase(): string {
  return getConfig().storageUrl.replace(/\/$/, "");
}

function authHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const token = getConfig().authToken;
  if (!token) {
    return extra;
  }
  return { ...extra, Authorization: `Bearer ${token}` };
}

export async function saveShareScene(payload: EncryptedPayload): Promise<string> {
  const res = await fetch(`${apiBase()}/api/scenes`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("share_save_failed");
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function loadShareScene(id: string): Promise<EncryptedPayload | null> {
  const res = await fetch(`${apiBase()}/api/scenes/${id}`);
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error("share_load_failed");
  }
  return (await res.json()) as EncryptedPayload;
}

export async function saveRoomScene(
  roomId: string,
  payload: EncryptedPayload,
): Promise<void> {
  const res = await fetch(`${apiBase()}/api/rooms/${roomId}/scene`, {
    method: "POST",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error("room_save_failed");
  }
}

export async function loadRoomScene(roomId: string): Promise<EncryptedPayload | null> {
  const res = await fetch(`${apiBase()}/api/rooms/${roomId}/scene`);
  if (res.status === 404 || !res.ok) {
    return null;
  }
  return (await res.json()) as EncryptedPayload;
}
