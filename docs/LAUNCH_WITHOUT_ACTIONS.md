# Launch without GitHub Actions (billing)

GitHub Actions cannot run on this account (billing). Use **local CI** and **manual GHCR push** instead.

## 1. Remove unknown contributor `rassam`

The first commit was authored as `Rassam <rassam@users.noreply.github.com>`, which GitHub maps to user [rassam](https://github.com/rassam). History is rewritten to `20Youssef10` and force-pushed.

## 2. Local CI (every change)

```bash
cd D:\rassam-greenfield
node scripts/local-ci.cjs
```

Runs: `npm ci` · `typecheck` · `build` · syntax checks on room/storage.

## 3. Manual image publish (GHCR — no Actions)

```bash
# Docker Desktop must be running
bash scripts/publish-ghcr.sh v0.1.0
```

Uses `gh auth token` + `docker login ghcr.io`. Pushes:

- `ghcr.io/20youssef10/rassam/web`
- `ghcr.io/20youssef10/rassam/room`
- `ghcr.io/20youssef10/rassam/storage`

## 4. Git push (code only)

```bash
git -C D:\rassam-greenfield push origin main
git -C D:\rassam-greenfield push origin v0.1.0 --force  # if tag rewritten
```

## 5. Workflows on disk

`.github/workflows/*.yml` remain for when billing is fixed — they can stay unused until then.

## 6. Optional npm

Publish `packages/rassam-excalidraw` only if you have an npm account with publish rights (does not use GitHub Actions).
