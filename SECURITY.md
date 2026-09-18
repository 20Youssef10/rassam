# Security notes — Rassam (greenfield)

## Threat model (short)

| Asset | Risk | Mitigation |
|-------|------|------------|
| Scene plaintext | Server reads drawings | **E2E AES-GCM**; room/storage only see ciphertext |
| Room key | Leak via URL/history | Key only in `#hash` (not sent to server); treat share links as secrets |
| Storage writes | Abuse / overwrite | Optional `STORAGE_AUTH_TOKEN`, write rate limit |
| Path traversal | File write outside data dir | Segment allowlist + `path.startsWith(DATA_ROOT)` |
| CORS | Cross-origin abuse | Restrict `CORS_ORIGIN` in production |

## Encryption

- Client generates AES-GCM 256-bit room keys (`src/collab/crypto.ts`).
- Collab + share payloads are `{ c, iv }` base64url; server never decrypts.
- Read-only links: `#share=roomId,key,ro` — client refuses local mutation when `ro`.

## Optional auth hooks

```env
# multi-token (comma-separated) for per-user/team secrets
STORAGE_AUTH_TOKENS=alice-token,bob-token
# or a single token
STORAGE_AUTH_TOKEN=long-random-secret
VITE_RASSAM_AUTH_TOKEN=alice-token
STORAGE_REQUIRE_AUTH_READ=false
```

Writes (`POST`/`PUT`) require `Authorization: Bearer <token>` or `X-Rassam-Token` when tokens are set. Timing-safe compare against every configured token.

Share-link **reads** stay public by default so the key-in-hash model still works; set `STORAGE_REQUIRE_AUTH_READ=true` for private deployments.

## Storage drivers

| URI | Driver | Notes |
|-----|--------|-------|
| `filesystem:///data` | Local disk | Default |
| `memory://` | Process memory | Tests / ephemeral |
| `s3://bucket/prefix` | S3-compatible REST + SigV4 | MinIO/R2/AWS via `S3_*` env |
| `postgres://…` | Postgres `rassam_blobs` | Requires optional `pg` |

## Operational hardening

- Run room + storage on a private network; expose only via reverse proxy + TLS.
- Do not log room keys or ciphertext unnecessarily.
- Backup `STORAGE_URI` volume; treat backups as sensitive.
- Zero analytics in the web client.

## Residual risks

- Anyone with a collab/share link can read/write that room until rotated (new room).
- Local `localStorage` scene is plaintext on the device.
- Token auth is shared-secret, not per-user OAuth — Phase 4+ for teams.
