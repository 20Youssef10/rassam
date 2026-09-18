import type { RassamElement } from "../core/types";
import { ARABIC_FONT } from "../core/types";
import { createId, randomSeed } from "../core/ids";

export type LibraryItem = {
  id: string;
  titleAr: string;
  titleEn: string;
  category: "calligraphy" | "flow" | "office" | "education";
  /** factory returns one or more elements placed relative to origin */
  create: (origin: { x: number; y: number }) => RassamElement[];
};

const base = (type: RassamElement["type"], x: number, y: number) => ({
  id: createId(),
  type,
  x,
  y,
  stroke: "#0F172A",
  fill: "transparent",
  strokeWidth: 2,
  opacity: 1,
  seed: randomSeed(),
});

function label(
  x: number,
  y: number,
  text: string,
  fontSize = 16,
  fontFamily = ARABIC_FONT,
): RassamElement {
  return {
    ...base("text", x, y),
    type: "text",
    text,
    fontSize,
    fontFamily,
    width: Math.max(48, text.length * fontSize * 0.55),
    height: fontSize * 1.4,
    stroke: "#0F172A",
  };
}

export const ARABIC_LIBRARY: LibraryItem[] = [
  {
    id: "bismillah",
    titleAr: "بسملة (قالب نص)",
    titleEn: "Bismillah text",
    category: "calligraphy",
    create: (o) => [
      {
        ...base("text", o.x, o.y),
        type: "text",
        text: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
        fontSize: 28,
        fontFamily: "'Aref Ruqaa', Cairo, serif",
        width: 320,
        height: 40,
        stroke: "#0F172A",
      },
    ],
  },
  {
    id: "shahada-frame",
    titleAr: "إطار زخرفي",
    titleEn: "Ornate frame",
    category: "calligraphy",
    create: (o) => [
      {
        ...base("rectangle", o.x, o.y),
        type: "rectangle",
        width: 220,
        height: 120,
        fill: "#FEF3C7",
        stroke: "#0D9488",
      },
      {
        ...base("rectangle", o.x + 10, o.y + 10),
        type: "rectangle",
        width: 200,
        height: 100,
        fill: "transparent",
        stroke: "#2563EB",
        strokeWidth: 1,
      },
      label(o.x + 40, o.y + 48, "زخرفة", 22, "'Aref Ruqaa', Cairo, serif"),
    ],
  },
  {
    id: "flow-start",
    titleAr: "بداية مخطط",
    titleEn: "Flow start",
    category: "flow",
    create: (o) => [
      {
        ...base("ellipse", o.x, o.y),
        type: "ellipse",
        width: 140,
        height: 64,
        fill: "#CCFBF1",
        stroke: "#0D9488",
      },
      label(o.x + 42, o.y + 20, "بداية"),
    ],
  },
  {
    id: "flow-process",
    titleAr: "عملية",
    titleEn: "Process",
    category: "flow",
    create: (o) => [
      {
        ...base("rectangle", o.x, o.y),
        type: "rectangle",
        width: 160,
        height: 70,
        fill: "#DBEAFE",
        stroke: "#2563EB",
      },
      label(o.x + 40, o.y + 24, "عملية"),
    ],
  },
  {
    id: "flow-decision",
    titleAr: "قرار",
    titleEn: "Decision",
    category: "flow",
    create: (o) => [
      {
        ...base("diamond", o.x, o.y),
        type: "diamond",
        width: 160,
        height: 100,
        fill: "#FEF3C7",
        stroke: "#D97706",
      },
      label(o.x + 55, o.y + 40, "قرار؟"),
    ],
  },
  {
    id: "flow-end",
    titleAr: "نهاية مخطط",
    titleEn: "Flow end",
    category: "flow",
    create: (o) => [
      {
        ...base("ellipse", o.x, o.y),
        type: "ellipse",
        width: 140,
        height: 64,
        fill: "#FEE2E2",
        stroke: "#DC2626",
      },
      label(o.x + 48, o.y + 20, "نهاية"),
    ],
  },
  {
    id: "meeting",
    titleAr: "اجتماع",
    titleEn: "Meeting card",
    category: "office",
    create: (o) => [
      {
        ...base("rectangle", o.x, o.y),
        type: "rectangle",
        width: 200,
        height: 110,
        fill: "#FFFFFF",
        stroke: "#0F172A",
      },
      label(o.x + 16, o.y + 16, "اجتماع الفريق", 18),
      label(o.x + 16, o.y + 48, "الأسبوع القادم", 14),
      label(o.x + 16, o.y + 74, "١٠:٠٠ صباحًا", 14),
    ],
  },
  {
    id: "note",
    titleAr: "ملاحظة",
    titleEn: "Sticky note",
    category: "office",
    create: (o) => [
      {
        ...base("rectangle", o.x, o.y),
        type: "rectangle",
        width: 150,
        height: 150,
        fill: "#FEF3C7",
        stroke: "#D97706",
      },
      label(o.x + 16, o.y + 20, "فكرة", 20),
      label(o.x + 16, o.y + 56, "اكتب هنا…", 14),
    ],
  },
  {
    id: "lesson",
    titleAr: "بطاقة درس",
    titleEn: "Lesson card",
    category: "education",
    create: (o) => [
      {
        ...base("rectangle", o.x, o.y),
        type: "rectangle",
        width: 220,
        height: 130,
        fill: "#EDE9FE",
        stroke: "#7C3AED",
      },
      label(o.x + 16, o.y + 18, "الدرس", 20),
      label(o.x + 16, o.y + 52, "الأهداف التعليمية", 14),
      {
        ...base("line", o.x + 20, o.y + 90),
        type: "line",
        points: [
          { x: o.x + 20, y: o.y + 90 },
          { x: o.x + 200, y: o.y + 90 },
        ],
        stroke: "#7C3AED",
        strokeWidth: 1,
      },
    ],
  },
  {
    id: "quran-ayah",
    titleAr: "عمود آية (تعليمي)",
    titleEn: "Study column",
    category: "education",
    create: (o) => [
      {
        ...base("rectangle", o.x, o.y),
        type: "rectangle",
        width: 80,
        height: 200,
        fill: "#F5F0E6",
        stroke: "#0D9488",
      },
      label(o.x + 18, o.y + 20, "١", 16),
      label(o.x + 12, o.y + 60, "نص", 18, "'Noto Naskh Arabic', serif"),
    ],
  },
  {
    id: "ruqaa-sample",
    titleAr: "عينة رقعة",
    titleEn: "Ruqaa sample",
    category: "calligraphy",
    create: (o) => [
      label(o.x, o.y, "الخط العربي", 32, "'Aref Ruqaa', Cairo, serif"),
      label(o.x, o.y + 48, "جمال الحرف", 24, "Amiri, serif"),
    ],
  },
  {
    id: "kufi-title",
    titleAr: "عنوان كوفي",
    titleEn: "Kufi title",
    category: "calligraphy",
    create: (o) => [
      label(o.x, o.y, "رسَّام", 40, "'Reem Kufi', Cairo, sans-serif"),
    ],
  },
  {
    id: "flow-arrow-pair",
    titleAr: "سهم ربط",
    titleEn: "Binding arrow pair",
    category: "flow",
    create: (o) => {
      const a = {
        ...base("rectangle", o.x, o.y),
        type: "rectangle" as const,
        width: 120,
        height: 60,
        fill: "#DBEAFE",
        stroke: "#2563EB",
      };
      const b = {
        ...base("rectangle", o.x + 200, o.y),
        type: "rectangle" as const,
        width: 120,
        height: 60,
        fill: "#CCFBF1",
        stroke: "#0D9488",
      };
      const arrow = {
        ...base("arrow", o.x + 120, o.y + 30),
        type: "arrow" as const,
        points: [
          { x: o.x + 120, y: o.y + 30 },
          { x: o.x + 200, y: o.y + 30 },
        ],
        startBinding: { elementId: a.id },
        endBinding: { elementId: b.id },
        stroke: "#0F172A",
      };
      return [a, b, arrow, label(o.x + 30, o.y + 20, "أ"), label(o.x + 240, o.y + 20, "ب")];
    },
  },
  {
    id: "class-board",
    titleAr: "سبورة صف",
    titleEn: "Class board",
    category: "education",
    create: (o) => [
      {
        ...base("rectangle", o.x, o.y),
        type: "rectangle",
        width: 260,
        height: 160,
        fill: "#0F172A",
        stroke: "#0D9488",
        strokeWidth: 3,
      },
      label(o.x + 20, o.y + 24, "عنوان الدرس", 20, "Cairo, sans-serif"),
      label(o.x + 20, o.y + 60, "١. النقطة الأولى", 14, "Cairo, sans-serif"),
      label(o.x + 20, o.y + 90, "٢. النقطة الثانية", 14, "Cairo, sans-serif"),
      label(o.x + 20, o.y + 120, "٣. النقطة الثالثة", 14, "Cairo, sans-serif"),
    ],
  },
  {
    id: "timeline-ar",
    titleAr: "خط زمني",
    titleEn: "Arabic timeline",
    category: "office",
    create: (o) => [
      {
        ...base("line", o.x, o.y + 40),
        type: "line",
        points: [
          { x: o.x, y: o.y + 40 },
          { x: o.x + 280, y: o.y + 40 },
        ],
        stroke: "#2563EB",
      },
      label(o.x, o.y, "الماضي"),
      label(o.x + 110, o.y, "الحاضر"),
      label(o.x + 230, o.y, "المستقبل"),
    ],
  },
];

export function insertLibraryItem(
  item: LibraryItem,
  origin: { x: number; y: number },
): RassamElement[] {
  return item.create(origin);
}
