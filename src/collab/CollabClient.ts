import { io, type Socket } from "socket.io-client";

import type { FilePayload, RassamElement } from "../core/types";
import {
  decryptJSON,
  encryptJSON,
  type EncryptedPayload,
} from "./crypto";
import {
  emitChat,
  emitCollabUsers,
  emitFollow,
  emitPresence,
  emitRemoteCursor,
  emitRemoteViewport,
  type CollabUser,
} from "./events";

import { mergeOps, opsFromState, type CrdtOp, type CrdtState } from "../core/crdt";

export const WS_EVENTS = {
  JOIN: "join-room",
  INIT: "init-room",
  NEW_USER: "new-user",
  USERS: "room-user-change",
  SCENE: "scene-broadcast",
  CURSOR: "cursor-broadcast",
  CLIENT_SCENE: "client-scene",
  CLIENT_CURSOR: "client-cursor",
  CLIENT_VIEWPORT: "client-viewport",
  VIEWPORT: "viewport-broadcast",
  CLIENT_PRESENCE: "client-presence",
  PRESENCE: "presence-broadcast",
  CLIENT_FOLLOW: "client-follow",
  FOLLOW: "follow-broadcast",
  CLIENT_CHAT: "client-chat",
  CHAT: "chat-broadcast",
  CLIENT_CRDT: "client-crdt",
  CRDT: "crdt-broadcast",
} as const;

export type SceneBroadcast = {
  elements: RassamElement[];
  files?: Record<string, FilePayload>;
  ts: number;
  author: string;
};

export type CollabStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "error"
  | "read-only";

export type CollabCallbacks = {
  onStatus: (status: CollabStatus, detail?: string) => void;
  onUsers: (users: CollabUser[]) => void;
  onScene: (scene: SceneBroadcast) => void;
  onCursor: (payload: { userId: string; x: number; y: number; name?: string }) => void;
  onViewport?: (v: { userId: string; scrollX: number; scrollY: number; zoom: number }) => void;
};

export class CollabClient {
  private socket: Socket | null = null;
  private roomId: string | null = null;
  private roomKey: string | null = null;
  private userId = `u_${Math.random().toString(36).slice(2, 10)}`;
  private userName: string | undefined;
  private readOnly = false;
  private lastSceneTs = 0;
  private users: CollabUser[] = [];
  private following: string | null = null;
  private crdt: CrdtState | null = null;
  private onCrdtMerged: ((elements: unknown[]) => void) | null = null;

  setCrdt(state: CrdtState, onMerged: (elements: unknown[]) => void) {
    this.crdt = state;
    this.onCrdtMerged = onMerged;
  }

  async broadcastCrdtOps(ops: CrdtOp[]) {
    if (!this.socket || !this.roomId || !this.roomKey || this.readOnly || !ops.length) {
      return;
    }
    const encrypted = await encryptJSON(ops, this.roomKey);
    this.socket.emit(WS_EVENTS.CLIENT_CRDT, this.roomId, encrypted);
  }

  constructor(private callbacks: CollabCallbacks) {}

  get id() {
    return this.userId;
  }

  get room() {
    return this.roomId;
  }

  get isReadOnly() {
    return this.readOnly;
  }

  get connected() {
    return !!this.socket?.connected;
  }

  get roomUsers() {
    return this.users;
  }

  get followingId() {
    return this.following;
  }

  setUserName(name: string) {
    this.userName = name || this.userName;
  }

  async connect(options: {
    url: string;
    roomId: string;
    roomKey: string;
    readOnly?: boolean;
    userId?: string;
    userName?: string;
  }) {
    this.disconnect();
    this.roomId = options.roomId;
    this.roomKey = options.roomKey;
    this.readOnly = !!options.readOnly;
    if (options.userId) {
      this.userId = options.userId;
    }
    if (options.userName) {
      this.userName = options.userName;
    }
    this.callbacks.onStatus(this.readOnly ? "read-only" : "connecting");

    this.socket = io(options.url, {
      transports: ["websocket", "polling"],
      autoConnect: true,
    });

    this.socket.on("connect", () => {
      this.socket?.emit(WS_EVENTS.JOIN, this.roomId, this.userId, this.userName);
      this.callbacks.onStatus(this.readOnly ? "read-only" : "connected");
    });

    this.socket.on("connect_error", (err: Error) => {
      this.callbacks.onStatus("error", err.message);
    });

    this.socket.on(WS_EVENTS.USERS, (raw: unknown) => {
      const list = (Array.isArray(raw) ? raw : []).map((u) => {
        if (typeof u === "string") {
          return { id: u } as CollabUser;
        }
        return u as CollabUser;
      });
      this.users = list;
      this.callbacks.onUsers(list);
      emitCollabUsers(list);
    });

    this.socket.on(WS_EVENTS.SCENE, async (payload: EncryptedPayload) => {
      if (!this.roomKey) {
        return;
      }
      try {
        const scene = await decryptJSON<SceneBroadcast>(payload, this.roomKey);
        if (scene.author !== this.userId && scene.ts >= this.lastSceneTs) {
          this.lastSceneTs = scene.ts;
          this.callbacks.onScene(scene);
        }
      } catch (error) {
        console.warn("Rassam collab: failed to decrypt scene", error);
      }
    });

    this.socket.on(WS_EVENTS.CURSOR, async (payload: EncryptedPayload) => {
      if (!this.roomKey) {
        return;
      }
      try {
        const data = await decryptJSON<{
          userId: string;
          x: number;
          y: number;
          name?: string;
        }>(payload, this.roomKey);
        if (data.userId !== this.userId) {
          emitRemoteCursor(data);
          this.callbacks.onCursor(data);
        }
      } catch {
        // ignore
      }
    });

    this.socket.on(WS_EVENTS.VIEWPORT, async (payload: EncryptedPayload) => {
      if (!this.roomKey) {
        return;
      }
      try {
        const data = await decryptJSON<{
          userId: string;
          scrollX: number;
          scrollY: number;
          zoom: number;
        }>(payload, this.roomKey);
        if (data.userId !== this.userId) {
          emitRemoteViewport(data);
          this.callbacks.onViewport?.(data);
        }
      } catch {
        // ignore
      }
    });

    this.socket.on(WS_EVENTS.PRESENCE, async (payload: EncryptedPayload) => {
      if (!this.roomKey || !payload || typeof payload !== "object") {
        return;
      }
      try {
        const data = await decryptJSON<{
          userId: string;
          status: "active" | "idle";
          name?: string;
        }>(payload, this.roomKey);
        if (data.userId !== this.userId) {
          emitPresence(data);
          this.users = this.users.map((u) =>
            u.id === data.userId
              ? { ...u, status: data.status, name: data.name || u.name }
              : u,
          );
          this.callbacks.onUsers(this.users);
        }
      } catch {
        // plain-text presence may still update roster on server side
      }
    });

    this.socket.on(WS_EVENTS.FOLLOW, async (payload: EncryptedPayload) => {
      if (!this.roomKey || !payload) {
        return;
      }
      try {
        const data = await decryptJSON<{
          userId: string;
          targetId: string | null;
        }>(payload, this.roomKey);
        if (data.userId !== this.userId) {
          emitFollow(data);
        }
      } catch {
        // ignore
      }
    });

    this.socket.on(WS_EVENTS.CHAT, async (payload: EncryptedPayload) => {
      if (!this.roomKey || !payload) {
        return;
      }
      try {
        const data = await decryptJSON<{
          userId: string;
          name?: string;
          text: string;
          ts: number;
        }>(payload, this.roomKey);
        if (data.userId !== this.userId) {
          emitChat(data);
        }
      } catch {
        // ignore
      }
    });

    this.socket.on(WS_EVENTS.CRDT, async (payload: EncryptedPayload) => {
      if (!this.roomKey || !payload || !this.crdt) {
        return;
      }
      try {
        const ops = await decryptJSON<CrdtOp[]>(payload, this.roomKey);
        this.crdt = mergeOps(this.crdt, ops);
        this.onCrdtMerged?.(opsFromState(this.crdt).filter((o) => o.type === "upsert").map((o) => (o as { el: unknown }).el));
      } catch {
        // ignore malformed crdt packets
      }
    });

    return this;
  }

  disconnect() {
    if (this.socket) {
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    this.roomId = null;
    this.roomKey = null;
    this.lastSceneTs = 0;
    this.users = [];
    this.following = null;
  }

  async broadcastScene(
    elements: RassamElement[],
    files?: Record<string, FilePayload>,
  ) {
    if (!this.socket || !this.roomId || !this.roomKey || this.readOnly) {
      return;
    }
    // Only ship files referenced by current elements (sync polish)
    const used = new Set<string>();
    for (const el of elements) {
      if (el.type === "image") {
        used.add(el.fileId);
      }
    }
    const filePayload: Record<string, FilePayload> = {};
    if (files) {
      for (const [id, file] of Object.entries(files)) {
        if (used.has(id)) {
          filePayload[id] = file;
        }
      }
    }
    const payload: SceneBroadcast = {
      elements,
      files: filePayload,
      ts: Date.now(),
      author: this.userId,
    };
    this.lastSceneTs = payload.ts;
    const encrypted = await encryptJSON(payload, this.roomKey);
    this.socket.emit(WS_EVENTS.CLIENT_SCENE, this.roomId, encrypted);
  }

  async broadcastCursor(x: number, y: number, name?: string) {
    if (!this.socket || !this.roomId || !this.roomKey || this.readOnly) {
      return;
    }
    const encrypted = await encryptJSON(
      { userId: this.userId, x, y, name: name ?? this.userName },
      this.roomKey,
    );
    this.socket.emit(WS_EVENTS.CLIENT_CURSOR, this.roomId, encrypted);
  }

  async broadcastViewport(scrollX: number, scrollY: number, zoom: number) {
    if (!this.socket || !this.roomId || !this.roomKey || this.readOnly) {
      return;
    }
    const encrypted = await encryptJSON(
      { userId: this.userId, scrollX, scrollY, zoom },
      this.roomKey,
    );
    this.socket.emit(WS_EVENTS.CLIENT_VIEWPORT, this.roomId, encrypted);
  }

  async broadcastPresence(status: "active" | "idle") {
    if (!this.socket || !this.roomId || !this.roomKey) {
      return;
    }
    // roster hint (server may read name/status for list UI)
    this.socket.emit(WS_EVENTS.CLIENT_PRESENCE, this.roomId, {
      userId: this.userId,
      status,
      name: this.userName,
    });
  }

  async setFollowing(targetId: string | null) {
    this.following = targetId;
    if (!this.socket || !this.roomId || !this.roomKey) {
      return;
    }
    const encrypted = await encryptJSON(
      { userId: this.userId, targetId },
      this.roomKey,
    );
    this.socket.emit(WS_EVENTS.CLIENT_FOLLOW, this.roomId, encrypted);
    emitFollow({ userId: this.userId, targetId });
  }

  async broadcastChat(text: string) {
    if (!this.socket || !this.roomId || !this.roomKey || !text.trim()) {
      return;
    }
    const encrypted = await encryptJSON(
      {
        userId: this.userId,
        name: this.userName,
        text: text.trim(),
        ts: Date.now(),
      },
      this.roomKey,
    );
    this.socket.emit(WS_EVENTS.CLIENT_CHAT, this.roomId, encrypted);
  }
}

/** Storage library namespace for a collab room */
export function roomLibraryKey(roomId: string): string {
  return `room_${roomId}`.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 120);
}
