/**
 * Rassam room server — Socket.IO relay (E2E payloads + presence/follow).
 */
const http = require("http");
const { Server } = require("socket.io");
// Single source of truth: src/collab/ws-events.json (mirrored here for Node).
const WS_EVENTS = require("../src/collab/ws-events.json");

const PORT = Number(process.env.ROOM_PORT || process.env.PORT || 3002);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const ALLOWED_ORIGINS = CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => s !== "*");
const ALLOW_ALL_CORS = CORS_ORIGIN.trim() === "*";
if (ALLOW_ALL_CORS) {
  console.warn("[rassam-room] WARNING: CORS_ORIGIN=* reflects any origin. Set explicit origins in production.");
}

const ROOM_ID_RE = /^[A-Za-z0-9_-]{8,128}$/;
function isValidRoomId(id) {
  return typeof id === "string" && ROOM_ID_RE.test(id);
}
function cleanName(name) {
  return typeof name === "string" ? name.trim().slice(0, 64) : undefined;
}
// Per-IP join throttle: 60 joins/min
const joinBuckets = new Map();
function joinAllowed(ip) {
  const now = Date.now();
  const b = joinBuckets.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > b.resetAt) {
    b.count = 0;
    b.resetAt = now + 60_000;
  }
  b.count += 1;
  joinBuckets.set(ip, b);
  if (joinBuckets.size > 2000) {
    for (const [k, v] of joinBuckets) {
      if (now > v.resetAt) joinBuckets.delete(k);
      if (joinBuckets.size <= 1000) break;
    }
  }
  return b.count <= 60;
}

const httpServer = http.createServer((req, res) => {
  if (req.url === "/health" || req.url === "/") {
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ service: "rassam-room", status: "ok" }));
    return;
  }
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: ALLOW_ALL_CORS ? true : ALLOWED_ORIGINS.length ? ALLOWED_ORIGINS : false,
    methods: ["GET", "POST"],
    credentials: false,
  },
  maxHttpBufferSize: 8e6,
});

/** roomId -> Map<socketId, {id, name, status}> */
const rooms = new Map();
/** roomId -> Map<userId, followTargetId> */
const follows = new Map();

const roomClients = (roomId) => {
  const map = rooms.get(roomId);
  return map ? Array.from(map.values()) : [];
};

const emitUsers = (roomId) => {
  io.to(roomId).emit(WS_EVENTS.USERS, roomClients(roomId));
};

io.on("connection", (socket) => {
  socket.emit(WS_EVENTS.INIT);

  socket.on(WS_EVENTS.JOIN, (roomId, userId, name, readOnly) => {
    if (!isValidRoomId(roomId)) {
      return;
    }
    const ip = (socket.handshake.address || "unknown").replace(/^::ffff:/, "");
    if (!joinAllowed(ip)) {
      return;
    }
    const uid = typeof userId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(userId) ? userId : socket.id;
    const uname = cleanName(name);
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket.id, { id: uid, name: uname, status: "active" });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = uid;
    socket.data.readOnly = readOnly === true;
    socket.to(roomId).emit(WS_EVENTS.NEW_USER, uid);
    emitUsers(roomId);
  });

  const relay = (event, roomId, payload) => {
    if (!isValidRoomId(roomId) || payload == null) {
      return;
    }
    // Enforce membership: only relay to rooms this socket joined.
    if (socket.data.roomId !== roomId || !socket.rooms.has(roomId)) {
      return;
    }
    // Server-enforced read-only: declared read-only sockets cannot write scenes/CRDT/chat.
    if (socket.data.readOnly && (event === WS_EVENTS.SCENE || event === WS_EVENTS.CRDT || event === WS_EVENTS.CHAT)) {
      return;
    }
    // Bound payload size (~1MB JSON) to avoid amplification.
    try {
      if (JSON.stringify(payload).length > 1_000_000) {
        return;
      }
    } catch {
      return;
    }
    socket.to(roomId).emit(event, payload);
  };

  socket.on(WS_EVENTS.CLIENT_SCENE, (roomId, payload) => {
    relay(WS_EVENTS.SCENE, roomId, payload);
  });

  socket.on(WS_EVENTS.CLIENT_CURSOR, (roomId, payload) => {
    relay(WS_EVENTS.CURSOR, roomId, payload);
  });

  socket.on(WS_EVENTS.CLIENT_VIEWPORT, (roomId, payload) => {
    relay(WS_EVENTS.VIEWPORT, roomId, payload);
  });

  socket.on(WS_EVENTS.CLIENT_PRESENCE, (roomId, payload) => {
    const roomIdStr = roomId;
    if (!isValidRoomId(roomIdStr) || !rooms.has(roomIdStr)) {
      relay(WS_EVENTS.PRESENCE, roomId, payload);
      return;
    }
    if (socket.data.roomId !== roomIdStr || !socket.rooms.has(roomIdStr)) {
      return;
    }
    // payload is encrypted; also accept plain status for roster UI.
    // Bind to authenticated socket identity — ignore spoofed userId.
    if (payload && typeof payload === "object" && payload.status && payload.userId) {
      if (payload.userId !== socket.data.userId) {
        return;
      }
      const map = rooms.get(roomIdStr);
      for (const [, user] of map.entries()) {
        if (user.id === payload.userId) {
          user.status = payload.status === "idle" ? "idle" : "active";
          const clean = cleanName(payload.name);
          if (clean) {
            user.name = clean;
          }
        }
      }
      emitUsers(roomIdStr);
    }
    relay(WS_EVENTS.PRESENCE, roomId, payload);
  });

  socket.on(WS_EVENTS.CLIENT_FOLLOW, (roomId, payload) => {
    if (!isValidRoomId(roomId) || !payload || !payload.userId) {
      return;
    }
    if (socket.data.roomId !== roomId || !socket.rooms.has(roomId)) {
      return;
    }
    if (payload.userId !== socket.data.userId) {
      return;
    }
    if (!follows.has(roomId)) {
      follows.set(roomId, new Map());
    }
    follows.get(roomId).set(payload.userId, payload.targetId || null);
    relay(WS_EVENTS.FOLLOW, roomId, payload);
  });

  socket.on(WS_EVENTS.CLIENT_CHAT, (roomId, payload) => {
    relay(WS_EVENTS.CHAT, roomId, payload);
  });

  socket.on(WS_EVENTS.CLIENT_CRDT, (roomId, payload) => {
    relay(WS_EVENTS.CRDT, roomId, payload);
  });

  socket.on("disconnecting", () => {
    const roomId = socket.data.roomId;
    if (!roomId) {
      return;
    }
    const map = rooms.get(roomId);
    if (map) {
      map.delete(socket.id);
      if (map.size === 0) {
        rooms.delete(roomId);
        follows.delete(roomId);
      } else {
        emitUsers(roomId);
      }
    }
  });
});

httpServer.listen(PORT, () => {
  console.log(`[rassam-room] listening on :${PORT}`);
});
