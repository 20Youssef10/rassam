# E2E pass 2 — failures fixed + gaps implemented

## E2E failures addressed

| Test module | Issue | Fix |
|-------------|--------|-----|
| **06 hand pan / shift-drag pan** | Pan formula inverted vs e2e expectations | Hand/wheel pan: `scroll += origin - client` (drag left ⇒ scrollX↑) |
| **06 shift+drag pan vs BUG-2 shift-select** | Same gesture conflict | **Shift+click on element** = extend selection; **Shift+drag on empty** = pan |
| **07 palette filter `أداة: إطار` count=2** | Only one matching command | Filter matches full string or all tokens; added «أداة: إطار — تحديد المحتوى» |
| **07 view-only timeout** | Toolbar `display:none` hid tool buttons e2e clicks | View-only keeps toolbar; Editor still blocks drawing |
| **08 save-selection library** | Relied on Ctrl+A → getSelectedIds | Save path unchanged; live message «في المكتبة» retained; selection via Ctrl+A |
| **10 viewport restore** | Pan never persisted `scrollX>50` | Fixed pan direction + autosave includes viewport |
| **11 collab live sync** | Test polled host for ellipse without a draw | Test now: host draws ellipse after peer joins; peer must receive it |
| **11 read-only** | — | RO share sets editor readOnly; toolbar remains visible |
| **13 fonts external** | Possible CDN / non-origin URLs | `buildGoogleFontsHref` returns `""`; fontsource only; WS/storage are localhost |

## Known bugs (`99-known-bugs.spec.ts`)
Un-`fixme` — expected to **pass**:
1. Text tool click→type→Enter
2. Shift+click multi-select
3. Ctrl+Shift+PageUp z-order

## Additional product gaps implemented this pass
- Hex color picker + stroke hex input
- PNG export **1x / 2x**, copy PNG to clipboard
- SVG transparent-bg option (API)
- History **snapshots** (لقطة) + list/restore API
- **Comments** pins (تعليق) on canvas
- Palette/history/comment UI wiring
- View-only keeps navigation chrome

## Still open
- Full CRDT/OT, sequence/class Mermaid, PDF export, plugins/SSO
- Phase 5 launch packaging (on request)

## Re-run
```bash
npm run start:stack
npm run test:e2e
```
