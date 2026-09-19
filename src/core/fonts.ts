import { ARABIC_FONT } from "./types";

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿ]/;
const LATIN_RE = /[A-Za-z]/;

export type FontOption = {
  id: string;
  /** CSS font-family for canvas + UI */
  family: string;
  labelAr: string;
  labelEn: string;
  /** handwriting / display / ui */
  role: "ui" | "naskh" | "display" | "handwriting" | "latin";
  /** google fonts css2 family query */
  google?: string;
};

export const ARABIC_FONT_OPTIONS: FontOption[] = [
  {
    id: "cairo",
    family: "Cairo, 'Noto Naskh Arabic', sans-serif",
    labelAr: "القاهرة",
    labelEn: "Cairo",
    role: "ui",
    google: "Cairo:wght@400;600;700",
  },
  {
    id: "naskh",
    family: "'Noto Naskh Arabic', Cairo, serif",
    labelAr: "نسخ",
    labelEn: "Noto Naskh",
    role: "naskh",
    google: "Noto+Naskh+Arabic:wght@400;600;700",
  },
  {
    id: "lemonada",
    family: "Lemonada, Cairo, sans-serif",
    labelAr: "ليمونادة",
    labelEn: "Lemonada",
    role: "display",
    google: "Lemonada:wght@400;600;700",
  },
  {
    id: "changa",
    family: "Changa, Cairo, sans-serif",
    labelAr: "شنجة",
    labelEn: "Changa",
    role: "display",
    google: "Changa:wght@400;600;700",
  },
  {
    id: "reem",
    family: "'Reem Kufi', Cairo, sans-serif",
    labelAr: "ريم كوفي",
    labelEn: "Reem Kufi",
    role: "display",
    google: "Reem+Kufi:wght@400;600;700",
  },
  {
    id: "aref",
    family: "'Aref Ruqaa', Cairo, serif",
    labelAr: "عارف رقعة",
    labelEn: "Aref Ruqaa",
    role: "handwriting",
    google: "Aref+Ruqaa:wght@400;700",
  },
  {
    id: "amiri",
    family: "Amiri, 'Noto Naskh Arabic', serif",
    labelAr: "أميري",
    labelEn: "Amiri",
    role: "naskh",
    google: "Amiri:wght@400;700",
  },
];

export function buildGoogleFontsHref(_options?: unknown): string {
  // Rassam self-hosts via @fontsource — never inject Google Fonts.
  return "";
}

export function hasArabic(text: string): boolean {
  return ARABIC_RE.test(text);
}

export function hasLatin(text: string): boolean {
  return LATIN_RE.test(text);
}

export function pickCanvasFontFamily(
  text: string,
  preferred?: string,
  arabic = ARABIC_FONT,
  latin = "Segoe UI, system-ui, sans-serif",
): string {
  if (preferred && preferred.trim()) {
    return preferred;
  }
  if (hasArabic(text)) {
    return arabic;
  }
  return latin;
}

export const CANVAS_FONT_STACKS = {
  arabic: ARABIC_FONT,
  naskh: "'Noto Naskh Arabic', 'Cairo', serif",
  lemonada: "Lemonada, Cairo, sans-serif",
  handwriting: "'Aref Ruqaa', Cairo, serif",
  latin: "Segoe UI, system-ui, sans-serif",
  display: "Changa, Cairo, sans-serif",
} as const;

export async function ensureFontsReady(
  families: string[] = [ARABIC_FONT],
): Promise<void> {
  if (typeof document === "undefined" || !document.fonts) {
    return;
  }
  try {
    await Promise.all(
      families.map((family) => {
        const name = family
          .split(",")[0]
          .trim()
          .replace(/^['"]|['"]$/g, "");
        return document.fonts.load(`600 20px "${name}"`);
      }),
    );
    await document.fonts.ready;
  } catch (error) {
    console.warn("Rassam: font preload failed, using fallback fonts", error);
  }
}

export function getFontLabel(option: FontOption, locale: "ar" | "en"): string {
  return locale === "ar" ? option.labelAr : option.labelEn;
}
