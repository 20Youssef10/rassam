import { useEffect, useMemo, useRef, useState } from "react";

import { ARABIC_LIBRARY, type LibraryItem } from "../library/arabicShapes";
import type { LibraryRecord } from "../library/libraryStore";
import type { Messages } from "../i18n/ar";
import { isAllowedLibraryUrl } from "../core/security";

function isLibraryRecordLike(item: unknown): item is LibraryRecord {
  if (!item || typeof item !== "object") {
    return false;
  }
  const rec = item as Record<string, unknown>;
  return (
    typeof rec.id === "string" &&
    Array.isArray(rec.template) &&
    rec.template.length < 500
  );
}

function toLibraryRecords(data: unknown): LibraryRecord[] {
  const arr = Array.isArray(data)
    ? data.slice(0, 100)
    : Array.isArray((data as { items?: unknown })?.items)
      ? ((data as { items: unknown[] }).items).slice(0, 100)
      : [];
  return arr.map((entry: unknown, i: number) => {
    const item = entry as Record<string, unknown>;
    if (isLibraryRecordLike(item)) {
      return {
        id: String(item.id).slice(0, 64),
        titleAr: String(item.titleAr || item.titleEn || `عنصر ${i + 1}`).slice(0, 128),
        titleEn: String(item.titleEn || item.titleAr || `Item ${i + 1}`).slice(0, 128),
        category: "custom",
        template: (item.template as unknown[]).slice(0, 200),
      };
    }
    return {
      id: `remote_${Date.now().toString(36)}_${i}`,
      titleAr: String(item?.label || item?.title || `عنصر ${i + 1}`).slice(0, 128),
      titleEn: String(item?.label || item?.title || `Item ${i + 1}`).slice(0, 128),
      category: "custom",
      template: [item],
    };
  });
}

async function fetchRemoteLibrary(url: string): Promise<unknown> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), 15000);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    window.clearTimeout(t);
  }
}

const CATEGORIES = ["all", "calligraphy", "flow", "office", "education", "custom"] as const;

export function LibraryPanel({
  messages,
  locale,
  open,
  onClose,
  onInsert,
  customItems = [],
  onInsertCustom,
  onLoadRemote,
}: {
  messages: Messages;
  locale: "ar" | "en";
  open: boolean;
  onClose: () => void;
  onInsert: (item: LibraryItem) => void;
  customItems?: LibraryRecord[];
  onInsertCustom?: (record: LibraryRecord) => void;
  onLoadRemote?: (items: LibraryRecord[]) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>("all");
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    ref.current?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filteredBuiltIn = useMemo(() => {
    return ARABIC_LIBRARY.filter((item) => {
      const catOk = category === "all" || item.category === category || (category === "custom" && false);
      const q = query.trim().toLowerCase();
      const textOk =
        !q ||
        item.titleAr.includes(query) ||
        item.titleEn.toLowerCase().includes(q) ||
        item.id.includes(q);
      return catOk && textOk;
    });
  }, [category, query]);

  const filteredCustom = useMemo(() => {
    return customItems.filter((item) => {
      const catOk = category === "all" || category === "custom" || item.category === category;
      const q = query.trim().toLowerCase();
      const textOk =
        !q ||
        item.titleAr.includes(query) ||
        item.titleEn.toLowerCase().includes(q) ||
        String(item.id).includes(q);
      return catOk && textOk;
    });
  }, [customItems, category, query]);

  if (!open) {
    return null;
  }

  return (
    <div
      className="rassam-library"
      dir={messages.dir}
      role="dialog"
      aria-modal="true"
      aria-label={locale === "ar" ? "مكتبة الأشكال" : "Shape library"}
    >
      <div className="rassam-library-header">
        <strong>{messages.library.title}</strong>
        <button type="button" onClick={onClose} aria-label={messages.library.close}>
          ✕
        </button>
      </div>
      <div className="rassam-library-filters">
        <input
          type="search"
          value={query}
          placeholder={locale === "ar" ? "بحث في المكتبة…" : "Search library…"}
          onChange={(e) => setQuery(e.target.value)}
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value as (typeof CATEGORIES)[number])}
          aria-label={locale === "ar" ? "فئة" : "Category"}
        >
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {c === "all"
                ? locale === "ar"
                  ? "الكل"
                  : "All"
                : c}
            </option>
          ))}
        </select>
        {onLoadRemote && (
          <button
            type="button"
            onClick={async () => {
              const url = window.prompt(
                locale === "ar"
                  ? "رابط مكتبة JSON"
                  : "Library JSON URL",
                "",
              );
              if (!url) {
                return;
              }
              if (!isAllowedLibraryUrl(url)) {
                window.alert(locale === "ar" ? "رابط غير مسموح (https فقط)" : "URL not allowed (https only, http localhost)");
                return;
              }
              try {
                onLoadRemote(toLibraryRecords(await fetchRemoteLibrary(url)));
              } catch (error) {
                console.warn("Rassam: remote library load failed", error);
                window.alert(locale === "ar" ? "تعذر تحميل الرابط" : "Failed to load URL");
              }
            }}
          >
            {locale === "ar" ? "من رابط" : "From URL"}
          </button>
        )}
      </div>
      <div className="rassam-library-grid">
        {filteredBuiltIn.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rassam-library-item"
            onClick={() => onInsert(item)}
          >
            <span className="rassam-library-cat">{item.category}</span>
            <strong>{locale === "ar" ? item.titleAr : item.titleEn}</strong>
          </button>
        ))}
        {filteredCustom.map((item) => (
          <button
            key={item.id}
            type="button"
            className="rassam-library-item"
            onClick={() => onInsertCustom?.(item)}
          >
            <span className="rassam-library-cat">{item.category || "custom"}</span>
            <strong>{locale === "ar" ? item.titleAr : item.titleEn}</strong>
          </button>
        ))}
      </div>
    </div>
  );
}
