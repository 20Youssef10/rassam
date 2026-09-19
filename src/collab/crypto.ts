/** End-to-end crypto for Rassam collab / share links (AES-GCM). */
import { isEncryptedPayload, isValidRoomId, isValidRoomKey } from "../core/security";

export { isEncryptedPayload };

export function bytesToBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let bin = "";
  for (let i = 0; i < arr.length; i++) {
    bin += String.fromCharCode(arr[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function base64UrlToBytes(b64: string): Uint8Array {
  const pad = b64.length % 4 === 0 ? "" : "=".repeat(4 - (b64.length % 4));
  const normalized = (b64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(normalized);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

export async function generateRoomId(): Promise<string> {
  const buf = new Uint8Array(10);
  crypto.getRandomValues(buf);
  return bytesToBase64Url(buf);
}

export async function generateRoomKey(): Promise<string> {
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
  const raw = await crypto.subtle.exportKey("raw", key);
  return bytesToBase64Url(raw);
}

async function importAesKey(keyB64: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    // Uint8Array is a valid BufferSource at runtime; the cast bridges DOM lib versions.
    base64UrlToBytes(keyB64) as unknown as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt", "decrypt"],
  );
}

export type EncryptedPayload = {
  /** base64url ciphertext */
  c: string;
  /** base64url iv */
  iv: string;
};

export async function encryptJSON(
  data: unknown,
  keyB64: string,
): Promise<EncryptedPayload> {
  const key = await importAesKey(keyB64);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(JSON.stringify(data));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded,
  );
  return { c: bytesToBase64Url(ciphertext), iv: bytesToBase64Url(iv) };
}

export async function decryptJSON<T>(
  payload: EncryptedPayload,
  keyB64: string,
): Promise<T> {
  if (!isEncryptedPayload(payload)) {
    throw new Error("invalid_payload_shape");
  }
  if (!isValidRoomKey(keyB64)) {
    throw new Error("invalid_key");
  }
  const key = await importAesKey(keyB64);
  // Uint8Array is a valid BufferSource at runtime; the cast bridges DOM lib versions.
  const iv = base64UrlToBytes(payload.iv) as unknown as BufferSource;
  const cipherBytes = base64UrlToBytes(payload.c) as unknown as BufferSource;
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, cipherBytes);
  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export type CollabLinkParts = {
  roomId: string;
  roomKey: string;
  readOnly: boolean;
};

export function buildCollabLink(roomId: string, roomKey: string, readOnly = false): string {
  const url = new URL(window.location.href);
  url.hash = readOnly
    ? `share=${roomId},${roomKey},ro`
    : `room=${roomId},${roomKey}`;
  return url.toString();
}

export function parseCollabLink(hash: string): CollabLinkParts | null {
  const raw = hash.replace(/^#/, "");
  if (!raw) {
    return null;
  }
  const params = new URLSearchParams(raw.includes("=") ? raw : "");
  const room = params.get("room");
  const share = params.get("share");
  if (room) {
    const [roomId, roomKey] = room.split(",");
    if (roomId && roomKey && isValidRoomId(roomId) && isValidRoomKey(roomKey)) {
      return { roomId, roomKey, readOnly: false };
    }
    return null;
  }
  if (share) {
    const parts = share.split(",");
    if (parts[0] && parts[1] && isValidRoomId(parts[0]) && isValidRoomKey(parts[1])) {
      return { roomId: parts[0], roomKey: parts[1], readOnly: parts[2] === "ro" };
    }
    return null;
  }
  return null;
}
