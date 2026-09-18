import { useEffect, useRef } from "react";

import type { RassamElement, Viewport } from "../core/types";
import { elementBounds } from "../core/geometry";
import { sceneOverviewBounds } from "../core/stats";

export function Minimap({
  elements,
  viewport,
  width = 160,
  height = 110,
  onNavigate,
}: {
  elements: RassamElement[];
  viewport: Viewport;
  width?: number;
  height?: number;
  onNavigate: (scenePoint: { x: number; y: number }) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }
    const dpr = window.devicePixelRatio || 1;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "rgba(15,23,42,0.06)";
    ctx.fillRect(0, 0, width, height);

    const bounds = sceneOverviewBounds(elements, viewport, 40);
    const scale = Math.min(width / bounds.width, height / bounds.height);
    const ox = (width - bounds.width * scale) / 2 - bounds.x * scale;
    const oy = (height - bounds.height * scale) / 2 - bounds.y * scale;

    for (const el of elements) {
      const b = elementBounds(el);
      ctx.fillStyle =
        el.type === "frame"
          ? "rgba(37,99,235,0.35)"
          : el.type === "sticky"
            ? "rgba(217,119,6,0.45)"
            : "rgba(15,23,42,0.45)";
      ctx.fillRect(
        b.x * scale + ox,
        b.y * scale + oy,
        Math.max(2, b.width * scale),
        Math.max(2, b.height * scale),
      );
    }

    // viewport rect
    const vw = (1 / Math.max(viewport.zoom, 0.01)) * 1200 * scale;
    const vh = (1 / Math.max(viewport.zoom, 0.01)) * 800 * scale;
    const vx = -viewport.scrollX * scale + ox;
    const vy = -viewport.scrollY * scale + oy;
    ctx.strokeStyle = "#2563EB";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(vx, vy, vw, vh);

    canvas.dataset.scale = String(scale);
    canvas.dataset.ox = String(ox);
    canvas.dataset.oy = String(oy);
  }, [elements, viewport, width, height]);

  return (
    <canvas
      ref={canvasRef}
      className="rassam-minimap"
      aria-label="minimap"
      onClick={(e) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const rect = canvas.getBoundingClientRect();
        const scale = Number(canvas.dataset.scale || 1);
        const ox = Number(canvas.dataset.ox || 0);
        const oy = Number(canvas.dataset.oy || 0);
        const sx = (e.clientX - rect.left - ox) / scale;
        const sy = (e.clientY - rect.top - oy) / scale;
        onNavigate({ x: sx, y: sy });
      }}
    />
  );
}
