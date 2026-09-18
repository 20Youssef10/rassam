import type { Messages } from "../i18n/ar";
import type { Theme } from "../styles/tokens";
import { fillPalette, strokePalette } from "../styles/tokens";
import type { AlignMode } from "../core/align";
import type { CollabStatus } from "../collab/CollabClient";

function localeOpacityLabel(messages: Messages) {
  return messages.properties.strokeWidth && messages.dir === "rtl"
    ? "الشفافية"
    : "Opacity";
}

function normalizeHex(color: string): string {
  if (/^#[0-9a-fA-F]{6}$/.test(color)) {
    return color;
  }
  if (/^#[0-9a-fA-F]{3}$/.test(color)) {
    const r = color[1];
    const g = color[2];
    const b = color[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  return "#0F172A";
}

export function TopBar({
  messages,
  theme,
  strokeWidth,
  zoom,
  elementCount,
  selectionCount,
  undoDisabled,
  redoDisabled,
  collabStatus,
  collabLink,
  onUndo,
  onRedo,
  onClear,
  onExportPng,
  onExportPng2x,
  onExportPdf,
  onCopyPng,
  onExportSvg,
  onExportSvgSelection,
  onExportJson,
  onImportJson,
  onToggleHelp,
  onToggleGrid,
  onToggleSnap,
  onToggleStats,
  onToggleMinimap,
  onOpenPalette,
  onToggleZen,
  onToggleViewOnly,
  onOpenMermaid,
  onStartPresentation,
  onZoomIn,
  onZoomOut,
  onFitContent,
  onExportSelectedFrame,
  onImportExcalidraw,
  onToggleLayers,
  onToggleChat,
  onOpenAi,
  onSaveSnapshot,
  onAddComment,
  onOpacityChange,
  onStrokeStyleChange,
  opacity,
  strokeStyle,
  zenMode,
  viewOnly,
  gridEnabled,
  snapEnabled,
  onToggleTheme,
  onToggleLocale,
  onAlign,
  onDistribute,
  onStartCollab,
  onStartShareReadonly,
  onStopCollab,
  onCopyLink,
  stroke,
  fill,
  onStrokeChange,
  onFillChange,
  onStrokeWidthChange,
}: {
  messages: Messages;
  theme: Theme;
  strokeWidth: number;
  zoom: number;
  elementCount: number;
  selectionCount: number;
  undoDisabled: boolean;
  redoDisabled: boolean;
  collabStatus: CollabStatus;
  collabLink: string | null;
  onUndo: () => void;
  onRedo: () => void;
  onClear: () => void;
  onExportPng: () => void;
  onExportPng2x: () => void;
  onExportPdf: () => void;
  onCopyPng: () => void;
  onExportSvg: () => void;
  onExportSvgSelection: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onToggleHelp: () => void;
  onToggleGrid: () => void;
  onToggleSnap: () => void;
  onToggleStats: () => void;
  onToggleMinimap: () => void;
  onOpenPalette: () => void;
  onToggleZen: () => void;
  onToggleViewOnly: () => void;
  onOpenMermaid: () => void;
  onStartPresentation: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitContent: () => void;
  onExportSelectedFrame: () => void;
  onImportExcalidraw: () => void;
  onToggleLayers: () => void;
  onToggleChat: () => void;
  onOpenAi: () => void;
  onSaveSnapshot: () => void;
  onAddComment: () => void;
  onOpacityChange: (opacity: number) => void;
  onStrokeStyleChange: (style: "solid" | "dashed" | "dotted") => void;
  opacity: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  zenMode: boolean;
  viewOnly: boolean;
  gridEnabled: boolean;
  snapEnabled: boolean;
  onToggleTheme: () => void;
  onToggleLocale: () => void;
  onAlign: (mode: AlignMode) => void;
  onDistribute: (axis: "x" | "y") => void;
  onStartCollab: () => void;
  onStartShareReadonly: () => void;
  onStopCollab: () => void;
  onCopyLink: () => void;
  stroke: string;
  fill: string;
  onStrokeChange: (c: string) => void;
  onFillChange: (c: string) => void;
  onStrokeWidthChange: (w: number) => void;
}) {
  const collabLabel =
    collabStatus === "connected"
      ? messages.collab.connected
      : collabStatus === "connecting"
        ? messages.collab.connecting
        : collabStatus === "read-only"
          ? messages.collab.readOnly
          : collabStatus === "error"
            ? messages.collab.offline
            : "";

  return (
    <header className="rassam-topbar" dir={messages.dir}>
      <div className="rassam-brand">
        <img
          className="rassam-brand-mark"
          src="/icon.svg"
          width={40}
          height={40}
          alt=""
        />
        <div>
          <strong>{messages.brand}</strong>
          <small>{messages.tagline}</small>
        </div>
      </div>

      <div className="rassam-topbar-center">
        <div className="rassam-swatches" aria-label={messages.properties.stroke}>
          <span className="rassam-label">{messages.properties.stroke}</span>
          {strokePalette.map((c) => (
            <button
              key={`s-${c}`}
              type="button"
              className={`rassam-swatch ${stroke === c ? "is-active" : ""}`}
              style={{ background: c }}
              onClick={() => onStrokeChange(c)}
              aria-label={c}
            />
          ))}
          <label className="rassam-hex-picker">
            <input
              type="color"
              value={stroke && stroke !== "transparent" ? normalizeHex(stroke) : "#0F172A"}
              onChange={(e) => onStrokeChange(e.target.value)}
              aria-label="hex stroke"
            />
            <input
              type="text"
              value={stroke}
              onChange={(e) => onStrokeChange(e.target.value)}
              aria-label="stroke hex"
            />
          </label>
        </div>
        <div className="rassam-swatches" aria-label={messages.properties.fill}>
          <span className="rassam-label">{messages.properties.fill}</span>
          {fillPalette.map((c) => (
            <button
              key={`f-${c}`}
              type="button"
              className={`rassam-swatch ${fill === c ? "is-active" : ""} ${
                c === "transparent" ? "is-transparent" : ""
              }`}
              style={{ background: c === "transparent" ? undefined : c }}
              onClick={() => onFillChange(c)}
              aria-label={c}
            >
              {c === "transparent" ? "∅" : undefined}
            </button>
          ))}
        </div>
        <label className="rassam-range">
          <span>{messages.properties.strokeWidth}</span>
          <input
            type="range"
            min={1}
            max={8}
            value={strokeWidth}
            onChange={(e) => onStrokeWidthChange(Number(e.target.value))}
          />
        </label>
        <label className="rassam-range">
          <span>{localeOpacityLabel(messages)}</span>
          <input
            type="range"
            min={10}
            max={100}
            value={Math.round(opacity * 100)}
            onChange={(e) => onOpacityChange(Number(e.target.value) / 100)}
          />
        </label>
        <select
          className="rassam-stroke-style"
          value={strokeStyle}
          onChange={(e) =>
            onStrokeStyleChange(e.target.value as "solid" | "dashed" | "dotted")
          }
          aria-label="stroke style"
        >
          <option value="solid">—</option>
          <option value="dashed">--- </option>
          <option value="dotted">···</option>
        </select>
        <div className="rassam-zoom-group">
          <button type="button" onClick={onZoomOut} title="−">
            −
          </button>
          <button type="button" onClick={onZoomIn} title="+">
            +
          </button>
          <button type="button" onClick={onFitContent} title="fit">
            ⤢
          </button>
        </div>
        {selectionCount >= 1 && (
          <button type="button" onClick={onExportSelectedFrame} title="export frame">
            ▣
          </button>
        )}
        <button type="button" onClick={onImportExcalidraw} title=".excalidraw">
          .excalidraw
        </button>
        <button type="button" onClick={onToggleLayers} title={messages.advanced.layers}>
          {messages.advanced.layers}
        </button>
        <button type="button" onClick={onToggleChat} title={messages.advanced.chat}>
          {messages.advanced.chat}
        </button>
        <button type="button" onClick={onOpenAi} title={messages.advanced.ai}>
          {messages.advanced.ai}
        </button>
        <button type="button" onClick={onSaveSnapshot} title="snapshot">
          {messages.dir === "rtl" ? "لقطة" : "Snapshot"}
        </button>
        <button type="button" onClick={onAddComment} title="comment">
          {messages.dir === "rtl" ? "تعليق" : "Comment"}
        </button>
        {selectionCount >= 2 && (
          <div className="rassam-align-group">
            <button type="button" onClick={() => onAlign("left")} title={messages.actions.alignLeft}>
              ⇤
            </button>
            <button type="button" onClick={() => onAlign("centerH")} title={messages.actions.alignCenterH}>
              ↔
            </button>
            <button type="button" onClick={() => onAlign("right")} title={messages.actions.alignRight}>
              ⇥
            </button>
            <button type="button" onClick={() => onAlign("top")} title={messages.actions.alignTop}>
              ⇤
            </button>
            <button type="button" onClick={() => onAlign("centerV")} title={messages.actions.alignCenterV}>
              ↕
            </button>
            <button type="button" onClick={() => onAlign("bottom")} title={messages.actions.alignBottom}>
              ⇥
            </button>
            <button type="button" onClick={() => onDistribute("x")} title={messages.actions.distributeX}>
              ⇔
            </button>
            <button type="button" onClick={() => onDistribute("y")} title={messages.actions.distributeY}>
              ⇕
            </button>
          </div>
        )}
      </div>

      <div className="rassam-topbar-actions">
        <span className="rassam-meta">
          {elementCount} {messages.status.elements}
          {selectionCount > 0 ? ` · ${selectionCount} ${messages.status.selected}` : ""}
          {" · "}
          {Math.round(zoom * 100)}%
          {collabLabel ? ` · ${collabLabel}` : ""}
        </span>
        <button type="button" onClick={onUndo} disabled={undoDisabled}>
          {messages.actions.undo}
        </button>
        <button type="button" onClick={onRedo} disabled={redoDisabled}>
          {messages.actions.redo}
        </button>
        <button type="button" onClick={onExportPng}>
          {messages.actions.exportPng}
        </button>
        <button type="button" onClick={onExportPng2x} title="PNG@2x">
          PNG@2x
        </button>
        <button type="button" onClick={onExportPdf} title="PDF">
          PDF
        </button>
        <button type="button" onClick={onCopyPng} title="copy image">
          ⎘PNG
        </button>
        <button type="button" onClick={onExportSvg}>
          {messages.actions.exportSvg}
        </button>
        {selectionCount > 0 && (
          <button type="button" onClick={onExportSvgSelection}>
            SVG*
          </button>
        )}
        <button type="button" onClick={onExportJson}>
          {messages.actions.exportJson}
        </button>
        <button type="button" onClick={onImportJson}>
          {messages.actions.importJson}
        </button>
        <button
          type="button"
          onClick={onToggleGrid}
          aria-pressed={gridEnabled}
          title={messages.actions.grid}
        >
          {gridEnabled ? "▦" : "▢"} {messages.actions.grid}
        </button>
        <button
          type="button"
          onClick={onToggleSnap}
          aria-pressed={snapEnabled}
          title={messages.actions.snap}
        >
          {messages.actions.snap}
        </button>
        <button type="button" onClick={onToggleHelp} title={messages.actions.help}>
          ?
        </button>
        <button type="button" onClick={onOpenPalette} title={messages.advanced.palette}>
          ⌘K
        </button>
        <button type="button" onClick={onOpenMermaid} title={messages.advanced.mermaid}>
          {messages.advanced.mermaid}
        </button>
        <button type="button" onClick={onStartPresentation} title={messages.advanced.present}>
          {messages.advanced.present}
        </button>
        <button
          type="button"
          onClick={onToggleZen}
          aria-pressed={zenMode}
          title={messages.advanced.zen}
        >
          {messages.advanced.zen}
        </button>
        <button
          type="button"
          onClick={onToggleViewOnly}
          aria-pressed={viewOnly}
          title={messages.advanced.viewOnly}
        >
          {messages.advanced.viewOnly}
        </button>
        <button type="button" onClick={onToggleStats} title={messages.advanced.stats}>
          {messages.advanced.stats}
        </button>
        <button type="button" onClick={onToggleMinimap} title={messages.advanced.minimap}>
          {messages.advanced.minimap}
        </button>
        {collabStatus === "idle" || collabStatus === "error" ? (
          <>
            <button type="button" onClick={onStartCollab}>
              {messages.collab.start}
            </button>
            <button type="button" onClick={onStartShareReadonly}>
              {messages.collab.shareReadOnly}
            </button>
          </>
        ) : (
          <>
            {collabLink && (
              <button type="button" onClick={onCopyLink}>
                {messages.collab.copyLink}
              </button>
            )}
            <button type="button" onClick={onStopCollab}>
              {messages.collab.stop}
            </button>
          </>
        )}
        <button type="button" onClick={onClear}>
          {messages.actions.clear}
        </button>
        <button type="button" onClick={onToggleTheme} title={messages.actions.theme}>
          {theme === "dark" ? "☀" : "☾"}
        </button>
        <button type="button" onClick={onToggleLocale}>
          {messages.actions.language}
        </button>
      </div>
    </header>
  );
}
