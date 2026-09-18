# رسَّام | Rassam

**Arabic-first virtual whiteboard for hand-drawn diagrams** — built **from scratch** (not an Excalidraw fork).

- **GitHub:** https://github.com/20Youssef10/rassam
- **License:** MIT
- **Docs:** [`docs/`](./docs/) · launch: [`docs/PHASE5_LAUNCH.md`](./docs/PHASE5_LAUNCH.md)

Product requirements live in [`docs/`](./docs/) (vision, features, branding, design system, roadmap).

## What's implemented

### Arabic-first core
- Default `ar` + forced RTL UI
- Self-hosted Arabic fonts (`@fontsource`)
- PWA offline shell
- Brand icons: light / **dark** / **monochrome**

### Editor
- Tools, multi-select, resize, images, text, sticky, frames, elbow arrows
- Undo/redo, clipboard, align, z-order, snap guides
- PNG / PNG@2x / SVG / **PDF** export
- Local autosave + snapshots + comments

### Collaboration & self-host
- Room server (Socket.IO) + HTTP storage
- E2E encryption, share + read-only links
- CRDT ops, chat, follow viewport, presence
- Docker Compose + GHCR release workflow

### Platform
- Multi-provider AI (OpenAI, Anthropic, Gemini, Ollama, OpenRouter, OpenAI-compatible)
- Mermaid flowchart + sequence / class / state
- Command palette, plugins, zen/view-only modes

## Develop

```bash
npm install
npm --prefix collab install
npm run start:stack   # room :3002 + storage :8080 + web :3001
# or
npm run dev
```

```bash
npm run typecheck
npm run build
npm run test:e2e      # needs stack up + Playwright
```

## Self-host

```bash
cp .env.example .env
docker compose up -d
```

GHCR images (after `v*` tag): `ghcr.io/20youssef10/rassam/{web,room,storage}`

## Docs

| Doc | Content |
|-----|---------|
| `docs/PLAN.md` | Vision |
| `docs/ARCHITECTURE.md` | Architecture |
| `docs/SELF_HOSTING.md` | Deploy |
| `docs/PHASE5_LAUNCH.md` | Launch / GHCR / npm |
| `docs/USER_GUIDE_AR.md` | Arabic user guide |
| `docs/E2E_FIX_LOG.md` | Test fixes |

## License

MIT. Based on open whiteboard ideas (Excalidraw et al.); Rassam is independent and not affiliated with Excalidraw.

**رسَّام** — لأن الرسم يجب أن يكون عربيًا أولًا.
