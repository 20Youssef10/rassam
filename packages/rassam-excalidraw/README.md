# @rassam/excalidraw

Embeddable host for **Rassam (رسَّام)** — Arabic-first whiteboard.

Not an Excalidraw fork. Product docs: `rassam-docs/` / `docs/` in the Rassam monorepo.

## Install (when published)

```bash
npm install @rassam/excalidraw
```

## Usage

```tsx
import { RassamEmbed } from "@rassam/excalidraw";

export function Whiteboard() {
  return (
    <RassamEmbed
      src="https://draw.example.com/#room=ROOM,KEY"
      height={560}
      title="لوح التخطيط"
    />
  );
}
```

## Notes

- Default experience is **Arabic + RTL**.
- Collab/share links use E2E encryption; treat keys as secrets.
- Deep in-process canvas API export is planned after the editor is split as a library.

## License

MIT
