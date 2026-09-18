import { useEffect, useState } from "react";

import type { Messages } from "../i18n/ar";
import { MERMAID_SAMPLE, mermaidToElements } from "../core/mermaid";
import {
  detectMermaidKind,
  parseMermaidAny,
} from "../core/mermaidAdvanced";
import type { RassamElement } from "../core/types";

export function MermaidDialog({
  messages,
  locale,
  open,
  onClose,
  onImport,
}: {
  messages: Messages;
  locale: "ar" | "en";
  open: boolean;
  onClose: () => void;
  onImport: (elements: RassamElement[]) => void;
}) {
  const [text, setText] = useState(MERMAID_SAMPLE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setText(MERMAID_SAMPLE);
      setError(null);
    }
  }, [open]);

  if (!open) {
    return null;
  }

  return (
    <div className="rassam-help" dir={messages.dir} role="dialog" aria-modal="true">
      <div className="rassam-help-panel" style={{ width: "min(560px, 94vw)" }}>
        <div className="rassam-library-header">
          <strong>
            {locale === "ar" ? "استيراد Mermaid" : "Import Mermaid"}
          </strong>
          <button type="button" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>
        <p className="rassam-ai-hint">
          {locale === "ar"
            ? "flowchart / sequenceDiagram / classDiagram / stateDiagram"
            : "flowchart / sequenceDiagram / classDiagram / stateDiagram"}
        </p>
        <textarea
          className="rassam-mermaid-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          spellCheck={false}
          dir="ltr"
          rows={10}
        />
        {error && <p className="rassam-mermaid-error">{error}</p>}
        <div className="rassam-mermaid-actions">
          <button
            type="button"
            onClick={() => {
              try {
                const kind = detectMermaidKind(text);
                let els: RassamElement[] | null = null;
                if (kind === "sequence" || kind === "class" || kind === "state") {
                  els = parseMermaidAny(text, { x: 0, y: 0 });
                } else {
                  els = mermaidToElements(text, { x: 0, y: 0 });
                  if (!els?.length) {
                    els = parseMermaidAny(text, { x: 0, y: 0 });
                  }
                }
                if (!els || !els.length) {
                  setError(
                    locale === "ar"
                      ? "تعذر تحليل المخطط — flowchart/sequence/class/state."
                      : "Could not parse diagram.",
                  );
                  return;
                }
                onImport(els);
                onClose();
              } catch {
                setError(locale === "ar" ? "خطأ في التحليل" : "Parse error");
              }
            }}
          >
            {locale === "ar" ? "إدراج" : "Insert"}
          </button>
        </div>
      </div>
    </div>
  );
}
