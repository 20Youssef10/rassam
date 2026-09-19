import type { EncryptedPayload } from "./crypto";
import { isEncryptedPayload, isValidRoomId } from "../core/security";

export type StorageUrls = {
  wsUrl: string;
  storageUrl: string;
  authToken?: string;
};

const env = import.meta.env;

function warnProdFallback(name: string): void {
  if (env.PROD && typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host !== "localhost" && host !== "127.0.0.1") {
      console.warn(`Rassam: ${name} is not set; falling back to same-host default. Set it explicitly for production.`);
    }
  }
}

export function getConfig(): StorageUrls {
  if (!env.VITE_RASSAM_WS_URL) {
    warnProdFallback("VITE_RASSAM_WS_URL");
  }
  if (!env.VITE_RASSAM_STORAGE_URL) {
    warnProdFallback("VITE_RASSAM_STORAGE_URL");
  }
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
  // NOTE: VITE_* is inlined into the client bundle and is visible to every
  // visitor — treat it as a public identifier, not a secret. Real per-user
  // auth should use HttpOnly cookies (sent via credentials:same-origin).
  const token = getConfig().authToken;
  if (!token) {
    return extra;
  }
  return { ...extra, Authorization: `Bearer ${token}` };
}

export type StorageErrorCode =
  | "network_failed"
  | "share_save_failed"
  | "share_load_failed"
  | "room_save_failed"
  | "room_load_failed";

export class StorageError extends Error {
  code: StorageErrorCode;
  constructor(code: StorageErrorCode, cause?: unknown) {
    super(code);
    this.code = code;
    if (cause !== undefined) {
      (this as { cause?: unknown }).cause = cause;
    }
  }
}

async function requestJson(url: string, init?: RequestInit): Promise<Response> {
  let res: Response;
  try {
    const ctrl = new AbortController();
    const t = window.setTimeout(() => ctrl.abort(), 15000);
    try {
      res = await fetch(url, { credentials: "same-origin", ...init, signal: ctrl.signal });
    } finally {
      window.clearTimeout(t);
    }
  } catch (error) {
    throw new StorageError("network_failed", error);
  }
  return res;
}

export async function saveShareScene(payload: EncryptedPayload): Promise<string> {
  let res: Response;
  try {
    res = await requestJson(`${apiBase()}/api/scenes`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError("network_failed", error);
  }
  if (!res.ok) {
    throw new StorageError("share_save_failed");
  }
  const json = (await res.json()) as { id: string };
  return json.id;
}

export async function loadShareScene(id: string): Promise<EncryptedPayload | null> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) {
    throw new Error("invalid_id");
  }
  let res: Response;
  try {
    res = await requestJson(`${apiBase()}/api/scenes/${encodeURIComponent(id)}`);
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError("network_failed", error);
  }
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new StorageError("share_load_failed");
  }
  const data = (await res.json()) as EncryptedPayload;
  if (!isEncryptedPayload(data)) {
    throw new Error("invalid_payload_shape");
  }
  return data;
}

export async function saveRoomScene(
  roomId: string,
  payload: EncryptedPayload,
): Promise<void> {
  if (!isValidRoomId(roomId)) {
    throw new Error("invalid_room_id");
  }
  let res: Response;
  try {
    res = await requestJson(`${apiBase()}/api/rooms/${encodeURIComponent(roomId)}/scene`, {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify(payload),
    });
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError("network_failed", error);
  }
  if (!res.ok) {
    throw new StorageError("room_save_failed");
  }
}

export async function loadRoomScene(roomId: string): Promise<EncryptedPayload | null> {
  if (!isValidRoomId(roomId)) {
    throw new Error("invalid_room_id");
  }
  let res: Response;
  try {
    res = await requestJson(`${apiBase()}/api/rooms/${encodeURIComponent(roomId)}/scene`);
  } catch (error) {
    if (error instanceof StorageError) {
      throw error;
    }
    throw new StorageError("network_failed", error);
  }
  if (res.status === 404 || !res.ok) {
    return null;
  }
  const data = (await res.json()) as EncryptedPayload;
  if (!isEncryptedPayload(data)) {
    throw new Error("invalid_payload_shape");
  }
  return data;
}
