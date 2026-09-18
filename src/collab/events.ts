export type RemoteCursor = {
  userId: string;
  x: number;
  y: number;
  name?: string;
};

export type CollabUser = {
  id: string;
  name?: string;
  status?: "active" | "idle";
};

export type RemoteViewport = {
  userId: string;
  scrollX: number;
  scrollY: number;
  zoom: number;
};

export type PresencePayload = {
  userId: string;
  status: "active" | "idle";
  name?: string;
};

export type FollowPayload = {
  userId: string;
  targetId: string | null;
};

const CURSOR_EVENT = "rassam-remote-cursor";
const USERS_EVENT = "rassam-collab-users";
const VIEWPORT_EVENT = "rassam-remote-viewport";
const PRESENCE_EVENT = "rassam-collab-presence";
const FOLLOW_EVENT = "rassam-collab-follow";

function emit<T>(type: string, detail: T) {
  window.dispatchEvent(new CustomEvent(type, { detail }));
}

function on<T>(type: string, handler: (detail: T) => void): () => void {
  const fn = (e: Event) => {
    const detail = (e as CustomEvent<T>).detail;
    if (detail !== undefined) {
      handler(detail);
    }
  };
  window.addEventListener(type, fn);
  return () => window.removeEventListener(type, fn);
}

export type ChatMessage = {
  userId: string;
  name?: string;
  text: string;
  ts: number;
};

const CHAT_EVENT = "rassam-collab-chat";

export function emitChat(m: ChatMessage): void {
  emit(CHAT_EVENT, m);
}

export function onChat(handler: (m: ChatMessage) => void): () => void {
  return on(CHAT_EVENT, handler);
}

export const emitRemoteCursor = (c: RemoteCursor) => emit(CURSOR_EVENT, c);
export const emitCollabUsers = (u: CollabUser[] | string[]) =>
  emit(USERS_EVENT, u);
export const emitRemoteViewport = (v: RemoteViewport) => emit(VIEWPORT_EVENT, v);
export const emitPresence = (p: PresencePayload) => emit(PRESENCE_EVENT, p);
export const emitFollow = (f: FollowPayload) => emit(FOLLOW_EVENT, f);

export const onRemoteCursor = (h: (c: RemoteCursor) => void) =>
  on(CURSOR_EVENT, h);
export const onCollabUsers = (h: (u: CollabUser[] | string[]) => void) =>
  on(USERS_EVENT, h);
export const onRemoteViewport = (h: (v: RemoteViewport) => void) =>
  on(VIEWPORT_EVENT, h);
export const onPresence = (h: (p: PresencePayload) => void) =>
  on(PRESENCE_EVENT, h);
export const onFollow = (h: (f: FollowPayload) => void) => on(FOLLOW_EVENT, h);
