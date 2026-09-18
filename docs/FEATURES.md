# Features — رسَّام (Rassam)

Rassam includes **everything** from the official Excalidraw editor and the hosted application, plus Arabic-first enhancements.

## 1. Core Editor (from `@excalidraw/excalidraw`)

- Infinite canvas
- Hand-drawn style (Rough.js)
- Dark mode & theme customization
- Full tool set:
  - Selection / Lasso
  - Rectangle, Diamond, Ellipse
  - Arrow & Line (with binding and labels)
  - Free-draw / Pencil
  - Text
  - Image
  - Eraser
  - Frame / Magic Frame
  - Sticky Note
  - Laser pointer
  - Hand / Pan tool
- Arrow binding & labeled arrows
- Elbow arrows & flowcharts
- Shape libraries (public + personal)
- Image support (upload, crop, embed)
- Undo / Redo (including multiplayer-aware)
- Zoom, pan, minimap
- Element linking
- Scene search
- Command palette
- Export:
  - PNG
  - SVG (with font subsetting)
  - Clipboard
  - `.excalidraw` / `.excalidrawlib` JSON
- Embeddable as a React component
- Extensive customization via props and UIOptions
- Programmatic API for elements and app state

## 2. Application Features (previously missing from the npm package)

- **Real-time collaboration**
  - Live cursors and presence
  - Element synchronization
  - Multiplayer undo/redo
- **End-to-end encryption**
  - Room key generated client-side
  - Scene data never readable by the server when E2E is on
- **Shareable links**
  - Collaborative rooms
  - Read-only / view-only links
- **PWA**
  - Installable
  - Offline-capable
  - Service worker for assets and basic offline editing
- **Local-first + optional server persistence**
  - Autosave to browser storage
  - Optional HTTP storage backend for scenes and binary files
- **Library management**
  - Personal library stored locally or on server
  - Public library support

## 3. Arabic-First & RTL Features (Rassam additions)

- Arabic as the **default language**
- Forced RTL layout (`dir="rtl"`) when Arabic is active
- Complete Arabic translation of the entire UI
- High-quality Arabic fonts shipped by default:
  - Noto Naskh Arabic
  - Lemonada
  - Cairo / Cairo Play
  - Changa
  - Baloo Bhaijaan 2
  - Additional handwriting-style fonts
- Script-aware font switching (Arabic vs Latin)
- Improved RTL text rendering, selection, and search highlighting
- Arabic-friendly onboarding and empty states
- Keyboard and shortcut considerations for RTL users
- Arabic shape libraries and calligraphic starters (planned)

## 4. Self-Hosting Features

- Official Docker images and Docker Compose
- Configurable room server URL
- Pluggable storage backend (filesystem, S3-compatible, database, etc.)
- No dependency on Excalidraw cloud services
- Zero analytics / tracking in production builds

## 5. Developer / Integration Features

- Embeddable React component (`@rassam/excalidraw`)
- Full TypeScript types
- Export helpers (`exportToCanvas`, `exportToBlob`, `exportToSvg`, etc.)
- Theme and language can be controlled by the host application
- Asset path configuration for fully offline / air-gapped deployments

## Feature Comparison Summary

| Feature                        | Official npm package | excalidraw.com | Rassam     |
|--------------------------------|----------------------|----------------|------------|
| Full drawing editor            | ✅                   | ✅             | ✅         |
| Real-time collaboration        | ❌                   | ✅             | ✅         |
| E2E encryption                 | ❌                   | ✅             | ✅         |
| Shareable links                | ❌                   | ✅             | ✅         |
| PWA / Offline                  | Partial              | ✅             | ✅         |
| Self-hosted storage            | ❌                   | ❌ (Firebase)  | ✅         |
| Arabic as default + polished RTL | Partial            | Partial        | ✅         |
| High-quality Arabic fonts      | Limited              | Limited        | ✅         |
| One-command full self-host     | ❌                   | ❌             | ✅         |