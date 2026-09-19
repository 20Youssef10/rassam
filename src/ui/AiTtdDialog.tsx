import { useEffect, useState } from "react";

import type { Messages } from "../i18n/ar";
import type { RassamElement } from "../core/types";
import {
  AI_PROVIDER_PRESETS,
  AI_SYSTEM_PROMPT_AR,
  AI_SYSTEM_PROMPT_EN,
  completeChat,
  loadAiConfig,
  saveAiConfig,
  type AiProviderConfig,
} from "../ai/providers";
import { mermaidToElements } from "../core/mermaid";
import { parseMermaidAny } from "../core/mermaidAdvanced";
import { arabicTextToDiagram } from "../core/aiTtd";

export function AiTtdDialog({
  messages,
  locale,
  open,
  onClose,
  onInsert,
}: {
  messages: Messages;
  locale: "ar" | "en";
  open: boolean;
  onClose: () => void;
  onInsert: (els: RassamElement[]) => void;
}) {
  const [text, setText] = useState(
    locale === "ar"
      ? "البداية ثم هل جاهز؟ ثم نعم ابدأ الرسم ثم النهاية"
      : "start -> gather -> design -> done",
  );
  const [provider, setProvider] = useState<AiProviderConfig>(
    () => loadAiConfig() || AI_PROVIDER_PRESETS[0],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    if (open) {
      setError(null);
      setPreview("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const insertFromAiOutput = (raw: string) => {
    const advanced = parseMermaidAny(raw, { x: 0, y: 0 });
    if (advanced) {
      onInsert(advanced);
      return true;
    }
    const flow = mermaidToElements(raw, { x: 0, y: 0 });
    if (flow.length) {
      onInsert(flow);
      return true;
    }
    const steps = arabicTextToDiagram(raw, { x: 0, y: 0 });
    if (steps.length) {
      onInsert(steps);
      return true;
    }
    return false;
  };

  return (
    <div className="rassam-help" dir={messages.dir} role="dialog" aria-modal="true">
      <div className="rassam-help-panel" style={{ width: "min(600px, 94vw)" }}>
        <div className="rassam-library-header">
          <strong>
            {locale === "ar" ? "ذكاء اصطناعي → مخطط" : "AI → diagram"}
          </strong>
          <button type="button" onClick={onClose} aria-label="close">
            ✕
          </button>
        </div>

        <label className="rassam-ai-field">
          <span>{locale === "ar" ? "المزوّد" : "Provider"}</span>
          <select
            value={provider.id}
            onChange={(e) => {
              const preset = AI_PROVIDER_PRESETS.find((p) => p.id === e.target.value);
              if (preset) {
                const next = { ...preset, apiKey: provider.apiKey, baseUrl: preset.baseUrl || provider.baseUrl, model: preset.model || provider.model };
                setProvider(next);
                saveAiConfig(next);
              }
            }}
          >
            {AI_PROVIDER_PRESETS.map((p) => (
              <option key={p.id} value={p.id}>
                {locale === "ar" ? p.labelAr : p.labelEn}
              </option>
            ))}
          </select>
        </label>

        {provider.id !== "local-heuristic" && (
          <label className="rassam-ai-field">
            <span>{locale === "ar" ? "مفتاح API (لا يُحفظ افتراضيًا)" : "API key (not stored by default)"}</span>
            <input
              type="password"
              autoComplete="off"
              value={provider.apiKey || ""}
              onChange={(e) => {
                const next = { ...provider, apiKey: e.target.value };
                setProvider(next);
                saveAiConfig({ ...next, apiKey: undefined });
              }}
              placeholder={provider.id === "ollama" ? "(optional)" : "sk-…"}
            />
          </label>
        )}

        <label className="rassam-ai-field">
          <span>{locale === "ar" ? "النموذج / الرابط" : "Model / base URL"}</span>
          <div className="rassam-ai-row">
            <input
              value={provider.model || ""}
              onChange={(e) => {
                const next = { ...provider, model: e.target.value };
                setProvider(next);
                saveAiConfig(next);
              }}
              placeholder="model"
            />
            {(provider.id === "ollama" || provider.id === "openai-compatible") && (
              <input
                value={provider.baseUrl || ""}
                onChange={(e) => {
                  const next = { ...provider, baseUrl: e.target.value };
                  setProvider(next);
                  saveAiConfig(next);
                }}
                placeholder={
                  provider.id === "ollama"
                    ? "http://localhost:11434"
                    : "http://host/v1/chat/completions"
                }
              />
            )}
          </div>
        </label>

        <textarea
          className="rassam-mermaid-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={5}
        />
        {preview && (
          <pre className="rassam-ai-preview">{preview.slice(0, 800)}</pre>
        )}
        {error && <p className="rassam-mermaid-error">{error}</p>}
        <div className="rassam-mermaid-actions">
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                const system =
                  locale === "ar" ? AI_SYSTEM_PROMPT_AR : AI_SYSTEM_PROMPT_EN;
                const result = await completeChat(provider, [
                  { role: "system", content: system },
                  { role: "user", content: text },
                ]);
                setPreview(result.text);
                if (!insertFromAiOutput(result.text)) {
                  setError(
                    locale === "ar"
                      ? "تعذر تحويل الناتج إلى عناصر — أعد المحاولة أو أدرج يدويًا."
                      : "Could not map model output to elements.",
                  );
                } else {
                  onClose();
                }
              } catch (err) {
                setError(err instanceof Error ? err.message : "ai_failed");
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy
              ? locale === "ar"
                ? "جارٍ التوليد…"
                : "Generating…"
              : locale === "ar"
                ? "توليد وإدراج"
                : "Generate & insert"}
          </button>
        </div>
      </div>
    </div>
  );
}
