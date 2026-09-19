# Security notes — Rassam (greenfield)

## Threat model (short)

| Asset | Risk | Mitigation |
|-------|------|------------|
| Scene plaintext | Server reads drawings | **E2E AES-GCM**; room/storage only see ciphertext |
| Room key | Leak via URL/history | Key only in `#hash` (not sent to server); treat share links as secrets |
| Storage writes | Abuse / overwrite | `STORAGE_AUTH_TOKEN(S)` or `STORAGE_AUTH_TOKEN_FILE`, write rate limit + `Retry-After` |
| Path traversal | File write outside data dir | Segment allowlist + `file !== root && startsWith(root + sep)` |
| CORS | Cross-origin abuse | Same-origin by default; set explicit `CORS_ORIGIN` list in production, never `*` with auth |
| SVG export | Stored XSS via scene fields | Numeric coerce + color allowlist + attr escape + raster-only image `href` |
| Element links | `javascript:/data:` open | Allow `https?/mailto` only, validated on set + open |
| AI keys | Exfil via XSS/extension | In-memory only by default, never persisted; custom `baseUrl` must be `http(s)` |

## Encryption

- Client generates AES-GCM 256-bit room keys (`src/collab/crypto.ts`).
- Collab + share payloads are `{ c, iv }` base64url with shape + key-length validation; server never decrypts.
- Read-only links: `#share=roomId,key,ro` — client refuses local mutation **and** server drops `scene/crdt/chat` from sockets that joined with `readOnly=true`. NOTE: same decryption key is shared, so `ro` is enforced for honest clients only — anyone who flips the flag client-side and rejoins as writer can write. For strong read-only, use a separate room / rotation. Room IDs/keys are validated (`isValidRoomId/Key`).
- Presence roster (`userId/status/name` ≤64 chars) stays plaintext for server roster UI; scene/cursor/viewport/chat/CRDT are E2E encrypted.

## Optional auth hooks

```env
# multi-token (comma-separated) for per-user/team secrets
STORAGE_AUTH_TOKENS=alice-token,bob-token
# or a single token
STORAGE_AUTH_TOKEN=long-random-secret
# preferred in compose/k8s: Docker secret file (one token or comma-separated)
STORAGE_AUTH_TOKEN_FILE=/run/secrets/storage_auth_token
# WARNING: VITE_RASSAM_AUTH_TOKEN is inlined into public JS — treat as identifier, not secret.
# Prefer HttpOnly cookie sessions (client sends credentials:same-origin).
VITE_RASSAM_AUTH_TOKEN=alice-token
STORAGE_REQUIRE_AUTH_READ=false
TRUST_PROXY=false
```

Writes (`POST`/`PUT`) require `Authorization: Bearer <token>` or `X-Rassam-Token` when tokens are set. Constant-time compare via SHA-256 digests.

Share-link **reads** stay public by default so the key-in-hash model still works; set `STORAGE_REQUIRE_AUTH_READ=true` for private deployments.

## Storage drivers

| URI | Driver | Notes |
|-----|--------|-------|
| `filesystem:///data` | Local disk | Default |
| `memory://` | Process memory | Tests / ephemeral |
| `s3://bucket/prefix` | S3-compatible REST + SigV4 | MinIO/R2/AWS via `S3_*` env |
| `postgres://…` | Postgres `rassam_blobs` | Requires optional `pg` |

## Operational hardening

- Run room + storage on a private network; expose only via reverse proxy + TLS. Compose binds `127.0.0.1:3002/8080` by default.
- Set explicit `CORS_ORIGIN=https://app.example.com` (comma-separated allowlist); empty = same-origin only.
- Set `TRUST_PROXY=true` only behind a trusted reverse proxy that strips/spoofs `X-Forwarded-For`.
- S3 driver requires `https:` endpoints except `localhost`; per-segment URL-encoding, `redirect:manual`, 8s timeout.
- Do not log room keys or ciphertext unnecessarily. `/health` returns no paths or token counts.
- Backup `STORAGE_URI` volume; treat backups as sensitive.
- Zero analytics in the web client.

## Residual risks

- Anyone with a collab/share link can read/write that room until rotated (new room).
- Local `localStorage` scene is plaintext on the device.
- Token auth is shared-secret, not per-user OAuth — Phase 4+ for teams.
