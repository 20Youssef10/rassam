import { useMemo } from "react";

import type { Messages } from "../i18n/ar";
import type { RassamElement } from "../core/types";
import { elementBounds } from "../core/geometry";

const TYPE_LABEL_AR: Record<string, string> = {
  rectangle: "مستطيل",
  diamond: "معيّن",
  ellipse: "بيضاوي",
  line: "خط",
  arrow: "سهم",
  draw: "رسم",
  text: "نص",
  image: "صورة",
  sticky: "ملاحظة",
  frame: "إطار",
};

export function LayersPanel({
  messages,
  locale,
  elements,
  selectedIds,
  open,
  onClose,
  onSelect,
  onRaise,
  onLower,
}: {
  messages: Messages;
  locale: "ar" | "en";
  elements: RassamElement[];
  selectedIds: string[];
  open: boolean;
  onClose: () => void;
  onSelect: (id: string, additive: boolean) => void;
  onRaise: (id: string) => void;
  onLower: (id: string) => void;
}) {
  const rows = useMemo(() => {
    // top of list = front (last painted)
    return [...elements].reverse().map((el, revIdx) => {
      const index = elements.length - 1 - revIdx;
      const b = elementBounds(el);
      const label =
        el.type === "text"
          ? (el as { text?: string }).text?.slice(0, 24) || "…"
          : el.type === "sticky" || el.type === "frame"
            ? ((el as { label?: string; name?: string }).label ||
                (el as { name?: string }).name ||
                "")
            : "";
      const typeAr =
        TYPE_LABEL_AR[el.type] || (locale === "ar" ? el.type : el.type);
      return {
        el,
        index,
        b,
        label,
        typeAr,
        name: label ? `${typeAr}: ${label}` : typeAr,
      };
    });
  }, [elements, locale]);

  if (!open) {
    return null;
  }

  return (
    <div className="rassam-layers" dir={messages.dir} role="region" aria-label="layers">
      <div className="rassam-collab-panel-head">
        <strong>{locale === "ar" ? "الطبقات" : "Layers"}</strong>
        <button type="button" onClick={onClose} aria-label="close">
          ✕
        </button>
      </div>
      <ul>
        {rows.map((row) => (
          <li
            key={row.el.id}
            className={selectedIds.includes(row.el.id) ? "is-selected" : undefined}
          >
            <button
              type="button"
              className="rassam-layer-name"
              onClick={(e) => onSelect(row.el.id, e.shiftKey)}
            >
              <span className="rassam-layer-type">{row.index}</span>
              <span>{row.name}</span>
            </button>
            <button type="button" onClick={() => onRaise(row.el.id)} title="↑">
              ↑
            </button>
            <button type="button" onClick={() => onLower(row.el.id)} title="↓">
              ↓
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
