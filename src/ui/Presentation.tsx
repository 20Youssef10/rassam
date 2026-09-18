import { useEffect, useMemo, useState } from "react";

import type { Messages } from "../i18n/ar";
import type { RassamElement, Viewport } from "../core/types";
import { elementBounds } from "../core/geometry";
import { isFrame } from "../core/frames";
import { ARABIC_FONT } from "../core/types";

export type Slide = {
  frame: RassamElement;
  elements: RassamElement[];
};

export function collectSlides(elements: RassamElement[]): Slide[] {
  const frames = elements.filter((el) => el.type === "frame");
  return frames
    .map((frame) => {
      const fb = elementBounds(frame);
      const contents = elements.filter((el) => {
        if (el.id === frame.id || el.type === "frame") {
          return false;
        }
        const b = elementBounds(el);
        const cx = b.x + b.width / 2;
        const cy = b.y + b.height / 2;
        return (
          cx >= fb.x &&
          cx <= fb.x + fb.width &&
          cy >= fb.y &&
          cy <= fb.y + fb.height
        );
      });
      return { frame, elements: contents };
    })
    .sort((a, b) => {
      const ab = elementBounds(a.frame);
      const bb = elementBounds(b.frame);
      return ab.y - bb.y || ab.x - bb.x;
    });
}

export function frameToViewport(
  frame: RassamElement,
  canvasW: number,
  canvasH: number,
  padding = 32,
): Viewport {
  const b = elementBounds(frame);
  const zoom = Math.min(
    (canvasW - padding * 2) / Math.max(b.width, 1),
    (canvasH - padding * 2) / Math.max(b.height, 1),
    2,
  );
  return {
    zoom,
    scrollX: -(b.x - (canvasW / zoom - b.width) / 2),
    scrollY: -(b.y - (canvasH / zoom - b.height) / 2),
  };
}

export function PresentationOverlay({
  messages,
  locale,
  slides,
  index,
  onNext,
  onPrev,
  onExit,
}: {
  messages: Messages;
  locale: "ar" | "en";
  slides: Slide[];
  index: number;
  onNext: () => void;
  onPrev: () => void;
  onExit: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onExit();
        return;
      }
      if (e.key === "ArrowRight" || e.key === " " || e.key === "PageDown") {
        e.preventDefault();
        onNext();
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        onPrev();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onPrev, onExit]);

  const slide = slides[index];
  const title = useMemo(() => {
    if (!slide) {
      return "";
    }
    const frame = slide.frame as { name?: string; label?: string };
    return frame.name || frame.label || `${locale === "ar" ? "شريحة" : "Slide"} ${index + 1}`;
  }, [slide, index, locale]);

  if (!slide) {
    return null;
  }

  return (
    <div className="rassam-present" dir={messages.dir} role="dialog" aria-modal="true">
      <div className="rassam-present-header">
        <strong>
          {title} · {index + 1}/{slides.length}
        </strong>
        <button type="button" onClick={onExit}>
          {locale === "ar" ? "خروج (Esc)" : "Exit (Esc)"}
        </button>
      </div>
      <div className="rassam-present-stage">
        <svg viewBox={presentationViewBox(slide)} className="rassam-present-svg">
          <rect
            x={elementBounds(slide.frame).x}
            y={elementBounds(slide.frame).y}
            width={elementBounds(slide.frame).width}
            height={elementBounds(slide.frame).height}
            fill="#F5F0E6"
          />
          {slide.elements.map((el) => (
            <PresentShape key={el.id} el={el} />
          ))}
        </svg>
      </div>
      <div className="rassam-present-nav">
        <button type="button" onClick={onPrev}>
          {locale === "ar" ? "السابق" : "Prev"}
        </button>
        <button type="button" onClick={onNext}>
          {locale === "ar" ? "التالي" : "Next"}
        </button>
      </div>
    </div>
  );
}

function presentationViewBox(slide: Slide): string {
  const b = elementBounds(slide.frame);
  const pad = 16;
  return `${b.x - pad} ${b.y - pad} ${b.width + pad * 2} ${b.height + pad * 2}`;
}

function PresentShape({ el }: { el: RassamElement }) {
  if (el.type === "rectangle" || el.type === "sticky" || el.type === "image") {
    return (
      <g>
        <rect
          x={el.x}
          y={el.y}
          width={"width" in el ? el.width : 0}
          height={"height" in el ? el.height : 0}
          fill={"fill" in el && el.fill !== "transparent" ? el.fill : "#fff"}
          stroke={el.stroke}
          strokeWidth={el.strokeWidth}
        />
        {"label" in el && el.label ? (
          <text
            x={el.x + 12}
            y={el.y + 24}
            fill={el.stroke}
            fontFamily={ARABIC_FONT}
            fontSize={16}
          >
            {el.label}
          </text>
        ) : null}
      </g>
    );
  }
  if (el.type === "diamond") {
    const cx = el.x + el.width / 2;
    const cy = el.y + el.height / 2;
    return (
      <polygon
        points={`${cx},${el.y} ${el.x + el.width},${cy} ${cx},${el.y + el.height} ${el.x},${cy}`}
        fill={el.fill !== "transparent" ? el.fill : "#fff"}
        stroke={el.stroke}
      />
    );
  }
  if (el.type === "ellipse") {
    return (
      <ellipse
        cx={el.x + el.width / 2}
        cy={el.y + el.height / 2}
        rx={el.width / 2}
        ry={el.height / 2}
        fill={el.fill !== "transparent" ? el.fill : "#fff"}
        stroke={el.stroke}
      />
    );
  }
  if (el.type === "text") {
    return (
      <text
        x={el.x}
        y={el.y + (el.fontSize || 16)}
        fill={el.stroke}
        fontFamily={el.fontFamily || ARABIC_FONT}
        fontSize={el.fontSize || 16}
      >
        {el.text}
      </text>
    );
  }
  if ((el.type === "line" || el.type === "arrow" || el.type === "draw") && el.points.length >= 2) {
    return (
      <polyline
        points={el.points.map((p) => `${p.x},${p.y}`).join(" ")}
        fill="none"
        stroke={el.stroke}
        strokeWidth={el.strokeWidth}
      />
    );
  }
  return null;
}

export function usePresentation(elements: RassamElement[]) {
  const slides = useMemo(() => collectSlides(elements), [elements]);
  const [presenting, setPresenting] = useState(false);
  const [index, setIndex] = useState(0);
  return {
    slides,
    presenting,
    index,
    start: () => {
      if (!slides.length) {
        return false;
      }
      setIndex(0);
      setPresenting(true);
      return true;
    },
    exit: () => setPresenting(false),
    next: () => setIndex((i) => Math.min(slides.length - 1, i + 1)),
    prev: () => setIndex((i) => Math.max(0, i - 1)),
  };
}

export { isFrame };
