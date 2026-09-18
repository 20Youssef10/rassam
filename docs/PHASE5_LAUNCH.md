# Rassam — Phase 5 launch notes

## Brand assets

| Variant | Files |
|---------|--------|
| Light (primary) | `public/icon.svg`, `public/icon-192.png`, `public/icon-512.png` |
| Dark | `public/icon-dark.svg`, `public/icon-dark.png` |
| Monochrome | `public/icon-mono.svg`, `public/icon-mono.png` |
| Lockup | `public/brand/lockup-1536.png` |

Palette: Blue `#2563EB` · Teal `#0D9488` · Navy `#0F172A` · Sand `#F5F0E6`.

## GitHub

Repo: `https://github.com/20Youssef10/rassam`

```bash
cd D:\rassam-greenfield
git remote add origin https://github.com/20Youssef10/rassam.git
git push -u origin main
git tag v0.1.0 && git push origin v0.1.0
```

Tag `v*` triggers **GHCR** image publish:

- `ghcr.io/20youssef10/rassam/web`
- `ghcr.io/20youssef10/rassam/room`
- `ghcr.io/20youssef10/rassam/storage`

## Docker Compose with GHCR

```yaml
# docker-compose.ghcr.yml (excerpt)
services:
  web:
    image: ghcr.io/20youssef10/rassam/web:latest
  room:
    image: ghcr.io/20youssef10/rassam/room:latest
  storage:
    image: ghcr.io/20youssef10/rassam/storage:latest
```

## npm (`@rassam/excalidraw`)

Skeleton lives in `packages/rassam-excalidraw/`. Publish when ready:

```bash
cd packages/rassam-excalidraw
# set name/version, then
npm publish --access public
```

## Security for launch

- Never commit `.env` / API keys
- Set `STORAGE_AUTH_TOKENS` in production
- TLS via reverse proxy (see docs/SELF_HOSTING.md)

## Verify after push

```bash
gh repo view 20Youssef10/rassam
gh run list --repo 20Youssef10/rassam
```
