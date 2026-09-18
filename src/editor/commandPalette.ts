import type { Tool } from "../core/types";

export type PaletteCommand = {
  id: string;
  labelAr: string;
  labelEn: string;
  section: "tools" | "edit" | "view" | "file" | "collab" | "present";
  run: () => void;
  enabled?: () => boolean;
};

export function buildCommands(handlers: {
  setTool: (t: Tool) => void;
  undo: () => void;
  redo: () => void;
  duplicate: () => void;
  copy: () => void;
  paste: () => void;
  deleteSel: () => void;
  group: () => void;
  ungroup: () => void;
  exportPng: () => void;
  exportSvg: () => void;
  exportJson: () => void;
  toggleTheme: () => void;
  toggleLocale: () => void;
  toggleGrid: () => void;
  toggleStats: () => void;
  toggleMinimap: () => void;
  toggleHelp: () => void;
  openLibrary: () => void;
  openMermaid: () => void;
  toggleZen: () => void;
  toggleViewOnly: () => void;
  startPresentation: () => void;
  startCollab: () => void;
  shareReadOnly: () => void;
}): PaletteCommand[] {
  return [
    { id: "tool-select", labelAr: "أداة: تحديد", labelEn: "Tool: Select", section: "tools", run: () => handlers.setTool("select") },
    { id: "tool-rect", labelAr: "أداة: مستطيل", labelEn: "Tool: Rectangle", section: "tools", run: () => handlers.setTool("rectangle") },
    { id: "tool-arrow", labelAr: "أداة: سهم", labelEn: "Tool: Arrow", section: "tools", run: () => handlers.setTool("arrow") },
    { id: "tool-elbow", labelAr: "أداة: سهم زاوية", labelEn: "Tool: Elbow", section: "tools", run: () => handlers.setTool("elbow") },
    { id: "tool-text", labelAr: "أداة: نص", labelEn: "Tool: Text", section: "tools", run: () => handlers.setTool("text") },
    { id: "tool-sticky", labelAr: "أداة: ملاحظة", labelEn: "Tool: Sticky", section: "tools", run: () => handlers.setTool("sticky") },
    { id: "tool-frame", labelAr: "أداة: إطار", labelEn: "Tool: Frame", section: "tools", run: () => handlers.setTool("frame") },
    { id: "frame-contents", labelAr: "أداة: إطار — تحديد المحتوى", labelEn: "Frame: select contents", section: "view", run: () => handlers.setTool("select") },
    { id: "edit-undo", labelAr: "تراجع", labelEn: "Undo", section: "edit", run: handlers.undo },
    { id: "edit-redo", labelAr: "إعادة", labelEn: "Redo", section: "edit", run: handlers.redo },
    { id: "edit-dup", labelAr: "تكرار المحدد", labelEn: "Duplicate selection", section: "edit", run: handlers.duplicate },
    { id: "edit-copy", labelAr: "نسخ", labelEn: "Copy", section: "edit", run: handlers.copy },
    { id: "edit-paste", labelAr: "لصق", labelEn: "Paste", section: "edit", run: handlers.paste },
    { id: "edit-del", labelAr: "حذف المحدد", labelEn: "Delete selection", section: "edit", run: handlers.deleteSel },
    { id: "edit-group", labelAr: "تجميع", labelEn: "Group", section: "edit", run: handlers.group },
    { id: "edit-ungroup", labelAr: "إلغاء التجميع", labelEn: "Ungroup", section: "edit", run: handlers.ungroup },
    { id: "file-png", labelAr: "تصدير PNG", labelEn: "Export PNG", section: "file", run: handlers.exportPng },
    { id: "file-svg", labelAr: "تصدير SVG", labelEn: "Export SVG", section: "file", run: handlers.exportSvg },
    { id: "file-json", labelAr: "تصدير JSON", labelEn: "Export JSON", section: "file", run: handlers.exportJson },
    { id: "file-mermaid", labelAr: "استيراد Mermaid", labelEn: "Import Mermaid", section: "file", run: handlers.openMermaid },
    { id: "file-library", labelAr: "مكتبة الأشكال", labelEn: "Shape library", section: "file", run: handlers.openLibrary },
    { id: "view-theme", labelAr: "تبديل السمة", labelEn: "Toggle theme", section: "view", run: handlers.toggleTheme },
    { id: "view-lang", labelAr: "تبديل اللغة", labelEn: "Toggle language", section: "view", run: handlers.toggleLocale },
    { id: "view-grid", labelAr: "إظهار/إخفاء الشبكة", labelEn: "Toggle grid", section: "view", run: handlers.toggleGrid },
    { id: "view-stats", labelAr: "إحصاءات", labelEn: "Stats panel", section: "view", run: handlers.toggleStats },
    { id: "view-minimap", labelAr: "خريطة مصغرة", labelEn: "Minimap", section: "view", run: handlers.toggleMinimap },
    { id: "view-help", labelAr: "الاختصارات", labelEn: "Shortcut help", section: "view", run: handlers.toggleHelp },
    { id: "view-zen", labelAr: "وضع الزن (إخفاء الواجهة)", labelEn: "Zen mode (hide chrome)", section: "view", run: handlers.toggleZen },
    { id: "view-only", labelAr: "وضع العرض فقط", labelEn: "View-only mode", section: "view", run: handlers.toggleViewOnly },
    { id: "present-start", labelAr: "بدء العرض التقديمي (إطارات)", labelEn: "Presentation (frames)", section: "present", run: handlers.startPresentation },
    { id: "collab-start", labelAr: "بدء تعاون", labelEn: "Start collaboration", section: "collab", run: handlers.startCollab },
    { id: "collab-ro", labelAr: "رابط قراءة فقط", labelEn: "Read-only share link", section: "collab", run: handlers.shareReadOnly },
  ];
}

export function filterCommands(
  commands: PaletteCommand[],
  query: string,
  locale: "ar" | "en",
): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (!q) {
    return commands;
  }
  const tokens = q.split(/\s+/).filter(Boolean);
  return commands.filter((c) => {
    const label = (locale === "ar" ? c.labelAr : c.labelEn).toLowerCase();
    // full substring OR every token present
    if (label.includes(q) || c.id.includes(q)) {
      return true;
    }
    return tokens.every((t) => label.includes(t) || c.id.includes(t));
  });
}
