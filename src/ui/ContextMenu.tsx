import type { ContextAction, ContextMenuState } from "../editor/contextMenu";
import type { Messages } from "../i18n/ar";

export function ContextMenu({
  messages,
  locale,
  state,
  onAction,
  onClose,
}: {
  messages: Messages;
  locale: "ar" | "en";
  state: ContextMenuState | null;
  onAction: (action: ContextAction) => void;
  onClose: () => void;
}) {
  if (!state) {
    return null;
  }

  const items: { action: ContextAction; label: string }[] = [
    { action: "duplicate", label: locale === "ar" ? "تكرار" : "Duplicate" },
    { action: "copy", label: locale === "ar" ? "نسخ" : "Copy" },
    { action: "cut", label: locale === "ar" ? "قص" : "Cut" },
    { action: "paste", label: locale === "ar" ? "لصق" : "Paste" },
    { action: "delete", label: locale === "ar" ? "حذف" : "Delete" },
    { action: "bringToFront", label: locale === "ar" ? "لأمام" : "Bring to front" },
    { action: "sendToBack", label: locale === "ar" ? "للخلف" : "Send to back" },
    { action: "flipH", label: locale === "ar" ? "قلب أفقي" : "Flip horizontal" },
    { action: "flipV", label: locale === "ar" ? "قلب رأسي" : "Flip vertical" },
    { action: "editPoints", label: locale === "ar" ? "تحرير النقاط" : "Edit points" },
    { action: "label", label: locale === "ar" ? "تسمية" : "Add label" },
    { action: "setLink", label: locale === "ar" ? "تعيين رابط" : "Set link" },
    { action: "openLink", label: locale === "ar" ? "فتح الرابط" : "Open link" },
    {
      action: "selectFrameContents",
      label: locale === "ar" ? "محتوى الإطار" : "Frame contents",
    },
    { action: "lock", label: locale === "ar" ? "قفل" : "Lock" },
    { action: "unlock", label: locale === "ar" ? "فتح" : "Unlock" },
  ];

  return (
    <>
      <div className="rassam-menu-backdrop" onClick={onClose} aria-hidden />
      <div
        className="rassam-context-menu"
        dir={messages.dir}
        role="menu"
        style={{ left: state.x, top: state.y }}
      >
        {items.map((item) => (
          <button
            key={item.action}
            type="button"
            role="menuitem"
            onClick={() => {
              onAction(item.action);
              onClose();
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
    </>
  );
}

export function HelpDialog({
  messages,
  locale,
  open,
  onClose,
  shortcuts,
}: {
  messages: Messages;
  locale: "ar" | "en";
  open: boolean;
  onClose: () => void;
  shortcuts: { keys: string; ar: string; en: string }[];
}) {
  if (!open) {
    return null;
  }
  return (
    <div className="rassam-help" dir={messages.dir} role="dialog" aria-modal="true">
      <div className="rassam-help-panel">
        <div className="rassam-library-header">
          <strong>{locale === "ar" ? "اختصارات رسَّام" : "Rassam shortcuts"}</strong>
          <button type="button" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <ul className="rassam-help-list">
          {shortcuts.map((s) => (
            <li key={s.keys + s.ar}>
              <kbd>{s.keys}</kbd>
              <span>{locale === "ar" ? s.ar : s.en}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
