# Roadmap — رسَّام (Rassam)

## Phase 0 — Foundation (Weeks 1–2)

**Goal**: Working fork with rebranding and basic full-stack development environment.

- [ ] Fork official Excalidraw repository
- [ ] Rename packages and application to Rassam / رسَّام
- [ ] Replace logos, favicons, titles, meta tags
- [ ] Set up GitHub Actions CI (lint, test, build)
- [ ] Docker development environment
- [ ] Basic room server + storage backend integrated for local development
- [ ] Confirm `yarn start` + collaboration works end-to-end

**Exit criteria**: Developers can clone, run `yarn`, and collaborate on a scene locally.

---

## Phase 1 — Arabic-First Core (Weeks 3–7)

**Goal**: Arabic is the default and feels native.

- [ ] Set `ar` as default language
- [ ] Force RTL (`document.dir = "rtl"`) and mirror UI layout
- [ ] Complete Arabic translation (100 % UI coverage)
- [ ] Ship and register high-quality Arabic fonts
- [ ] Implement / polish script-aware font switching
- [ ] Fix remaining RTL text bugs (selection, highlight, search, cursor)
- [ ] Arabic empty states, welcome screen, and onboarding
- [ ] Review keyboard shortcuts for RTL comfort

**Exit criteria**: A new user opening Rassam sees a fully Arabic, RTL interface with good typography.

---

## Phase 2 — Full Feature Parity (Weeks 8–14)

**Goal**: Everything that excalidraw.com has, fully self-hosted.

- [ ] Production-ready room server (WebSocket)
- [ ] HTTP storage backend for scenes + binary files
- [ ] Collaborative share links with E2E encryption
- [ ] Read-only share links
- [ ] PWA manifest + service worker (offline support)
- [ ] Local-first autosave + optional server sync
- [ ] Library persistence (local + server)
- [ ] Remove all upstream hard-coded cloud endpoints and analytics
- [ ] Environment-variable driven configuration

**Exit criteria**: Full collaboration + sharing + offline works on a self-hosted deployment with no external dependencies.

---

## Phase 3 — Polish & Arabic Enhancements (Weeks 15–19)

**Goal**: Production quality and delightful Arabic experience.

- [x] Performance pass (rAF paint, throttled cursors, large-scene helper)
- [x] Accessibility audit (RTL toolbar keyboard nav, skip link, live region, reduced motion)
- [x] Mobile RTL testing and fixes (44px targets, safe-area, horizontal toolbar)
- [x] Additional Arabic handwriting fonts (Cairo, Naskh, Lemonada, Changa, Reem Kufi, Aref Ruqaa, Amiri)
- [x] Starter Arabic shape libraries / calligraphic elements
- [x] Security review of encryption and storage paths (`SECURITY.md`)
- [x] Polished Docker Compose + documentation
- [x] Optional basic authentication hooks (`STORAGE_AUTH_TOKEN`)
- [x] Comprehensive Arabic user documentation (`docs/USER_GUIDE_AR.md`)

**Exit criteria**: Ready for public v1.0 announcement.

---

## Phase 4 — Launch & Beyond (Ongoing)

**v1.0 Launch**
- Public repository and documentation
- Docker Hub / GHCR images
- npm packages under `@rassam/*` scope (optional)

**Post-v1 Ideas**
- Deeper AI features (text-to-diagram in Arabic)
- Presentation / slideshow mode
- Voice / video hangouts (optional)
- Team workspaces and permissions
- Mobile-native shells (Capacitor / React Native)
- Official Arabic educational templates
- Integration plugins (Obsidian, VS Code, Notion-style)

## Versioning

- Follow semver.
- Editor package and full application may share the same major version.
- Breaking changes to the embeddable component API will be clearly documented.