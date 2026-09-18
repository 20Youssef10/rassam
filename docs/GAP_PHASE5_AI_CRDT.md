# Gap Phase 5+ — CRDT, Mermaid advanced, PDF, plugins, multi-provider AI

Implemented in `D:\rassam-greenfield`. Typecheck + production build pass.

## 1. Multi-provider AI (`src/ai/providers.ts`)

| Provider | Endpoint (docs) | Auth / body |
|----------|-----------------|-------------|
| **OpenAI** | `POST https://api.openai.com/v1/chat/completions` | `Authorization: Bearer`; `{model, messages}` |
| **OpenRouter** | `POST https://openrouter.ai/api/v1/chat/completions` | Bearer + `HTTP-Referer` / `X-Title`; OpenAI-compatible |
| **Anthropic** | `POST https://api.anthropic.com/v1/messages` | `x-api-key` + `anthropic-version: 2023-06-01`; `system` top-level; **required** `max_tokens` |
| **Gemini** | `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` | `x-goog-api-key`; `systemInstruction` + `contents[].parts[]` |
| **Ollama** | `POST {host}/api/chat` (default `http://localhost:11434`) | `{model, messages, stream:false}` → `message.content` |
| **OpenAI-compatible** | any `/chat/completions` base URL | Bearer + OpenAI body |
| **Local heuristic** | offline | existing نص→مخطط parser |

UI: AI dialog — provider, key, model, base URL (Ollama/custom), generate → Mermaid/sequence/class/state/heuristic → insert.

## 2. Full CRDT/OT (`src/core/crdt.ts`)

- Per-element **Lamport clocks** + actor id  
- Ops: `upsert` / `delete` with clock+actor conflict resolution  
- `opsFromDiff` / `mergeOps` / serialize for room snapshots  
- Socket channel `crdt-broadcast` (E2E-encrypted op batches)  
- Room server relays CRDT payloads  

## 3. Advanced Mermaid (`src/core/mermaidAdvanced.ts`)

- `sequenceDiagram` → actors, lifelines, labeled arrows  
- `classDiagram` → class boxes + members  
- `stateDiagram` → elliptical states + transitions  
- Existing flowchart/LR/TD parser retained; dialog auto-detects kind  

## 4. PDF export (`src/core/pdf.ts`)

- Dependency-free **PDF 1.4** writer (JPEG / DCTDecode page)  
- `exportPdf` API + top-bar **PDF** button (canvas raster → `.pdf`)  
- Browser `printScene` fallback  

## 5. Plugins (`src/plugins/registry.ts`)

- Plugin API: `setup(ctx)`, palette command registration, scene/export hooks  
- Built-ins: Arabic stamp insert, scene word-count command  
- User plugins persisted in `localStorage`  
- Plugin commands appear in **Ctrl+K** palette  

## Still open
- Sequence/class UI editing beyond import  
- Cloud AI keys stored only in localStorage (user-owned)  
- Phase 5 launch packaging — **on request**  

## Run
```bash
npm run start:stack
npm run dev
```
Use **نص→مخطط** for AI providers; **Mermaid** for flow/sequence/class/state; **PDF** export; palette for plugin stamps.
