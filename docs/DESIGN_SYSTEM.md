# Design System — رسَّام (Rassam)

## Principles

1. **Arabic-first** — RTL is the default, not an afterthought.
2. **Hand-drawn soul** — keep the friendly, imperfect aesthetic of Excalidraw.
3. **Clarity over decoration** — Arabic UI must remain highly legible.
4. **Consistent spacing and hierarchy** — works in both RTL and LTR.
5. **Accessible** — sufficient contrast, keyboard support, screen-reader friendly.

## Layout & Direction

- Root element: `dir="rtl"` when language is Arabic.
- All flex/grid layouts must respect logical properties (`margin-inline-start` instead of `margin-left`, etc.).
- Toolbars, sidebars, and menus are mirrored in RTL.
- Canvas coordinates remain mathematical (x increases rightward); only the surrounding UI flips.

## Spacing Scale

Use a consistent 4-point scale:

| Token   | Value |
|---------|-------|
| space-1 | 4px   |
| space-2 | 8px   |
| space-3 | 12px  |
| space-4 | 16px  |
| space-5 | 24px  |
| space-6 | 32px  |
| space-7 | 48px  |
| space-8 | 64px  |

## Typography Scale

| Role          | Size   | Weight   | Notes                          |
|---------------|--------|----------|--------------------------------|
| Display       | 32–40px| Bold     | Welcome / empty states         |
| Title         | 24px   | SemiBold | Dialog titles                  |
| Heading       | 18–20px| SemiBold | Section headers                |
| Body          | 16px   | Regular  | Default UI text (Arabic min.)  |
| Small         | 14px   | Regular  | Secondary labels               |
| Caption       | 12–13px| Regular  | Hints, timestamps              |

Arabic text should generally not go below 14–16 px for body content.

## Color Tokens

See [BRANDING.md](./BRANDING.md) for the full palette.

Semantic tokens:
- `--color-primary`
- `--color-primary-hover`
- `--color-surface`
- `--color-surface-raised`
- `--color-border`
- `--color-text`
- `--color-text-muted`
- `--color-success` / `--color-warning` / `--color-danger`

Dark mode overrides the surface and text tokens while keeping accent colors.

## Components (high-level)

### Buttons
- Primary, secondary, ghost, danger
- Icon + label combinations must reverse order correctly in RTL
- Minimum touch target: 44×44 px on mobile

### Islands / Panels
- Elevated surfaces with subtle shadow and rounded corners (keep Excalidraw’s “island” language)
- Consistent padding using the spacing scale

### Toolbar
- Horizontal or vertical depending on viewport
- In RTL the order of tool groups is mirrored
- Active tool clearly indicated

### Dialogs & Menus
- Right-aligned in RTL (logical start)
- Focus trap and keyboard navigation preserved

### Canvas UI
- Selection handles, transform boxes, and cursors stay in canvas coordinate space
- Text editing caret and highlight rectangles must respect RTL runs

## Iconography

- Prefer simple, geometric icons that work in both directions.
- Directional icons (arrows, chevrons) must flip in RTL.
- Stroke weight consistent with the hand-drawn aesthetic.

## Motion

- Keep transitions short (150–250 ms).
- Prefer opacity and transform.
- Respect `prefers-reduced-motion`.

## Dark Mode

- Automatic or manual toggle.
- Surfaces invert; accents stay vibrant.
- Canvas background and grid adapt.

## Accessibility Checklist

- [ ] Color contrast ≥ 4.5:1 for normal text
- [ ] All interactive elements keyboard reachable
- [ ] `aria-*` attributes and live regions for collaboration presence
- [ ] Visible focus rings
- [ ] RTL tested with screen readers

## Implementation Notes

- Prefer CSS logical properties everywhere.
- Use the existing Excalidraw CSS variables and extend them rather than replacing the entire system at once.
- Font loading: pre-load critical Arabic fonts and provide good fallbacks.