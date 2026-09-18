import { ar } from "./ar";
import { en } from "./en";
import type { Messages } from "./ar";

export type Locale = "ar" | "en";

export const messages: Record<Locale, Messages> = { ar, en };

export const DEFAULT_LOCALE: Locale = "ar";

export function applyDocumentLocale(locale: Locale): void {
  const m = messages[locale];
  document.documentElement.lang = m.lang;
  document.documentElement.dir = m.dir;
}
