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
import { isValidRoomId } from "../core/security";
import wsEventsJson from "./ws-events.json";

// Single source of truth shared with collab/server.js (which requires
// ../src/collab/ws-events.json). Keep values in the JSON in sync.
export const WS_EVENTS: Record<
  | "JOIN" | "INIT" | "NEW_USER" | "USERS" | "SCENE" | "CURSOR"
  | "CLIENT_SCENE" | "CLIENT_CURSOR" | "CLIENT_VIEWPORT" | "VIEWPORT"
  | "CLIENT_PRESENCE" | "PRESENCE" | "CLIENT_FOLLOW" | "FOLLOW"
  | "CLIENT_CHAT" | "CHAT" | "CLIENT_CRDT" | "CRDT",
  string
> = wsEventsJson;

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
    const clean = String(name || "").trim().slice(0, 64);
    this.userName = clean || this.userName;
  }

  getRoomId(): string | null {
    return this.roomId;
  }

  private onEncrypted<T>(
    event: string,
    handleMessage: (message: T) => void,
    options?: { requireCrdt?: boolean },
  ): void {
    this.socket?.on(event, async (payload: EncryptedPayload) => {
      if (!this.roomKey || !payload) {
        return;
      }
      if (options?.requireCrdt && !this.crdt) {
        return;
      }
      try {
        const message = await decryptJSON<T>(payload, this.roomKey);
        handleMessage(message);
      } catch (error) {
        console.warn(`Rassam collab: ignoring malformed ${event}`, error);
      }
    });
  }

  private handleUsers(raw: unknown): void {
    const list = (Array.isArray(raw) ? raw : []).map((entry) => {
      if (typeof entry === "string") {
        return { id: entry } as CollabUser;
      }
      return entry as CollabUser;
    });
    this.users = list;
    this.callbacks.onUsers(list);
    emitCollabUsers(list);
  }

  async connect(options: {
    url: string;
    roomId: string;
    roomKey: string;
    readOnly?: boolean;
    userId?: string;
    userName?: string;
  }) {
    if (!isValidRoomId(options.roomId)) {
      throw new Error("invalid_room_id");
    }
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
      this.socket?.emit(WS_EVENTS.JOIN, this.roomId, this.userId, this.userName, this.readOnly);
      this.callbacks.onStatus(this.readOnly ? "read-only" : "connected");
    });

    this.socket.on("connect_error", (err: Error) => {
      this.callbacks.onStatus("error", err.message);
    });

    this.socket.on(WS_EVENTS.USERS, (raw: unknown) => this.handleUsers(raw));

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

    this.onEncrypted<{ userId: string; x: number; y: number; name?: string }>(
      WS_EVENTS.CURSOR,
      (cursorMsg) => {
        if (cursorMsg.userId !== this.userId) {
          emitRemoteCursor(cursorMsg);
          this.callbacks.onCursor(cursorMsg);
        }
      },
    );

    this.onEncrypted<{ userId: string; scrollX: number; scrollY: number; zoom: number }>(
      WS_EVENTS.VIEWPORT,
      (viewportMsg) => {
        if (viewportMsg.userId !== this.userId) {
          emitRemoteViewport(viewportMsg);
          this.callbacks.onViewport?.(viewportMsg);
        }
      },
    );

    this.onEncrypted<{ userId: string; status: "active" | "idle"; name?: string }>(
      WS_EVENTS.PRESENCE,
      (presenceMsg) => {
        if (presenceMsg.userId !== this.userId) {
          emitPresence(presenceMsg);
          this.users = this.users.map((u) =>
            u.id === presenceMsg.userId
              ? { ...u, status: presenceMsg.status, name: presenceMsg.name || u.name }
              : u,
          );
          this.callbacks.onUsers(this.users);
        }
      },
    );

    this.onEncrypted<{ userId: string; targetId: string | null }>(
      WS_EVENTS.FOLLOW,
      (followMsg) => {
        if (followMsg.userId !== this.userId) {
          emitFollow(followMsg);
        }
      },
    );

    this.onEncrypted<{ userId: string; name?: string; text: string; ts: number }>(
      WS_EVENTS.CHAT,
      (chatMsg) => {
        if (chatMsg.userId !== this.userId) {
          emitChat(chatMsg);
        }
      },
    );

    this.onEncrypted<CrdtOp[]>(
      WS_EVENTS.CRDT,
      (crdtOps) => {
        if (!this.crdt) {
          return;
        }
        this.crdt = mergeOps(this.crdt, crdtOps);
        this.onCrdtMerged?.(
          opsFromState(this.crdt)
            .filter((o) => o.type === "upsert")
            .map((o) => (o as { el: unknown }).el),
        );
      },
      { requireCrdt: true },
    );

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
    if (!this.socket || !this.roomId || !this.roomKey || !text.trim() || this.readOnly) {
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
