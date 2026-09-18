# Plan — رسَّام (Rassam)

## Vision

Build **Rassam (رسَّام)** — an Arabic-first, fully self-hostable whiteboard that is a strict superset of Excalidraw:

- All core editor features from `@excalidraw/excalidraw`
- All hosted-app features currently missing from the npm package (real-time collaboration, E2E encryption, shareable links, PWA, local-first + server persistence)
- Arabic as the default language and design center (RTL-first UI, excellent Arabic typography, handwriting fonts, Arabic onboarding)

## Goals

1. **Feature parity + extras**  
   Editor + collaboration + sharing + offline + self-hosted storage.

2. **Arabic-first**  
   Default `langCode = "ar"`, forced RTL, polished Arabic translations, high-quality Arabic fonts (including handwriting styles), script-aware font switching.

3. **Self-hostable by design**  
   One-command Docker Compose that runs the full stack (frontend + room server + storage) with no dependency on Excalidraw’s cloud services.

4. **Open & sustainable**  
   MIT license, clean fork history, clear contribution path, Arabic-speaking community channels.

## Non-Goals (v1)

- Competing with Excalidraw+ commercial features (voice hangouts, advanced team admin, generative AI beyond basic) in the first release.
- Rewriting the canvas/rendering engine from scratch.
- Supporting Internet Explorer or very old browsers.

## Approach

**Heavy fork** of the official Excalidraw monorepo.

Rationale:
- MIT license permits full rebranding and redistribution.
- The monorepo already contains both the embeddable editor and the application shell that implements collaboration.
- Existing RTL and Arabic language support can be elevated instead of reinvented.
- Fastest path to 100 % feature coverage.

## Success Criteria for v1.0

- [ ] Arabic is the default language and the UI is fully RTL.
- [ ] All official editor tools and export formats work.
- [ ] Real-time collaboration works with a self-hosted room server.
- [ ] Shareable encrypted links (collaborative and read-only) work.
- [ ] PWA installable and usable offline.
- [ ] Scenes and files can be persisted on a self-hosted storage backend.
- [ ] One-command Docker deployment.
- [ ] High-quality Arabic fonts shipped and selectable.
- [ ] 100 % Arabic translation coverage of the UI.

## Timeline Overview

| Phase | Focus | Duration (estimate) |
|-------|-------|---------------------|
| 0 | Foundation (fork, rebrand, CI, basic collab stack) | 1–2 weeks |
| 1 | Arabic-first core | 3–5 weeks |
| 2 | Full feature parity (collab, storage, PWA, links) | 4–7 weeks |
| 3 | Polish, hardening, Arabic enhancements | 3–5 weeks |
| 4 | Launch & community | ongoing |

See [ROADMAP.md](./ROADMAP.md) for detailed milestones.