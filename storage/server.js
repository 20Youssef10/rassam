/**
 * Rassam HTTP storage — pluggable drivers + multi-token auth + library API.
 *
 *   GET  /health
 *   POST /api/scenes              → { id }
 *   GET  /api/scenes/:id
 *   POST /api/rooms/:id/scene
 *   GET  /api/rooms/:id/scene
 *   POST/GET /api/files/*
 *   GET  /api/library?user=
 *   POST /api/library
 *
 * Auth: STORAGE_AUTH_TOKEN or STORAGE_AUTH_TOKENS (comma-separated).
 */
const http = require("http");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");
const { createDriver } = require("./drivers");

const PORT = Number(process.env.STORAGE_PORT || process.env.PORT || 8080);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";
const STORAGE_URI = process.env.STORAGE_URI || "filesystem:///data";
const MAX_BYTES = Number(process.env.STORAGE_MAX_BYTES || 8 * 1024 * 1024);
const AUTH_TOKENS = String(
  process.env.STORAGE_AUTH_TOKENS ||
    process.env.STORAGE_AUTH_TOKEN ||
    "",
)
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const WRITE_RATE_LIMIT = Number(process.env.STORAGE_WRITE_RATE_LIMIT || 120);
const REQUIRE_AUTH_READ = process.env.STORAGE_REQUIRE_AUTH_READ === "true";

let driver;
try {
  driver = createDriver(STORAGE_URI);
} catch (error) {
  console.error("[rassam-storage] driver init failed:", error.message);
  process.exit(1);
}

const writeBuckets = new Map();

function clientIp(req) {
  return (req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

function rateLimited(req) {
  if (!WRITE_RATE_LIMIT || WRITE_RATE_LIMIT <= 0) {
    return false;
  }
  const ip = clientIp(req);
  const now = Date.now();
  const bucket = writeBuckets.get(ip) || { count: 0, resetAt: now + 60_000 };
  if (now > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = now + 60_000;
  }
  bucket.count += 1;
  writeBuckets.set(ip, bucket);
  return bucket.count > WRITE_RATE_LIMIT;
}

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return String(req.headers["x-rassam-token"] || "").trim();
}

function timingSafeEqualStr(a, b) {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function authOk(req) {
  if (!AUTH_TOKENS.length) {
    return true;
  }
  const provided = extractToken(req);
  return AUTH_TOKENS.some((token) => timingSafeEqualStr(provided, token));
}

function cors(res) {
  res.setHeader(
    "Access-Control-Allow-Origin",
    CORS_ORIGIN === "*" ? "*" : CORS_ORIGIN.split(",")[0].trim(),
  );
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Rassam-Token",
  );
}

function json(res, status, body) {
  cors(res);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function safeId(id) {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id || "");
}

function safeFileSegment(seg) {
  return (
    /^[A-Za-z0-9_.-]{1,128}$/.test(seg || "") &&
    !seg.includes("..") &&
    seg !== "." &&
    seg !== ".."
  );
}

function readBody(req, max = MAX_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > max) {
        reject(new Error("too_large"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function handle(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = url.pathname;

  if (p === "/health" || p === "/") {
    json(res, 200, {
      service: "rassam-storage",
      status: "ok",
      driver: driver.kind,
      dataRoot: driver.root,
      authRequired: AUTH_TOKENS.length > 0,
      tokens: AUTH_TOKENS.length,
    });
    return;
  }

  const isWrite = req.method === "POST" || req.method === "PUT";
  if (isWrite) {
    if (!authOk(req)) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
    if (rateLimited(req)) {
      json(res, 429, { error: "rate_limited" });
      return;
    }
  } else if (req.method === "GET" && REQUIRE_AUTH_READ && AUTH_TOKENS.length) {
    if (!authOk(req)) {
      json(res, 401, { error: "unauthorized" });
      return;
    }
  }

  if (req.method === "POST" && p === "/api/scenes") {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body.toString("utf8"));
      if (!parsed.c || !parsed.iv) {
        json(res, 400, { error: "invalid_payload" });
        return;
      }
      const id = crypto.randomBytes(10).toString("hex");
      await driver.putJson("scenes", id, parsed);
      json(res, 200, { id });
    } catch (e) {
      if (e.message === "too_large") {
        json(res, 413, { error_class: "RequestTooLargeError" });
        return;
      }
      json(res, 500, { error: "save_failed" });
    }
    return;
  }

  if (req.method === "GET" && p.startsWith("/api/scenes/")) {
    const id = p.slice("/api/scenes/".length);
    if (!safeId(id)) {
      json(res, 400, { error: "invalid_id" });
      return;
    }
    try {
      const data = await driver.getJson("scenes", id);
      if (!data) {
        json(res, 404, { error: "not_found" });
        return;
      }
      json(res, 200, data);
    } catch {
      json(res, 500, { error: "load_failed" });
    }
    return;
  }

  const roomMatch = p.match(/^\/api\/rooms\/([A-Za-z0-9_-]+)\/scene\/?$/);
  if (roomMatch) {
    const roomId = roomMatch[1];
    if (!safeId(roomId)) {
      json(res, 400, { error: "invalid_room" });
      return;
    }
    if (req.method === "GET") {
      try {
        const data = await driver.getJson("rooms", roomId);
        if (!data) {
          json(res, 404, { error: "not_found" });
          return;
        }
        json(res, 200, data);
      } catch {
        json(res, 500, { error: "load_failed" });
      }
      return;
    }
    if (isWrite) {
      try {
        const body = await readBody(req);
        JSON.parse(body.toString("utf8"));
        await driver.putJson("rooms", roomId, JSON.parse(body.toString("utf8")));
        json(res, 200, { ok: true });
      } catch (e) {
        if (e.message === "too_large") {
          json(res, 413, { error_class: "RequestTooLargeError" });
          return;
        }
        json(res, 400, { error: "invalid_json" });
      }
      return;
    }
  }

  if (p === "/api/library" || p.startsWith("/api/library?")) {
    const userId = url.searchParams.get("user") || "default";
    if (!safeId(userId)) {
      json(res, 400, { error: "invalid_user" });
      return;
    }
    if (req.method === "GET") {
      try {
        const data = await driver.getJson("library", userId);
        json(res, 200, { items: data?.items ?? [] });
      } catch {
        json(res, 200, { items: [] });
      }
      return;
    }
    if (isWrite) {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body.toString("utf8"));
        const uid = parsed.userId && safeId(parsed.userId) ? parsed.userId : userId;
        const items = Array.isArray(parsed.items) ? parsed.items : [];
        await driver.putJson("library", uid, { items, updatedAt: Date.now() });
        json(res, 200, { ok: true, count: items.length });
      } catch (e) {
        if (e.message === "too_large") {
          json(res, 413, { error_class: "RequestTooLargeError" });
          return;
        }
        json(res, 400, { error: "invalid_json" });
      }
      return;
    }
  }

  if (p.startsWith("/api/files/")) {
    const rel = p.replace(/^\/api\/files\/+/, "");
    const parts = rel.split("/").filter(Boolean);
    if (!parts.length || parts.some((s) => !safeFileSegment(s))) {
      json(res, 400, { error: "invalid_path" });
      return;
    }
    const key = parts.join("/");
    if (req.method === "GET") {
      try {
        const buf = await driver.getBuffer("files", key);
        if (!buf) {
          json(res, 404, { error: "not_found" });
          return;
        }
        cors(res);
        res.writeHead(200, { "Content-Type": "application/octet-stream" });
        res.end(buf);
      } catch {
        json(res, 500, { error: "load_failed" });
      }
      return;
    }
    if (isWrite) {
      try {
        const body = await readBody(req);
        await driver.putBuffer("files", key, body);
        json(res, 200, { ok: true });
      } catch (e) {
        if (e.message === "too_large") {
          json(res, 413, { error_class: "RequestTooLargeError" });
          return;
        }
        json(res, 500, { error: "upload_failed" });
      }
      return;
    }
  }

  json(res, 404, { error: "not_found" });
}

http.createServer((req, res) => {
  handle(req, res).catch(() => json(res, 500, { error: "internal" }));
}).listen(PORT, () => {
  console.log(
    `[rassam-storage] :${PORT} driver=${driver.kind} auth=${
      AUTH_TOKENS.length ? `${AUTH_TOKENS.length} token(s)` : "open"
    }`,
  );
});
