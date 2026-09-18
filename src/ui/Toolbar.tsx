import { useEffect, useRef } from "react";

import type { Messages } from "../i18n/ar";
import type { Tool } from "../core/types";

const toolIcons: Record<Tool, string> = {
  select: "⬚",
  hand: "✋",
  lasso: "◌",
  rectangle: "▭",
  diamond: "◇",
  ellipse: "⬭",
  line: "╱",
  arrow: "➔",
  elbow: "⌞",
  draw: "✎",
  text: "أ",
  image: "🖼",
  sticky: "🗒",
  frame: "▣",
  bucket: "▨",
  laser: "◉",
  eraser: "⌫",
};

const toolOrder: Tool[] = [
  "select",
  "lasso",
  "hand",
  "rectangle",
  "diamond",
  "ellipse",
  "line",
  "arrow",
  "elbow",
  "draw",
  "text",
  "image",
  "sticky",
  "frame",
  "bucket",
  "laser",
  "eraser",
];

export function Toolbar({
  messages,
  tool,
  onToolChange,
}: {
  messages: Messages;
  tool: Tool;
  onToolChange: (t: Tool) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    const buttons = () =>
      Array.from(el.querySelectorAll<HTMLButtonElement>("button.rassam-tool"));
    const onKey = (e: KeyboardEvent) => {
      if (!["ArrowDown", "ArrowUp", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
        return;
      }
      const items = buttons();
      const idx = items.findIndex((b) => b.dataset.tool === tool);
      if (idx < 0) {
        return;
      }
      e.preventDefault();
      const horizontal = window.matchMedia("(max-width: 720px)").matches;
      let next = idx;
      const forward = e.key === "ArrowDown" || e.key === "ArrowRight" || (e.key === "Home" && false);
      if (e.key === "Home") next = 0;
      else if (e.key === "End") next = items.length - 1;
      else if (e.key === "ArrowDown" || (horizontal && e.key === "ArrowRight")) next = (idx + 1) % items.length;
      else if (e.key === "ArrowUp" || (horizontal && e.key === "ArrowLeft")) next = (idx - 1 + items.length) % items.length;
      else if (!horizontal && e.key === "ArrowRight") next = (idx + 1) % items.length;
      else if (!horizontal && e.key === "ArrowLeft") next = (idx - 1 + items.length) % items.length;
      void forward;
      items[next]?.focus();
      const t = items[next]?.dataset.tool as Tool | undefined;
      if (t) {
        onToolChange(t);
      }
    };
    el.addEventListener("keydown", onKey);
    return () => el.removeEventListener("keydown", onKey);
  }, [tool, onToolChange]);

  return (
    <aside
      ref={ref}
      className="rassam-toolbar"
      dir={messages.dir}
      role="toolbar"
      aria-orientation={typeof window !== "undefined" && window.innerWidth <= 720 ? "horizontal" : "vertical"}
      aria-label={messages.dir === "rtl" ? "أدوات الرسم" : "Drawing tools"}
    >
      {toolOrder.map((t) => (
        <button
          key={t}
          type="button"
          className={`rassam-tool ${tool === t ? "is-active" : ""}`}
          data-tool={t}
          title={messages.tools[t]}
          aria-label={messages.tools[t]}
          aria-pressed={tool === t}
          aria-current={tool === t ? "true" : undefined}
          onClick={() => onToolChange(t)}
        >
          <span className="rassam-tool-icon" aria-hidden>
            {toolIcons[t]}
          </span>
          <span className="rassam-tool-label">{messages.tools[t]}</span>
        </button>
      ))}
    </aside>
  );
}
