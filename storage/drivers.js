/**
 * Pluggable blob storage drivers for Rassam.
 * Kind is selected via STORAGE_URI:
 *   filesystem:///data
 *   memory://
 *   s3://bucket/prefix   (S3-compatible HTTP API via env)
 */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

function parseUri(uri) {
  const m = String(uri || "filesystem:///data").match(/^([a-z]+):\/\/(.*)$/i);
  if (!m) {
    return { kind: "filesystem", rest: "data" };
  }
  return { kind: m[1].toLowerCase(), rest: m[2] };
}

function safeJoin(root, ...parts) {
  const file = path.join(root, ...parts);
  if (!file.startsWith(root)) {
    throw new Error("path_escape");
  }
  return file;
}

function createFilesystemDriver(rest) {
  const root = path.resolve(rest.replace(/^\/+/, "") || "data");
  for (const dir of ["scenes", "rooms", "files", "library"]) {
    fs.mkdirSync(path.join(root, dir), { recursive: true });
  }
  const bucket = (...segs) => safeJoin(root, ...segs.filter(Boolean));
  return {
    kind: "filesystem",
    root,
    async putJson(namespace, id, data) {
      const file = bucket(namespace, `${id}.json`);
      fs.writeFileSync(file, JSON.stringify(data));
      return { id };
    },
    async getJson(namespace, id) {
      const file = bucket(namespace, `${id}.json`);
      if (!fs.existsSync(file)) {
        return null;
      }
      return JSON.parse(fs.readFileSync(file, "utf8"));
    },
    async putBuffer(namespace, key, buf) {
      const parts = key.split("/").filter(Boolean);
      const file = bucket(namespace, ...parts);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, buf);
      return { ok: true };
    },
    async getBuffer(namespace, key) {
      const parts = key.split("/").filter(Boolean);
      const file = bucket(namespace, ...parts);
      if (!fs.existsSync(file)) {
        return null;
      }
      return fs.readFileSync(file);
    },
  };
}

function createMemoryDriver() {
  const store = new Map();
  return {
    kind: "memory",
    root: "memory://",
    async putJson(namespace, id, data) {
      store.set(`${namespace}/${id}`, JSON.stringify(data));
      return { id };
    },
    async getJson(namespace, id) {
      const raw = store.get(`${namespace}/${id}`);
      return raw ? JSON.parse(raw) : null;
    },
    async putBuffer(namespace, key, buf) {
      store.set(`${namespace}/${key}`, buf);
      return { ok: true };
    },
    async getBuffer(namespace, key) {
      const val = store.get(`${namespace}/${key}`);
      return val ?? null;
    },
  };
}

/**
 * Minimal S3-compatible driver (MinIO, R2, AWS) using REST.
 * Env: S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY, S3_SECRET_KEY,
 *      S3_FORCE_PATH_STYLE=true (MinIO)
 * Uses AWS SigV4 (implemented compactly for PUT/GET object).
 */
function createS3Driver(rest) {
  const endpoint = (process.env.S3_ENDPOINT || "").replace(/\/$/, "");
  const bucketName = process.env.S3_BUCKET || rest.replace(/^\/+/, "").split("/")[0] || "";
  const prefix = (rest.split("/").slice(1).join("/") || process.env.S3_PREFIX || "").replace(/^\/+|\/+$/g, "");
  const accessKey = process.env.S3_ACCESS_KEY || "";
  const secretKey = process.env.S3_SECRET_KEY || "";
  const region = process.env.S3_REGION || "us-east-1";
  const pathStyle = process.env.S3_FORCE_PATH_STYLE !== "false";

  if (!endpoint || !bucketName || !accessKey || !secretKey) {
    throw new Error("s3_config_missing");
  }

  const keyFor = (namespace, id) =>
    [prefix, namespace, id].filter(Boolean).join("/");

  function hmac(key, data) {
    return crypto.createHmac("sha256", key).update(data).digest();
  }
  function sha256hex(data) {
    return crypto.createHash("sha256").update(data).digest("hex");
  }

  async function s3Request(method, objectKey, body, contentType) {
    const host = endpoint.replace(/^https?:\/\//, "");
    const proto = endpoint.startsWith("http://") ? "http" : "https";
    const url = pathStyle
      ? `${proto}://${host}/${bucketName}/${objectKey}`
      : `${proto}://${bucketName}.${host}/${objectKey}`;
    const now = new Date();
    const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const payloadHash = sha256hex(body || "");
    const canonicalUri = pathStyle
      ? `/${bucketName}/${objectKey}`
      : `/${objectKey}`;
    const canonicalHeaders =
      `host:${host}\n` +
      `x-amz-content-sha256:${payloadHash}\n` +
      `x-amz-date:${amzDate}\n`;
    const signedHeaders = "host;x-amz-content-sha256;x-amz-date";
    const canonicalRequest = [
      method,
      canonicalUri,
      "",
      canonicalHeaders,
      signedHeaders,
      payloadHash,
    ].join("\n");
    const scope = `${dateStamp}/${region}/s3/aws4_request`;
    const stringToSign = [
      "AWS4-HMAC-SHA256",
      amzDate,
      scope,
      sha256hex(canonicalRequest),
    ].join("\n");
    const kDate = hmac(`AWS4${secretKey}`, dateStamp);
    const kRegion = hmac(kDate, region);
    const kService = hmac(kRegion, "s3");
    const kSigning = hmac(kService, "aws4_request");
    const signature = crypto
      .createHmac("sha256", kSigning)
      .update(stringToSign)
      .digest("hex");
    const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;

    const res = await fetch(url, {
      method,
      headers: {
        Host: host,
        "x-amz-content-sha256": payloadHash,
        "x-amz-date": amzDate,
        Authorization: authorization,
        ...(contentType ? { "Content-Type": contentType } : {}),
      },
      body: body || undefined,
    });
    return res;
  }

  return {
    kind: "s3",
    root: `s3://${bucketName}/${prefix}`,
    async putJson(namespace, id, data) {
      const objectKey = keyFor(namespace, `${id}.json`);
      const body = JSON.stringify(data);
      const res = await s3Request("PUT", objectKey, body, "application/json");
      if (!res.ok) {
        throw new Error(`s3_put_${res.status}`);
      }
      return { id };
    },
    async getJson(namespace, id) {
      const objectKey = keyFor(namespace, `${id}.json`);
      const res = await s3Request("GET", objectKey);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`s3_get_${res.status}`);
      }
      return res.json();
    },
    async putBuffer(namespace, key, buf) {
      const objectKey = keyFor(namespace, key);
      const res = await s3Request(
        "PUT",
        objectKey,
        buf,
        "application/octet-stream",
      );
      if (!res.ok) {
        throw new Error(`s3_put_${res.status}`);
      }
      return { ok: true };
    },
    async getBuffer(namespace, key) {
      const objectKey = keyFor(namespace, key);
      const res = await s3Request("GET", objectKey);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error(`s3_get_${res.status}`);
      }
      const ab = await res.arrayBuffer();
      return Buffer.from(ab);
    },
  };
}

/**
 * Postgres driver via optional `pg` if installed; otherwise a JSON-file
 * "postgres" fallback is rejected — we document installing `pg`.
 * Env: DATABASE_URL=postgres://user:pass@host:5432/db
 */
function createPostgresDriver() {
  let pg;
  try {
    pg = require("pg");
  } catch {
    throw new Error("postgres_driver_requires_pg_package");
  }
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  let ready = null;

  async function ensureSchema() {
    if (!ready) {
      ready = pool.query(`
        CREATE TABLE IF NOT EXISTS rassam_blobs (
          namespace TEXT NOT NULL,
          id TEXT NOT NULL,
          data BYTEA NOT NULL,
          is_json BOOLEAN NOT NULL DEFAULT true,
          PRIMARY KEY (namespace, id)
        );
      `);
    }
    return ready;
  }

  return {
    kind: "postgres",
    root: process.env.DATABASE_URL ? "postgres://…" : "postgres://",
    async putJson(namespace, id, data) {
      await ensureSchema();
      await pool.query(
        `INSERT INTO rassam_blobs (namespace, id, data, is_json)
         VALUES ($1, $2, $3, true)
         ON CONFLICT (namespace, id) DO UPDATE SET data = EXCLUDED.data`,
        [namespace, id, Buffer.from(JSON.stringify(data))],
      );
      return { id };
    },
    async getJson(namespace, id) {
      await ensureSchema();
      const res = await pool.query(
        `SELECT data FROM rassam_blobs WHERE namespace=$1 AND id=$2`,
        [namespace, id],
      );
      if (!res.rows.length) {
        return null;
      }
      return JSON.parse(res.rows[0].data.toString("utf8"));
    },
    async putBuffer(namespace, key, buf) {
      await ensureSchema();
      await pool.query(
        `INSERT INTO rassam_blobs (namespace, id, data, is_json)
         VALUES ($1, $2, $3, false)
         ON CONFLICT (namespace, id) DO UPDATE SET data = EXCLUDED.data`,
        [namespace, key, buf],
      );
      return { ok: true };
    },
    async getBuffer(namespace, key) {
      await ensureSchema();
      const res = await pool.query(
        `SELECT data FROM rassam_blobs WHERE namespace=$1 AND id=$2`,
        [namespace, key],
      );
      return res.rows[0]?.data ?? null;
    },
  };
}

function createDriver(uri) {
  const { kind, rest } = parseUri(uri);
  if (kind === "memory") {
    return createMemoryDriver();
  }
  if (kind === "s3") {
    return createS3Driver(rest);
  }
  if (kind === "postgres" || kind === "postgresql") {
    return createPostgresDriver();
  }
  return createFilesystemDriver(rest);
}

module.exports = { createDriver, parseUri };
