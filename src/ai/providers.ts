/**
 * Rassam AI — multi-provider chat clients.
 *
 * Endpoints (verified against public docs):
 * - OpenAI:     POST https://api.openai.com/v1/chat/completions  (Bearer key)
 * - OpenRouter: POST https://openrouter.ai/api/v1/chat/completions (Bearer; OpenAI-compatible)
 * - Anthropic:  POST https://api.anthropic.com/v1/messages
 *               headers: x-api-key, anthropic-version: 2023-06-01; body.system top-level; max_tokens required
 * - Gemini:     POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent
 *               header x-goog-api-key (or ?key=); contents[].parts[].text
 * - Ollama:     POST {host}/api/chat  body {model, messages, stream:false} → message.content
 * - Compatible: any OpenAI-style /chat/completions (custom baseURL)
 */

export type AiRole = "system" | "user" | "assistant";

export type AiMessage = { role: AiRole; content: string };

export type AiProviderId =
  | "local-heuristic"
  | "openai"
  | "anthropic"
  | "gemini"
  | "ollama"
  | "openrouter"
  | "openai-compatible";

export type AiProviderConfig = {
  id: AiProviderId;
  labelAr: string;
  labelEn: string;
  /** API key (client-side; store per user) */
  apiKey?: string;
  /** Override base URL (OpenAI-compatible / Ollama host) */
  baseUrl?: string;
  model?: string;
  /** Anthropic version header */
  anthropicVersion?: string;
};

export type AiCompletion = {
  text: string;
  provider: AiProviderId;
  model?: string;
};

export const AI_SYSTEM_PROMPT_AR =
  "أنت مساعد لرسم مخططات على سبورة رسَّام العربية. أعد نص مخطط Mermaid صالحاً فقط (flowchart/sequence/class/state) دون شرح، أو أعد قائمة خطوات بالعربية.";

export const AI_SYSTEM_PROMPT_EN =
  "You help draw diagrams on the Rassam Arabic whiteboard. Reply with only valid Mermaid (flowchart/sequence/class/state) or a short step list.";

const DEFAULT_MODELS: Record<Exclude<AiProviderId, "local-heuristic">, string> = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
  gemini: "gemini-2.0-flash",
  ollama: "llama3.2",
  openrouter: "openai/gpt-4o-mini",
  "openai-compatible": "gpt-4o-mini",
};

const OPENAI_URL = "https://api.openai.com/v1/chat/completions";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const GEMINI_BASE =
  "https://generativelanguage.googleapis.com/v1beta/models";
const OLLAMA_DEFAULT = "http://localhost:11434";

async function readOpenAiStyle(res: Response): Promise<string> {
  const json = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(json.error?.message || `HTTP ${res.status}`);
  }
  return json.choices?.[0]?.message?.content ?? "";
}

export async function completeChat(
  config: AiProviderConfig,
  messages: AiMessage[],
): Promise<AiCompletion> {
  if (config.id === "local-heuristic") {
    const last = [...messages].reverse().find((m) => m.role === "user");
    return { text: last?.content ?? "", provider: "local-heuristic" };
  }

  const model = config.model || DEFAULT_MODELS[config.id];
  const sys =
    messages.find((m) => m.role === "system")?.content || AI_SYSTEM_PROMPT_AR;
  const chat = messages.filter((m) => m.role !== "system");

  if (config.id === "openai") {
    const res = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });
    return { text: await readOpenAiStyle(res), provider: "openai", model };
  }

  if (config.id === "openrouter") {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey || ""}`,
        "Content-Type": "application/json",
        "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://rassam.local",
        "X-Title": "Rassam",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });
    return { text: await readOpenAiStyle(res), provider: "openrouter", model };
  }

  if (config.id === "openai-compatible") {
    const base = (config.baseUrl || OPENAI_URL).replace(/\/$/, "");
    const url = base.includes("/chat/completions")
      ? base
      : `${base}/v1/chat/completions`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey || ""}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model, messages, temperature: 0.3 }),
    });
    return { text: await readOpenAiStyle(res), provider: "openai-compatible", model };
  }

  if (config.id === "anthropic") {
    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": config.apiKey || "",
        "anthropic-version": config.anthropicVersion || ANTHROPIC_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 2048,
        system: sys,
        messages: chat,
        temperature: 0.3,
      }),
    });
    const json = (await res.json()) as {
      content?: { type: string; text?: string }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}`);
    }
    const text =
      json.content?.find((c) => c.type === "text")?.text ??
      json.content?.[0]?.text ??
      "";
    return { text, provider: "anthropic", model };
  }

  if (config.id === "gemini") {
    const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "x-goog-api-key": config.apiKey || "",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sys }] },
        contents: chat.map((m) => ({
          role: m.role === "assistant" ? "model" : "user",
          parts: [{ text: m.content }],
        })),
        generationConfig: { temperature: 0.3 },
      }),
    });
    const json = (await res.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(json.error?.message || `HTTP ${res.status}`);
    }
    const text = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return { text, provider: "gemini", model };
  }

  if (config.id === "ollama") {
    const host = (config.baseUrl || OLLAMA_DEFAULT).replace(/\/$/, "");
    const res = await fetch(`${host}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: sys }, ...chat],
        stream: false,
      }),
    });
    const json = (await res.json()) as {
      message?: { content?: string };
      error?: string;
    };
    if (!res.ok) {
      throw new Error(json.error || `HTTP ${res.status}`);
    }
    return { text: json.message?.content ?? "", provider: "ollama", model };
  }

  throw new Error("unsupported_provider");
}

export function saveAiConfig(config: AiProviderConfig): void {
  try {
    localStorage.setItem("rassam-ai-config", JSON.stringify(config));
  } catch {
    // ignore
  }
}

export function loadAiConfig(): AiProviderConfig | null {
  try {
    return JSON.parse(localStorage.getItem("rassam-ai-config") || "null");
  } catch {
    return null;
  }
}

export const AI_PROVIDER_PRESETS: AiProviderConfig[] = [
  {
    id: "local-heuristic",
    labelAr: "محلي (بلا إنترنت)",
    labelEn: "Local heuristic",
  },
  {
    id: "ollama",
    labelAr: "Ollama محلي",
    labelEn: "Ollama (local)",
    baseUrl: "http://localhost:11434",
    model: "llama3.2",
  },
  {
    id: "openai",
    labelAr: "OpenAI",
    labelEn: "OpenAI",
    model: "gpt-4o-mini",
  },
  {
    id: "anthropic",
    labelAr: "Anthropic / Claude",
    labelEn: "Anthropic / Claude",
    model: "claude-haiku-4-5",
  },
  {
    id: "gemini",
    labelAr: "Google Gemini",
    labelEn: "Google Gemini",
    model: "gemini-2.0-flash",
  },
  {
    id: "openrouter",
    labelAr: "OpenRouter",
    labelEn: "OpenRouter",
    model: "openai/gpt-4o-mini",
  },
  {
    id: "openai-compatible",
    labelAr: "متوافق مع OpenAI (رابط مخصص)",
    labelEn: "OpenAI-compatible endpoint",
    baseUrl: "http://localhost:11434/v1/chat/completions",
    model: "llama3.2",
  },
];
