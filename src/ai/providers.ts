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

import { sanitizeProviderBaseUrl } from "../core/security";

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

async function fetchWithTimeout(url: string, init: RequestInit, ms = 30000): Promise<Response> {
  const ctrl = new AbortController();
  const t = window.setTimeout(() => ctrl.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    window.clearTimeout(t);
  }
}

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

type ProviderContext = {
  config: AiProviderConfig;
  model: string;
  systemPrompt: string;
  chat: AiMessage[];
  messages: AiMessage[];
};

type ProviderHandler = (ctx: ProviderContext) => Promise<AiCompletion>;

function requireApiKey(config: AiProviderConfig): string {
  if (!config.apiKey) {
    throw new Error("missing_api_key");
  }
  return config.apiKey;
}

async function completeLocalHeuristic(ctx: ProviderContext): Promise<AiCompletion> {
  const last = [...ctx.messages].reverse().find((m) => m.role === "user");
  return { text: last?.content ?? "", provider: "local-heuristic" };
}

async function completeOpenAI(ctx: ProviderContext): Promise<AiCompletion> {
  const apiKey = requireApiKey(ctx.config);
  const res = await fetchWithTimeout(OPENAI_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: ctx.model, messages: ctx.messages, temperature: 0.3 }),
  });
  return { text: await readOpenAiStyle(res), provider: "openai", model: ctx.model };
}

async function completeOpenRouter(ctx: ProviderContext): Promise<AiCompletion> {
  const apiKey = requireApiKey(ctx.config);
  const res = await fetchWithTimeout(OPENROUTER_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": typeof window !== "undefined" ? window.location.origin : "https://rassam.local",
      "X-Title": "Rassam",
    },
    body: JSON.stringify({ model: ctx.model, messages: ctx.messages, temperature: 0.3 }),
  });
  return { text: await readOpenAiStyle(res), provider: "openrouter", model: ctx.model };
}

async function completeOpenAICompatible(ctx: ProviderContext): Promise<AiCompletion> {
  const rawBase = (ctx.config.baseUrl || OPENAI_URL).replace(/\/$/, "");
  const safeBase = sanitizeProviderBaseUrl(rawBase);
  if (!safeBase) throw new Error("invalid_base_url");
  const url = safeBase.includes("/chat/completions")
    ? safeBase
    : `${safeBase}/v1/chat/completions`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${ctx.config.apiKey || ""}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ model: ctx.model, messages: ctx.messages, temperature: 0.3 }),
  });
  return { text: await readOpenAiStyle(res), provider: "openai-compatible", model: ctx.model };
}

async function completeAnthropic(ctx: ProviderContext): Promise<AiCompletion> {
  const apiKey = requireApiKey(ctx.config);
  const res = await fetchWithTimeout(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": ctx.config.anthropicVersion || ANTHROPIC_VERSION,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: ctx.model,
      max_tokens: 2048,
      system: ctx.systemPrompt,
      messages: ctx.chat,
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
  return { text, provider: "anthropic", model: ctx.model };
}

async function completeGemini(ctx: ProviderContext): Promise<AiCompletion> {
  const apiKey = requireApiKey(ctx.config);
  const url = `${GEMINI_BASE}/${encodeURIComponent(ctx.model)}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "x-goog-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: ctx.systemPrompt }] },
      contents: ctx.chat.map((m) => ({
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
  return { text, provider: "gemini", model: ctx.model };
}

async function completeOllama(ctx: ProviderContext): Promise<AiCompletion> {
  const rawHost = (ctx.config.baseUrl || OLLAMA_DEFAULT).replace(/\/$/, "");
  const host = sanitizeProviderBaseUrl(rawHost) || OLLAMA_DEFAULT;
  const res = await fetchWithTimeout(`${host}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: ctx.model,
      messages: [{ role: "system", content: ctx.systemPrompt }, ...ctx.chat],
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
  return { text: json.message?.content ?? "", provider: "ollama", model: ctx.model };
}

const PROVIDER_HANDLERS: Record<AiProviderId, ProviderHandler> = {
  "local-heuristic": completeLocalHeuristic,
  openai: completeOpenAI,
  openrouter: completeOpenRouter,
  "openai-compatible": completeOpenAICompatible,
  anthropic: completeAnthropic,
  gemini: completeGemini,
  ollama: completeOllama,
};

export async function completeChat(
  config: AiProviderConfig,
  messages: AiMessage[],
): Promise<AiCompletion> {
  const handler = PROVIDER_HANDLERS[config.id];
  if (!handler) {
    throw new Error("unsupported_provider");
  }
  const model = config.model || DEFAULT_MODELS[config.id as keyof typeof DEFAULT_MODELS] || "";
  return handler({
    config,
    model,
    systemPrompt: messages.find((m) => m.role === "system")?.content || AI_SYSTEM_PROMPT_AR,
    chat: messages.filter((m) => m.role !== "system"),
    messages,
  });
}

export function saveAiConfig(config: AiProviderConfig, opts?: { persistKey?: boolean }): void {
  try {
    // API keys are long-lived secrets: do not persist by default.
    // Only persist non-secret fields; keep key in memory unless explicitly opted in.
    const { apiKey, ...rest } = config;
    const toStore = opts?.persistKey && apiKey ? { ...rest, apiKey } : rest;
    try {
      sessionStorage.setItem("rassam-ai-config", JSON.stringify(toStore));
    } catch {
      // Session storage unavailable (private mode) — localStorage below is the fallback.
    }
    localStorage.setItem("rassam-ai-config", JSON.stringify(toStore));
  } catch {
    // Config persistence is best-effort — the in-memory config keeps working.
  }
}

export function clearAiApiKey(): void {
  try {
    const raw = localStorage.getItem("rassam-ai-config");
    if (!raw) return;
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    delete parsed.apiKey;
    localStorage.setItem("rassam-ai-config", JSON.stringify(parsed));
    sessionStorage.removeItem("rassam-ai-config");
  } catch {
    // Key cleanup is best-effort — in-memory state is already cleared by the caller.
  }
}

export function loadAiConfig(): AiProviderConfig | null {
  try {
    return JSON.parse(localStorage.getItem("rassam-ai-config") || "null");
  } catch {
    // Corrupt AI config cache is not fatal — fall back to defaults.
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
