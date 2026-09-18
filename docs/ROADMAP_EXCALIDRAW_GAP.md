# Roadmap — Excalidraw feature gap (Rassam greenfield)

Compared against official Excalidraw editor + hosted app capabilities
(`docs/FEATURES.md` + current product surface). Rassam **already has**:
Arabic/RTL-first UI, hand-drawn canvas MVP, multi-select/align/export,
E2E collab + share links, PWA, storage drivers/auth, fonts/library basics,
group/lock/rotate/bind, search highlight.

Phases below are **gaps only**, ordered for product value.

---

## Gap Phase 1 — Core editing power *(this cycle)*

The daily-driver editor features Excalidraw users expect.

| Feature | Excalidraw | Rassam now |
|---------|------------|------------|
| Copy / Cut / Paste | ✅ | ❌ → implement |
| Duplicate | ✅ | ❌ → implement |
| Z-order (bring/send front/back) | ✅ | ❌ → implement |
| Flip H / V | ✅ | ❌ → implement |
| Element context menu | ✅ | ❌ → implement |
| Linear point editing (add/move vertices) | ✅ | ❌ → implement |
| Arrow / bound labels | ✅ | ❌ → implement |
| JSON scene export / import | ✅ (`.excalidraw`) | ❌ → `.rassam.json` |
| Sticky notes | ✅ | ❌ → implement |
| Lasso selection | ✅ | ❌ → implement |
| Grid + snap-to-grid | ✅ | ❌ → implement |
| Shortcut help dialog | ✅ | ❌ → implement |

**Exit:** User can copy/paste, reorder, flip, edit polyline points, label arrows, toggle grid/snap, use sticky + lasso, export/import JSON, open shortcuts help.

---

## Gap Phase 2 — Collaboration depth *(implemented)*

| Feature | Status |
|---------|--------|
| Multiplayer-aware undo / redo | ✅ Local `changedIds` merge-undo when online |
| Follow a collaborator’s viewport | ✅ Panel + encrypted viewport relay |
| Collaborator list + rename | ✅ Panel + persisted username |
| Presence idle/status | ✅ 20s idle broadcast |
| Library sync per room | ✅ `room_<id>` namespace |
| File/image collab sync polish | ✅ Only referenced files in scene broadcast |

---

## Gap Phase 3 — Advanced canvas model *(implemented)*

| Feature | Status |
|---------|--------|
| Frames + frame export | ✅ Frame tool, contents select, SVG export of frame |
| Elbow arrows + flowchart assist | ✅ Elbow tool + auto bind to shapes |
| Element linking (hyperlink shapes) | ✅ Set/open link, Ctrl+click, badge |
| Image crop | ✅ Basic `crop` on image draw |
| Bucket fill | ✅ Fill tool applies current fill |
| Laser pointer | ✅ Fading laser strokes |
| Text auto-resize in containers | ⚠️ Partial (sticky/label measure on edit) |
| Element stats panel | ✅ Count, selection, bounds, types, zoom |
| Minimap | ✅ Overview + click-to-pan |

---

## Gap Phase 4 — Product surfaces & platform *(implemented)*

| Feature | Status |
|---------|--------|
| Command palette | ✅ `Ctrl/Cmd+K` — tools, edit, file, view, collab, present |
| Zen / view-only UI modes | ✅ Hide chrome; view-only locks editing |
| Mermaid → diagram import | ✅ Basic flowchart/LR-TD parser → shapes + elbow arrows |
| Public shape library browser | ✅ Search + category filter + custom/room items |
| Embeddable package `@rassam/excalidraw` | ✅ Skeleton: `RassamEmbed` iframe host (deep canvas API later) |
| Presentation mode | ✅ Frames as slides, keyboard nav, SVG stage |
| AI text-to-diagram (Arabic) | ✅ Multi-provider (OpenAI/Anthropic/Gemini/Ollama/OpenRouter/compatible) + local heuristic |
| Multiplayer CRDT/OT | ✅ Lamport-clock CRDT + encrypted op broadcast |

---

## Gap Phase 5 — Launch *(only when user requests)*

Docker Hub / GHCR, npm publish `@rassam/*`, public git remote, v1.0 notes — **deferred by user**.

---

### Implementation order (Gap Phase 1)

1. Clipboard + duplicate + z-order + flip  
2. Context menu + shortcut help  
3. Linear editing + arrow labels  
4. JSON import/export  
5. Sticky note + lasso + grid/snap  
6. Typecheck / build verification  
