# Self-Hosting Guide — رسَّام (Rassam)

## Overview

Rassam is designed to be fully self-hosted. A single Docker Compose file brings up:

1. Frontend (static assets + PWA)
2. Room server (real-time collaboration)
3. Storage backend (scenes + files)

No dependency on Excalidraw’s cloud services is required.

## Quick Start (Docker Compose)

```bash
git clone https://github.com/20Youssef10/rassam.git
cd rassam
cp .env.example .env
# edit .env with your domain and secrets
docker compose up -d
```

Open `https://your-domain` and start drawing.

## Services

| Service        | Port (internal) | Responsibility                          |
|----------------|-----------------|-----------------------------------------|
| frontend       | 80              | Serves the PWA / editor                 |
| room           | 3002 (example)  | WebSocket collaboration                 |
| storage        | 8080 (example)  | HTTP API for scenes and binary files    |

A reverse proxy (Traefik, Nginx, Caddy) terminates TLS and routes:

- `/` → frontend
- `/socket.io` or `/ws` → room server
- `/api` → storage backend

## Configuration

Key environment variables (names may be adjusted in the actual implementation):

```env
# Frontend
VITE_APP_WS_SERVER_URL=https://your-domain/ws
VITE_APP_STORAGE_BACKEND_URL=https://your-domain/api
VITE_APP_FIREBASE_CONFIG={}          # disabled
VITE_APP_BACKEND_V2_GET_URL=...
VITE_APP_BACKEND_V2_POST_URL=...

# Room server
CORS_ORIGIN=https://your-domain

# Storage
STORAGE_URI=filesystem:///data       # or s3://, postgres://, etc.
```

## Storage Options

- Filesystem (simplest)
- S3-compatible (MinIO, AWS S3, Cloudflare R2, …)
- SQLite / PostgreSQL (for metadata + optional blobs)

Choose according to your durability and scaling needs.

## TLS & Domains

- Use a real domain and valid certificates (Let’s Encrypt via Traefik/Caddy is recommended).
- Collaboration and clipboard features work best over HTTPS.

## Offline / Air-gapped

- All fonts and assets are self-hosted.
- Set the asset path so the frontend never reaches external CDNs.
- Collaboration still requires the room server; pure offline editing works via the PWA + local storage.

## Updating

```bash
git pull
docker compose build --pull
docker compose up -d
```

Always back up the storage volume before major upgrades.

## Security Notes

- Keep the room server and storage backend on a private network when possible; expose only through the reverse proxy.
- Use strong random values for any signing secrets.
- E2E encryption means the server cannot read scene content when users share via room links; still protect the storage backend with authentication if you store persistent scenes.

## Example Traefik Labels (illustrative)

```yaml
labels:
  - "traefik.enable=true"
  - "traefik.http.routers.rassam.rule=Host(`draw.example.com`)"
  - "traefik.http.routers.rassam.entrypoints=websecure"
  - "traefik.http.routers.rassam.tls.certresolver=letsencrypt"
```

Exact labels depend on your Traefik version and file layout.

## Support

See the main repository issues and [CONTRIBUTING.md](./CONTRIBUTING.md) for help with self-hosting problems.