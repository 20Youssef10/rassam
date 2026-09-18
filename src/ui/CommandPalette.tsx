import { useEffect, useMemo, useRef, useState } from "react";

import { filterCommands, type PaletteCommand } from "../editor/commandPalette";
import type { Messages } from "../i18n/ar";

export function CommandPalette({
  messages,
  locale,
  open,
  commands,
  onClose,
}: {
  messages: Messages;
  locale: "ar" | "en";
  open: boolean;
  commands: PaletteCommand[];
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const filtered = useMemo(
    () => filterCommands(commands, query, locale),
    [commands, query, locale],
  );

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
      window.setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => {
    setIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  const run = (cmd: PaletteCommand | undefined) => {
    if (!cmd) {
      return;
    }
    if (cmd.enabled && !cmd.enabled()) {
      return;
    }
    cmd.run();
    onClose();
  };

  return (
    <div className="rassam-palette-backdrop" onClick={onClose} role="presentation">
      <div
        className="rassam-palette"
        dir={messages.dir}
        role="dialog"
        aria-modal="true"
        aria-label={locale === "ar" ? "لوحة الأوامر" : "Command palette"}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          ref={inputRef}
          value={query}
          placeholder={
            locale === "ar" ? "ابحث عن أمر…" : "Search commands…"
          }
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.preventDefault();
              onClose();
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setIndex((i) => Math.min(filtered.length - 1, i + 1));
              return;
            }
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setIndex((i) => Math.max(0, i - 1));
              return;
            }
            if (e.key === "Enter") {
              e.preventDefault();
              run(filtered[index]);
            }
          }}
        />
        <div className="rassam-palette-list" ref={listRef}>
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              type="button"
              className={i === index ? "is-active" : undefined}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(cmd)}
            >
              <span className="rassam-palette-sec">{cmd.section}</span>
              <span>{locale === "ar" ? cmd.labelAr : cmd.labelEn}</span>
            </button>
          ))}
          {!filtered.length && (
            <p className="rassam-palette-empty">
              {locale === "ar" ? "لا نتائج" : "No results"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
