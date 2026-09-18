/**
 * Rassam room server — Socket.IO relay (E2E payloads + presence/follow).
 */
const http = require("http");
const { Server } = require("socket.io");

const PORT = Number(process.env.ROOM_PORT || process.env.PORT || 3002);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const WS_EVENTS = {
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
};

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
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN.split(","),
    methods: ["GET", "POST"],
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

  socket.on(WS_EVENTS.JOIN, (roomId, userId, name) => {
    if (typeof roomId !== "string" || !roomId) {
      return;
    }
    const uid = typeof userId === "string" && userId ? userId : socket.id;
    const uname = typeof name === "string" && name ? name : undefined;
    if (!rooms.has(roomId)) {
      rooms.set(roomId, new Map());
    }
    rooms.get(roomId).set(socket.id, { id: uid, name: uname, status: "active" });
    socket.join(roomId);
    socket.data.roomId = roomId;
    socket.data.userId = uid;
    socket.to(roomId).emit(WS_EVENTS.NEW_USER, uid);
    emitUsers(roomId);
  });

  const relay = (event, roomId, payload) => {
    if (typeof roomId !== "string" || !roomId || payload == null) {
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
    if (typeof roomIdStr !== "string" || !rooms.has(roomIdStr)) {
      relay(WS_EVENTS.PRESENCE, roomId, payload);
      return;
    }
    // payload is encrypted; also accept plain status for roster UI
    if (payload && typeof payload === "object" && payload.status && payload.userId) {
      const map = rooms.get(roomIdStr);
      for (const [sid, user] of map.entries()) {
        if (user.id === payload.userId) {
          user.status = payload.status;
          if (payload.name) {
            user.name = payload.name;
          }
        }
      }
      emitUsers(roomIdStr);
    }
    relay(WS_EVENTS.PRESENCE, roomId, payload);
  });

  socket.on(WS_EVENTS.CLIENT_FOLLOW, (roomId, payload) => {
    if (typeof roomId !== "string" || !roomId || !payload || !payload.userId) {
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
