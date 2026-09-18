# Technical Decisions — رسَّام (Rassam)

## 1. Heavy Fork vs Green-Field Rewrite

**Decision**: Heavy fork of the official Excalidraw monorepo.

**Why**:
- Fastest path to full feature parity.
- MIT license allows it.
- Canvas, element model, and rendering are complex and already battle-tested.
- Collaboration code already exists in the app shell and only needs hardening for self-hosting.

**Trade-off**: We inherit some architectural complexity and must periodically merge useful upstream fixes.

## 2. Default Language & Direction

**Decision**: Arabic (`ar`) + `dir="rtl"` by default.

**Why**: The product is explicitly Arabic-first. Users who prefer English can switch; the default experience should not require configuration for the primary audience.

## 3. Collaboration Stack

**Decision**: Self-hosted WebSocket room server + separate HTTP storage backend + client-side E2E encryption.

**Why**:
- Matches the security model users expect (server cannot read scenes).
- Proven pattern in the Excalidraw ecosystem.
- Allows complete independence from Firebase and Excalidraw cloud services.

## 4. Package Naming

**Decision**: Rebrand to `@rassam/*` scope for published packages.

**Why**: Clear identity, avoids confusion with official packages, allows independent versioning and publishing.

## 5. Font Strategy

**Decision**: Ship high-quality Arabic fonts as first-class citizens, with script-aware switching.

**Why**: Good Arabic typography is non-negotiable for an Arabic-first product. Relying only on system fonts produces inconsistent results.

## 6. Storage Abstraction

**Decision**: Pluggable storage backend (filesystem, S3, database…).

**Why**: Different self-hosters have different infrastructure preferences. A clean interface keeps the core free of vendor lock-in.

## 7. PWA & Offline

**Decision**: Full PWA support with service worker and local-first persistence.

**Why**: Users should be able to draw even with flaky or no connectivity; collaboration is an enhancement, not a requirement for basic use.

## 8. Analytics & Tracking

**Decision**: Zero tracking in Rassam builds.

**Why**: Privacy and simplicity for self-hosted and Arabic-speaking users who may be more sensitive to data collection.

## 9. Upstream Tracking

**Decision**: Maintain the ability to cherry-pick or merge selected upstream changes.

**Why**: Benefit from editor improvements and bug fixes without being forced to take every upstream decision (especially around cloud services or branding).