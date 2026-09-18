# Architecture — رسَّام (Rassam)

## Overview

Rassam is a **heavy fork** of the official Excalidraw monorepo. It keeps the same high-level structure while adding a first-class self-hosted collaboration and storage layer and elevating Arabic/RTL to the default experience.

```
rassam/
├── packages/
│   ├── common/          # Shared constants, types, utilities
│   ├── math/            # Geometry & vector math
│   ├── element/         # Element model & operations
│   ├── utils/           # Export helpers, file utilities
│   └── excalidraw/      # Core React editor component (the "npm package")
├── excalidraw-app/      # Full application shell (PWA, collab UI, persistence)
├── examples/            # Integration examples
├── collab/              # (new / adapted) Room server & related services
├── storage/             # (new / adapted) HTTP storage backend
└── docker/              # Production Docker Compose & images
```

## Core Packages (inherited & extended)

| Package | Responsibility | Notes for Rassam |
|---------|----------------|------------------|
| `@rassam/excalidraw` (was `@excalidraw/excalidraw`) | Embeddable React editor | Rebranded, Arabic fonts, RTL defaults |
| `@rassam/common` | Shared types & constants | — |
| `@rassam/math` | Math helpers | — |
| `@rassam/element` | Element types & mutations | — |
| `@rassam/utils` | Export (PNG/SVG), file helpers | — |

The editor package remains usable as an embeddable component for other Arabic-first products.

## Application Shell (`excalidraw-app`)

Contains:
- Main menu, toolbar, sidebars, dialogs
- Collaboration UI (live presence, room links)
- PWA service worker and offline support
- Local-first persistence (IndexedDB / localStorage) + optional server sync
- Theme and language management (default = Arabic + RTL)

## Collaboration Architecture

```
Browser A ──┐
            ├── WebSocket ──► Room Server (Socket.IO / Go)
Browser B ──┘                      │
                                   │ (roomId + roomKey)
                                   ▼
                            E2E encrypted payloads
```

- **Room Server**: Handles real-time presence, element sync, and pointer updates. Does **not** see plaintext scene data when E2E is enabled.
- **Room Key**: Generated client-side; shared via the collaboration link. Used for end-to-end encryption.
- **Storage Backend**: Optional HTTP API for saving/loading scenes and binary files (images). Replaces Firebase.

Popular reference implementations used as starting points:
- `excalidraw-room` / Go room server variants
- HTTP storage backends from community forks (alswl and others)

## Data Flow (Simplified)

1. User draws → elements updated in local state (Jotai + app state).
2. If in a collaborative room → encrypted deltas sent to room server → broadcast to other clients.
3. Autosave → local IndexedDB + optional POST to storage backend.
4. Share link → encodes `roomId` + `roomKey` (collaborative) or a read-only snapshot token.

## Rendering Pipeline

Inherited from Excalidraw:
- Rough.js for the hand-drawn aesthetic
- Canvas 2D for the main scene
- Separate interactive canvas layer for selection handles, cursors, etc.
- SVG export path with font subsetting

Rassam additions:
- Improved RTL text measurement and highlight rectangles
- Arabic font loading and script-aware font switching
- Forced `dir="rtl"` on the root when Arabic is active

## State Management

- **Jotai** atoms for most UI and scene state (kept from upstream)
- Collaboration-specific state lives in the `Collab` controller inside the app shell
- Persistence layer abstracts local vs remote storage

## Security Model

- Collaboration is end-to-end encrypted by default (room key never leaves the clients in plaintext).
- Storage backend can be configured for private deployments (no public read).
- No analytics or external tracking in the Rassam builds.
- Self-hosted fonts and assets (no forced CDN dependency).

## Deployment Topology (Production)

```
                    ┌─────────────────┐
                    │  Reverse Proxy  │
                    │ (Nginx/Traefik) │
                    └────────┬────────┘
           ┌─────────────────┼─────────────────┐
           ▼                 ▼                 ▼
    ┌─────────────┐   ┌─────────────┐   ┌─────────────┐
    │  Frontend   │   │ Room Server │   │   Storage   │
    │  (static)   │   │ (WebSocket) │   │   Backend   │
    └─────────────┘   └─────────────┘   └─────────────┘
```

All three services are provided via Docker Compose for one-command self-hosting.

## Extension Points

- Custom storage drivers (S3, SQLite, PostgreSQL, filesystem)
- Additional authentication frontends (optional)
- Plugin-style addition of new tools or export formats
- Embedding the core `@rassam/excalidraw` component in other Arabic products