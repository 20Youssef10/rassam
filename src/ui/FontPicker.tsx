import { ARABIC_FONT_OPTIONS, getFontLabel } from "../core/fonts";
import type { Messages } from "../i18n/ar";

export function FontPicker({
  messages,
  locale,
  value,
  onChange,
}: {
  messages: Messages;
  locale: "ar" | "en";
  value: string;
  onChange: (family: string) => void;
}) {
  return (
    <label className="rassam-font-picker">
      <span className="rassam-label">
        {locale === "ar" ? "الخط" : "Font"}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={locale === "ar" ? "خط النص" : "Text font"}
        style={{ fontFamily: value || undefined }}
      >
        <option value="">{messages.brand}</option>
        {ARABIC_FONT_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.family} style={{ fontFamily: opt.family }}>
            {getFontLabel(opt, locale)}
          </option>
        ))}
      </select>
    </label>
  );
}
