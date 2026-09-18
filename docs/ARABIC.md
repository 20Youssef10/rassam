# Arabic & RTL Strategy — رسَّام (Rassam)

## Goals

1. Arabic is the **default** language on first load.
2. The entire UI is fully translated and feels native.
3. RTL layout is correct and polished (not merely “flipped”).
4. Arabic typography on both the UI and the canvas is excellent.
5. Mixed Arabic + Latin content is handled gracefully.

## Language Default

```ts
// Default in Rassam
const defaultLang = "ar";
```

When `langCode` is an RTL language, the application sets:

```ts
document.documentElement.dir = "rtl";
document.documentElement.lang = "ar";
```

Users can still switch to English or any other supported language; the choice is persisted.

## Translation Coverage

- Target: **100 %** of user-visible strings.
- Source of truth: JSON locale files under `packages/excalidraw/locales/` (and app-specific strings).
- Process:
  1. Extract all strings.
  2. Translate to clear Modern Standard Arabic.
  3. Review by native speakers for naturalness.
  4. Keep English as fallback for any missing key during development.

## Fonts

### UI Fonts (Arabic)

| Font                  | Role                    | Notes                     |
|-----------------------|-------------------------|---------------------------|
| Cairo / Cairo Play    | Primary UI              | Modern, highly readable   |
| Noto Naskh Arabic     | Alternative / formal    | Excellent for longer text |
| Lemonada              | Friendly / rounded      | Good for headings         |
| Changa                | Strong display          | Titles, empty states      |

### Canvas Fonts

- All of the above plus additional handwriting / free-draw oriented Arabic fonts.
- Script detection: when the user types Arabic characters, prefer the last-used Arabic font; when they type Latin, prefer the last-used Latin font.
- Font picker UI groups fonts into “عربي” and “English / Other” sections.

### Loading Strategy

- Critical fonts are self-hosted and preloaded.
- `window.EXCALIDRAW_ASSET_PATH` (or Rassam equivalent) points to local assets so the app works offline and in air-gapped environments.
- `@font-face` rules correctly quote multi-word family names.

## RTL Layout Rules

1. Use CSS logical properties (`inset-inline-start`, `margin-inline`, `padding-inline`, `text-align: start`, etc.).
2. Flexbox / Grid `direction` is driven by the root `dir` attribute.
3. Directional icons (chevrons, arrows) flip via CSS or RTL-aware icon components.
4. Toolbars and sidebars mirror their order.
5. Dialogs and popovers align to the logical start side.

## Canvas-Specific RTL Considerations

- Text elements store their content as written; rendering respects the Unicode bidirectional algorithm.
- Selection and search highlight rectangles must be calculated with RTL runs in mind (known upstream issues exist and must be fixed or worked around).
- Cursor and caret positioning during editing must be correct for Arabic.
- Binding and arrow labeling remain geometrically correct regardless of UI direction.

## Testing Checklist (Arabic)

- [ ] Fresh load shows Arabic + RTL
- [ ] All menus, dialogs, and tooltips are translated
- [ ] Font picker shows Arabic fonts prominently
- [ ] Typing Arabic in a text element uses a good Arabic font automatically
- [ ] Mixed Arabic/Latin strings render correctly
- [ ] Search highlight works in RTL text
- [ ] Collaboration presence labels and UI are RTL-correct
- [ ] Mobile browser RTL layout is usable
- [ ] Export to PNG/SVG embeds Arabic fonts correctly (or subsets them)

## Known Upstream Gaps to Address

- Incomplete or imperfect RTL highlight/selection in some views
- Limited high-quality Arabic handwriting fonts out of the box
- Some UI strings still English-only in older versions
- Font-family quoting bugs with multi-word names

Rassam treats fixing these as first-class work items.