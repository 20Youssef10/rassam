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
const CORS_ORIGIN = process.env.CORS_ORIGIN || "";
const ALLOWED_ORIGINS = CORS_ORIGIN.split(",")
  .map((s) => s.trim())
  .filter(Boolean)
  .filter((s) => s !== "*");
const ALLOW_ALL_CORS = CORS_ORIGIN.trim() === "*";
const TRUST_PROXY = process.env.TRUST_PROXY === "true";
const STORAGE_URI = process.env.STORAGE_URI || "filesystem:///data";
const MAX_BYTES = Number(process.env.STORAGE_MAX_BYTES || 8 * 1024 * 1024);
function loadAuthTokens() {
  const fromEnv = String(
    process.env.STORAGE_AUTH_TOKENS ||
      process.env.STORAGE_AUTH_TOKEN ||
      "",
  )
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  // Docker secrets / file-based token (avoids `docker inspect` exposure).
  const filePath = process.env.STORAGE_AUTH_TOKEN_FILE;
  if (filePath) {
    try {
      const fs = require("fs");
      const content = fs.readFileSync(filePath, "utf8").trim();
      if (content) return content.split(",").map((t) => t.trim()).filter(Boolean);
    } catch {
      // ignore — fall through to open
    }
  }
  return [];
}
const AUTH_TOKENS = loadAuthTokens();
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
  if (TRUST_PROXY) {
    const fwd = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
    if (fwd) return fwd.slice(0, 64);
  }
  return (req.socket.remoteAddress || "unknown").replace(/^::ffff:/, "");
}

function rateLimited(req, res) {
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
  // Evict expired buckets to bound memory.
  if (writeBuckets.size > 2000) {
    for (const [k, v] of writeBuckets) {
      if (now > v.resetAt) writeBuckets.delete(k);
      if (writeBuckets.size <= 1000) break;
    }
  }
  if (bucket.count > WRITE_RATE_LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
    try {
      res.setHeader("Retry-After", String(retryAfter));
    } catch {
      // ignore
    }
    return true;
  }
  return false;
}

function extractToken(req) {
  const header = req.headers.authorization || "";
  if (header.startsWith("Bearer ")) {
    return header.slice(7).trim();
  }
  return String(req.headers["x-rassam-token"] || "").trim();
}

function timingSafeEqualStr(a, b) {
  // Constant-time even for differing lengths: compare SHA-256 digests.
  const ha = crypto.createHash("sha256").update(String(a)).digest();
  const hb = crypto.createHash("sha256").update(String(b)).digest();
  if (ha.length !== hb.length) {
    return false;
  }
  return crypto.timingSafeEqual(ha, hb);
}

function authOk(req) {
  if (!AUTH_TOKENS.length) {
    return true;
  }
  const provided = extractToken(req);
  return AUTH_TOKENS.some((token) => timingSafeEqualStr(provided, token));
}

function cors(req, res) {
  const origin = String(req.headers.origin || "");
  if (ALLOW_ALL_CORS) {
    res.setHeader("Access-Control-Allow-Origin", "*");
  } else if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else if (ALLOWED_ORIGINS.length === 1) {
    res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGINS[0]);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,OPTIONS");
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, X-Rassam-Token",
  );
}

function securityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
}

function json(req, res, status, body) {
  cors(req, res);
  securityHeaders(res);
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
  cors(req, res);
  securityHeaders(res);
  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const p = url.pathname;

  if (p === "/health" || p === "/") {
    json(req, res, 200, {
      service: "rassam-storage",
      status: "ok",
      driver: driver.kind,
      authRequired: AUTH_TOKENS.length > 0,
    });
    return;
  }

  const isWrite = req.method === "POST" || req.method === "PUT";
  if (isWrite) {
    if (!authOk(req)) {
      json(req, res, 401, { error: "unauthorized" });
      return;
    }
    if (rateLimited(req, res)) {
      json(req, res, 429, { error: "rate_limited" });
      return;
    }
  } else if (req.method === "GET" && REQUIRE_AUTH_READ && AUTH_TOKENS.length) {
    if (!authOk(req)) {
      json(req, res, 401, { error: "unauthorized" });
      return;
    }
  }

  if (req.method === "POST" && p === "/api/scenes") {
    try {
      const body = await readBody(req);
      const parsed = JSON.parse(body.toString("utf8"));
      if (!parsed.c || !parsed.iv) {
        json(req, res, 400, { error: "invalid_payload" });
        return;
      }
      const id = crypto.randomBytes(10).toString("hex");
      await driver.putJson("scenes", id, parsed);
      json(req, res, 200, { id });
    } catch (e) {
      if (e.message === "too_large") {
        json(req, res, 413, { error: "too_large" });
        return;
      }
      json(req, res, 500, { error: "save_failed" });
    }
    return;
  }

  if (req.method === "GET" && p.startsWith("/api/scenes/")) {
    const id = p.slice("/api/scenes/".length);
    if (!safeId(id)) {
      json(req, res, 400, { error: "invalid_id" });
      return;
    }
    try {
      const data = await driver.getJson("scenes", id);
      if (!data) {
        json(req, res, 404, { error: "not_found" });
        return;
      }
      json(req, res, 200, data);
    } catch {
      json(req, res, 500, { error: "load_failed" });
    }
    return;
  }

  const roomMatch = p.match(/^\/api\/rooms\/([A-Za-z0-9_-]+)\/scene\/?$/);
  if (roomMatch) {
    const roomId = roomMatch[1];
    if (!safeId(roomId)) {
      json(req, res, 400, { error: "invalid_room" });
      return;
    }
    if (req.method === "GET") {
      try {
        const data = await driver.getJson("rooms", roomId);
        if (!data) {
          json(req, res, 404, { error: "not_found" });
          return;
        }
        json(req, res, 200, data);
      } catch {
        json(req, res, 500, { error: "load_failed" });
      }
      return;
    }
    if (isWrite) {
      try {
        const body = await readBody(req);
        const text = body.toString("utf8");
        const parsed = JSON.parse(text);
        await driver.putJson("rooms", roomId, parsed);
        json(req, res, 200, { ok: true });
      } catch (e) {
        if (e.message === "too_large") {
          json(req, res, 413, { error: "too_large" });
          return;
        }
        json(req, res, 400, { error: "invalid_json" });
      }
      return;
    }
  }

  if (p === "/api/library" || p.startsWith("/api/library?")) {
    const userId = url.searchParams.get("user") || "default";
    if (!safeId(userId)) {
      json(req, res, 400, { error: "invalid_user" });
      return;
    }
    if (req.method === "GET") {
      try {
        const data = await driver.getJson("library", userId);
        json(req, res, 200, { items: data?.items ?? [] });
      } catch {
        json(req, res, 200, { items: [] });
      }
      return;
    }
    if (isWrite) {
      try {
        const body = await readBody(req);
        const parsed = JSON.parse(body.toString("utf8"));
        const uid = parsed.userId && safeId(parsed.userId) ? parsed.userId : userId;
        const items = Array.isArray(parsed.items) ? parsed.items.slice(0, 500) : [];
        await driver.putJson("library", uid, { items, updatedAt: Date.now() });
        json(req, res, 200, { ok: true, count: items.length });
      } catch (e) {
        if (e.message === "too_large") {
          json(req, res, 413, { error: "too_large" });
          return;
        }
        json(req, res, 400, { error: "invalid_json" });
      }
      return;
    }
  }

  if (p.startsWith("/api/files/")) {
    const rel = p.replace(/^\/api\/files\/+/, "");
    const parts = rel.split("/").filter(Boolean);
    if (!parts.length || parts.some((s) => !safeFileSegment(s))) {
      json(req, res, 400, { error: "invalid_path" });
      return;
    }
    const key = parts.join("/");
    if (key.length > 512) {
      json(req, res, 400, { error: "invalid_path" });
      return;
    }
    if (req.method === "GET") {
      try {
        const buf = await driver.getBuffer("files", key);
        if (!buf) {
          json(req, res, 404, { error: "not_found" });
          return;
        }
        cors(req, res);
        securityHeaders(res);
        res.writeHead(200, {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": 'attachment; filename="download.bin"',
          "Content-Security-Policy": "default-src 'none'",
        });
        res.end(buf);
      } catch {
        json(req, res, 500, { error: "load_failed" });
      }
      return;
    }
    if (isWrite) {
      try {
        const body = await readBody(req);
        await driver.putBuffer("files", key, body);
        json(req, res, 200, { ok: true });
      } catch (e) {
        if (e.message === "too_large") {
          json(req, res, 413, { error: "too_large" });
          return;
        }
        json(req, res, 500, { error: "upload_failed" });
      }
      return;
    }
  }

  json(req, res, 404, { error: "not_found" });
}

http.createServer((req, res) => {
  handle(req, res).catch(() => {
    try {
      json(req, res, 500, { error: "internal" });
    } catch {
      try {
        res.end();
      } catch {
        // ignore
      }
    }
  });
}).listen(PORT, () => {
  if (!AUTH_TOKENS.length) {
    console.warn("[rassam-storage] WARNING: no auth tokens configured — writes are open. Set STORAGE_AUTH_TOKEN in production.");
  }
  if (ALLOW_ALL_CORS && AUTH_TOKENS.length) {
    console.warn("[rassam-storage] WARNING: CORS_ORIGIN=* with auth enabled. Set explicit CORS_ORIGIN in production.");
  }
  console.log(
    `[rassam-storage] :${PORT} driver=${driver.kind} auth=${
      AUTH_TOKENS.length ? "required" : "open"
    }`,
  );
});
