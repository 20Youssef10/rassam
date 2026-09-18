/**
 * Arabic-aware text-to-diagram (heuristic TTD — no external AI backend).
 * Parses simple Modern Standard Arabic (and English) flow phrases into
 * shapes + arrows, similar to Mermaid but natural-language first.
 *
 * Examples:
 *   البداية ثم القرار ثم العملية ثم النهاية
 *   start -> decision -> process -> end
 *   أ --> ب --> ج
 */
import type { RassamElement } from "./types";
import { createId, randomSeed } from "./ids";
import { ARABIC_FONT } from "./types";

const ARROW_SPLIT =
  /\s*(?:-->|→|=>|ثم|ثمّ|ومن ثم|الى|إلى|to|then|\|)\s*/iu;

function classify(label: string): "diamond" | "ellipse" | "rectangle" {
  const s = label.trim();
  if (
    /هل|قرار|متأكد|نعم|لا|؟|\?|decision|ready|yes|no/i.test(s) ||
    s.endsWith("؟") ||
    s.endsWith("?")
  ) {
    return "diamond";
  }
  if (/بداية|نهاية|start|end|تمام|تمّ/i.test(s)) {
    return "ellipse";
  }
  return "rectangle";
}

export function arabicTextToDiagram(
  input: string,
  origin = { x: 0, y: 0 },
): RassamElement[] {
  const text = input.trim().replace(/\n+/g, " ");
  if (!text) {
    return [];
  }

  let steps: string[];
  if (ARROW_SPLIT.test(text) || /-->/.test(text)) {
    steps = text
      .split(ARROW_SPLIT)
      .map((s) => s.trim())
      .filter(Boolean);
  } else if (text.includes("،") || text.includes(",")) {
    steps = text
      .split(/[،,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  } else {
    steps = text.split(/\s+/).filter((w) => w.length > 1);
    // group words into short phrases of 2 when Arabic
    if (steps.every((w) => /[\u0600-\u06FF]/.test(w)) && steps.length > 3) {
      const grouped: string[] = [];
      for (let i = 0; i < steps.length; i += 2) {
        grouped.push(steps.slice(i, i + 2).join(" "));
      }
      steps = grouped;
    }
  }

  steps = steps.slice(0, 8);
  if (!steps.length) {
    return [];
  }

  const elements: RassamElement[] = [];
  const shapeW = 140;
  const shapeH = 70;
  const gapX = 60;
  const gapY = 40;
  const cols = Math.min(steps.length, 3);

  const centers: { x: number; y: number }[] = [];
  steps.forEach((label, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = origin.x + col * (shapeW + gapX);
    const y = origin.y + row * (shapeH + gapY + 20);
    const shape = classify(label);
    const fill =
      shape === "diamond" ? "#FEF3C7" : shape === "ellipse" ? "#CCFBF1" : "#DBEAFE";
    const stroke =
      shape === "diamond" ? "#D97706" : shape === "ellipse" ? "#0D9488" : "#2563EB";
    elements.push({
      id: createId(),
      type: shape,
      x,
      y,
      width: shapeW,
      height: shapeH,
      fill,
      stroke,
      strokeWidth: 2,
      opacity: 1,
      seed: randomSeed(),
      label,
    } as RassamElement);
    centers.push({ x: x + shapeW / 2, y: y + shapeH / 2 });
  });

  for (let i = 0; i < centers.length - 1; i++) {
    const a = centers[i];
    const b = centers[i + 1];
    elements.push({
      id: createId(),
      type: "arrow",
      x: a.x,
      y: a.y,
      points: [a, b],
      fill: "transparent",
      stroke: "#0F172A",
      strokeWidth: 2,
      opacity: 1,
      seed: randomSeed(),
      elbow: true,
    } as RassamElement);
  }

  // caption
  elements.push({
    id: createId(),
    type: "text",
    x: origin.x,
    y: origin.y - 40,
    text: text.slice(0, 48),
    fontSize: 16,
    fontFamily: ARABIC_FONT,
    width: Math.min(320, text.length * 10),
    height: 24,
    fill: "transparent",
    stroke: "#0F172A",
    strokeWidth: 1,
    opacity: 0.85,
    seed: randomSeed(),
  } as RassamElement);

  return elements;
}

export const AI_TTD_SAMPLES = [
  "البداية ثم هل جاهز؟ ثم نعم ابدأ الرسم ثم النهاية",
  "start -> gather requirements -> design -> implement -> done",
];
