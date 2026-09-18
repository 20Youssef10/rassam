export type ContextMenuState = {
  x: number;
  y: number;
  sceneX: number;
  sceneY: number;
  targetId: string | null;
};

export type ContextAction =
  | "duplicate"
  | "copy"
  | "cut"
  | "paste"
  | "delete"
  | "bringToFront"
  | "sendToBack"
  | "flipH"
  | "flipV"
  | "editPoints"
  | "label"
  | "lock"
  | "unlock"
  | "setLink"
  | "openLink"
  | "selectFrameContents";

export type HelpShortcut = {
  keys: string;
  ar: string;
  en: string;
};

export const HELP_SHORTCUTS: HelpShortcut[] = [
  { keys: "V", ar: "تحديد", en: "Select" },
  { keys: "H", ar: "تحريك اللوحة", en: "Pan" },
  { keys: "R / D / O", ar: "مستطيل / معيّن / بيضاوي", en: "Rect / Diamond / Ellipse" },
  { keys: "L / A", ar: "خط / سهم", en: "Line / Arrow" },
  { keys: "P / T / I / E", ar: "رسم / نص / صورة / ممحاة", en: "Draw / Text / Image / Eraser" },
  { keys: "N", ar: "ملاحظة لاصقة", en: "Sticky note" },
  { keys: "Q", ar: "تحديد بالحراسة (Lasso)", en: "Lasso select" },
  { keys: "Ctrl+C / Ctrl+X / Ctrl+V", ar: "نسخ / قص / لصق", en: "Copy / Cut / Paste" },
  { keys: "Ctrl+D", ar: "تكرار", en: "Duplicate" },
  { keys: "Ctrl+Z / Ctrl+Y", ar: "تراجع / إعادة", en: "Undo / Redo" },
  { keys: "Ctrl+G / Shift+Ctrl+G", ar: "تجميع / إلغاء التجميع", en: "Group / Ungroup" },
  { keys: "K", ar: "قفل / فتح", en: "Lock / Unlock" },
  { keys: "[ / ]", ar: "تدوير المحدد", en: "Rotate selection" },
  { keys: "PageUp / PageDown", ar: "تقديم / تأخير (ترتيب)", en: "Bring forward / backward" },
  { keys: "Ctrl+Shift+PageUp", ar: "لأمام", en: "Bring to front" },
  { keys: "Ctrl+Shift+PageDown", ar: "للخلف", en: "Send to back" },
  { keys: "Ctrl+Shift+G", ar: "إظهار/إخفاء الشبكة", en: "Toggle grid" },
  { keys: "Delete", ar: "حذف المحدد", en: "Delete selection" },
  { keys: "?", ar: "مساعدة الاختصارات", en: "Shortcut help" },
];
