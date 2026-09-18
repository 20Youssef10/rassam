import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import rough from "roughjs";
import type { RoughCanvas } from "roughjs/bin/canvas";

import {
  ARABIC_FONT,
  DEFAULT_FONT_SIZE,
  MAX_ZOOM,
  MIN_ZOOM,
  type FilePayload,
  type RassamElement,
  type ResizeHandle,
  type Tool,
  type Viewport,
} from "../core/types";
import { createId, randomSeed } from "../core/ids";
import {
  canRedo,
  canUndo,
  createHistory,
  pushHistory,
  redo,
  replacePresent,
  undo,
  saveSnapshot,
  listSnapshots,
  restoreSnapshot,
  type HistoryState,
} from "../core/history";
import {
  clampZoom,
  clientToScene,
  cloneElements,
  elementBounds,
  handleCursor,
  hitResizeHandle,
  hitTestElements,
  normalizeRect,
  pointInBounds,
  resizeElement,
  translateElement,
} from "../core/geometry";
import { alignElements, distributeElements } from "../core/align";
import {
  bringForward,
  bringToFront,
  downloadTextFile,
  duplicateElements,
  exportSceneJson,
  flipElements,
  parseSceneJson,
  readClipboard,
  sendBackward,
  sendToBack,
  snapValue,
  writeClipboard,
} from "../core/clipboard";
import { ContextMenu, HelpDialog } from "../ui/ContextMenu";
import {
  HELP_SHORTCUTS,
  type ContextAction,
  type ContextMenuState,
} from "./contextMenu";
import { exportPngFromCanvas, exportSvgFile, copyCanvasToClipboard } from "../core/export";
import { ensureFontsReady, pickCanvasFontFamily } from "../core/fonts";
import { renderScene } from "../core/render";
import {
  expandGroupSelection,
  findBindableShape,
  groupElements,
  refreshBindings,
  setLocked,
  setRotation,
  ungroupElements,
} from "../core/transform";
import { elbowBetweenShapes } from "../core/elbow";
import { selectFrameContents } from "../core/frames";
import {
  appendLaserPoint,
  createLaserStroke,
  pruneLasers,
  type LaserStroke,
} from "../core/laser";
import { computeStats } from "../core/stats";
import { StatsPanel } from "../ui/StatsPanel";
import { Minimap } from "../ui/Minimap";
import { onRemoteCursor } from "../collab/events";
import { finalizeFreehand } from "../core/smooth";
import { snapToObjects, type SnapGuide } from "../core/snapGuides";
import {
  loadImageSize,
  loadScene,
  readFileAsDataURL,
  saveScene,
} from "../core/storage";
import { canvasPaper } from "../styles/tokens";
import type { Theme } from "../styles/tokens";
import type { Messages } from "../i18n/ar";
import type { CollabClient } from "../collab/CollabClient";

type DragMode =
  | { kind: "none" }
  | {
      kind: "draw";
      start: { x: number; y: number };
      current: { x: number; y: number };
    }
  | { kind: "freehand"; points: { x: number; y: number }[] }
  | {
      kind: "pan";
      originX: number;
      originY: number;
      scrollX: number;
      scrollY: number;
    }
  | {
      kind: "move";
      id: string;
      last: { x: number; y: number };
      snapshot: RassamElement[];
    }
  | {
      kind: "resize";
      id: string;
      handle: ResizeHandle;
      originBounds: ReturnType<typeof elementBounds>;
      originElement: RassamElement;
      snapshot: RassamElement[];
    }
  | {
      kind: "marquee";
      start: { x: number; y: number };
      current: { x: number; y: number };
    }
  | {
      kind: "lasso";
      path: { x: number; y: number }[];
    }
  | {
      kind: "point";
      id: string;
      index: number;
      snapshot: RassamElement[];
    };

export type EditorApi = {
  getElements: () => RassamElement[];
  getFiles: () => Record<string, FilePayload>;
  setRemoteScene: (
    elements: RassamElement[],
    files?: Record<string, FilePayload>,
  ) => void;
  exportPng: () => void;
  exportPngScaled: (scale: number, transparent?: boolean) => void;
  exportPdf: () => Promise<void>;
  copyPng: () => void;
  exportSvg: (selectedOnly?: boolean) => void;
  align: (mode: Parameters<typeof alignElements>[2]) => void;
  distribute: (axis: "x" | "y") => void;
  startCollabShare: (opts: { readOnly: boolean }) => Promise<string>;
  stopCollab: () => void;
  getSelectionCount: () => number;
  insertElements: (elements: RassamElement[]) => void;
  setPreferredFont: (family: string) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  toggleLockSelection: () => void;
  rotateSelection: (deltaRadians: number) => void;
  setSearchQuery: (query: string) => void;
  getSelectedIds: () => string[];
  getSearchQuery: () => string;
  copySelection: () => void;
  cutSelection: () => void;
  pasteClipboard: (at?: { x: number; y: number }) => void;
  duplicateSelection: () => void;
  deleteSelection: () => void;
  zOrder: (op: "front" | "back" | "forward" | "backward") => void;
  flipSelection: (axis: "horizontal" | "vertical") => void;
  exportJson: () => void;
  importJsonText: (raw: string) => void;
  setGridEnabled: (v: boolean) => void;
  setSnapEnabled: (v: boolean) => void;
  toggleHelp: () => void;
  editLinearPoints: (id: string | null) => void;
  setLinearLabel: (id: string, label: string) => void;
  runContextAction: (action: ContextAction) => void;
  setViewport: (v: Viewport) => void;
  getViewport: () => Viewport;
  setElementLink: (id: string, link: string | undefined) => void;
  openElementLink: (id: string) => void;
  toggleStats: () => void;
  toggleMinimap: () => void;
  exportFrame: (frameId: string) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  fitToContent: () => void;
  setSelectionStyle: (patch: Partial<RassamElement>) => void;
  importExcalidrawJson: (raw: string) => void;
  selectElement: (id: string, additive?: boolean) => void;
  saveHistorySnapshot: () => void;
  listHistorySnapshots: () => { id: string; label: string; ts: number }[];
  restoreHistorySnapshot: (id: string) => void;
  addComment: (x: number, y: number, text: string) => void;
  raiseElement: (id: string) => void;
  lowerElement: (id: string) => void;
};

export type EditorProps = {
  messages: Messages;
  theme: Theme;
  tool: Tool;
  stroke: string;
  fill: string;
  strokeWidth: number;
  preferredFont?: string;
  collabRef?: React.MutableRefObject<CollabClient | null>;
  apiRef?: React.MutableRefObject<EditorApi | null>;
  readOnly?: boolean;
  onViewportChange?: (viewport: Viewport) => void;
  onElementsChange?: (count: number) => void;
  onHistoryChange?: (canUndo: boolean, canRedo: boolean) => void;
  onSelectionChange?: (count: number) => void;
  onToolChange?: (tool: Tool) => void;
  clearSignal?: number;
};

function pointInPolygon(
  p: { x: number; y: number },
  poly: { x: number; y: number }[],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > p.y !== yj > p.y &&
      p.x < ((xj - xi) * (p.y - yi)) / (yj - yi + 0.0) + xi;
    if (intersect) {
      inside = !inside;
    }
  }
  return inside;
}

function createElementFromDraft(
  tool: Tool,
  start: { x: number; y: number },
  current: { x: number; y: number },
  style: { stroke: string; fill: string; strokeWidth: number },
): RassamElement | null {
  const rect = normalizeRect(start, current);
  const base = {
    id: createId(),
    stroke: style.stroke,
    fill: style.fill,
    strokeWidth: style.strokeWidth,
    opacity: 1,
    seed: randomSeed(),
    x: rect.x,
    y: rect.y,
  };

  if (tool === "rectangle") {
    return { ...base, type: "rectangle", width: rect.width, height: rect.height };
  }
  if (tool === "diamond") {
    return { ...base, type: "diamond", width: rect.width, height: rect.height };
  }
  if (tool === "ellipse") {
    return { ...base, type: "ellipse", width: rect.width, height: rect.height };
  }
  if (tool === "line" || tool === "arrow") {
    return {
      ...base,
      type: tool,
      x: start.x,
      y: start.y,
      points: [start, current],
    };
  }
  if (tool === "sticky") {
    return {
      ...base,
      type: "sticky",
      width: Math.max(120, rect.width),
      height: Math.max(100, rect.height),
      fill: "#FEF3C7",
      stroke: "#D97706",
      label: "ملاحظة",
    };
  }
  if (tool === "frame") {
    return {
      ...base,
      type: "frame",
      width: Math.max(200, rect.width),
      height: Math.max(160, rect.height),
      fill: "transparent",
      stroke: "#2563EB",
      strokeWidth: 1,
      name: "إطار",
    };
  }
  if (tool === "elbow") {
    return {
      ...base,
      type: "arrow",
      x: start.x,
      y: start.y,
      points: [start, current],
      elbow: true,
    };
  }
  return null;
}

export function Editor(props: EditorProps) {
  const {
    messages,
    theme,
    tool,
    stroke,
    fill,
    strokeWidth,
    preferredFont = "",
    collabRef,
    apiRef,
    readOnly = false,
    onViewportChange,
    onElementsChange,
    onHistoryChange,
    onSelectionChange,
    onToolChange,
    clearSignal,
  } = props;

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const roughRef = useRef<RoughCanvas | null>(null);
  const draftRef = useRef<RassamElement | null>(null);
  const dragRef = useRef<DragMode>({ kind: "none" });
  const styleRef = useRef({ stroke, fill, strokeWidth, preferredFont });
  styleRef.current = { stroke, fill, strokeWidth, preferredFont };
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pendingImageRef = useRef<FilePayload | null>(null);
  const lastClickRef = useRef<{ id: string; at: number } | null>(null);
  const readOnlyRef = useRef(readOnly);
  readOnlyRef.current = readOnly;
  const paintRafRef = useRef(0);
  const lastCursorSentRef = useRef(0);

  const initial = useMemo(() => {
    const saved = loadScene();
    return createHistory(saved?.elements ?? []);
  }, []);

  const [history, setHistory] = useState<HistoryState>(initial);
  const [files, setFiles] = useState<Record<string, FilePayload>>(
    () => loadScene()?.files ?? {},
  );
  const [viewport, setViewport] = useState<Viewport>(
    () => loadScene()?.viewport ?? { scrollX: 0, scrollY: 0, zoom: 1 },
  );
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [textStyle, setTextStyle] = useState({ left: 0, top: 0 });
  const [hoverHandle, setHoverHandle] = useState<ResizeHandle | null>(null);
  const [pendingImage, setPendingImage] = useState(false);
  const [marquee, setMarquee] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [collabUsers, setCollabUsers] = useState<string[]>([]);
  const [remoteCursors, setRemoteCursors] = useState<
    Record<string, { x: number; y: number; name?: string }>
  >({});
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const localeLabel = () =>
    messagesRef.current.dir === "rtl" ? "أدخل التسمية" : "Enter label";

  const [searchQuery, setSearchQuery] = useState("");
  const searchQueryRef = useRef("");
  searchQueryRef.current = searchQuery;
  const [gridEnabled, setGridEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const gridRef = useRef(gridEnabled);
  gridRef.current = gridEnabled;
  const snapRef = useRef(snapEnabled);
  snapRef.current = snapEnabled;
  const [menu, setMenu] = useState<ContextMenuState | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [editingLinearId, setEditingLinearId] = useState<string | null>(null);
  const editingLinearRef = useRef<string | null>(null);
  editingLinearRef.current = editingLinearId;
  const lassoRef = useRef<{ x: number; y: number }[] | null>(null);
  const laserActiveRef = useRef<string | null>(null);
  const [lasers, setLasers] = useState<LaserStroke[]>([]);
  const lasersRef = useRef(lasers);
  lasersRef.current = lasers;
  const [statsOpen, setStatsOpen] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [elbowMode, setElbowMode] = useState(false);
  const elbowModeRef = useRef(elbowMode);
  elbowModeRef.current = elbowMode || tool === "elbow";
  void setElbowMode;
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);
  const guidesRef = useRef(snapGuides);
  guidesRef.current = snapGuides;

  const elements = history.present;
  const elementsRef = useRef(elements);
  elementsRef.current = elements;
  const filesRef = useRef(files);
  filesRef.current = files;
  const viewportRef = useRef(viewport);
  viewportRef.current = viewport;
  const toolRef = useRef(tool);
  toolRef.current = tool;
  const selectedIdsRef = useRef(selectedIds);
  selectedIdsRef.current = selectedIds;

  const broadcastScene = useCallback(() => {
    const collab = collabRef?.current;
    if (collab && collab.connected && !collab.isReadOnly) {
      void collab.broadcastScene(elementsRef.current, filesRef.current);
    }
  }, [collabRef]);

  useEffect(() => {
    void ensureFontsReady([ARABIC_FONT]).then(() => paint());
    const canvas = canvasRef.current;
    if (canvas) {
      roughRef.current = rough.canvas(canvas);
    }
    return onRemoteCursor((c) => {
      setRemoteCursors((prev) => ({ ...prev, [c.userId]: { x: c.x, y: c.y, name: c.name } }));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const paint = useCallback(() => {
    if (paintRafRef.current) {
      return;
    }
    paintRafRef.current = requestAnimationFrame(() => {
      paintRafRef.current = 0;
      const canvas = canvasRef.current;
      const rc = roughRef.current;
      if (!canvas || !rc) {
        return;
      }
      renderScene(
        canvas,
        rc,
        elementsRef.current,
        viewportRef.current,
        theme,
        selectedIdsRef.current.length === 1 ? selectedIdsRef.current[0] : null,
        draftRef.current,
        filesRef.current,
        selectedIdsRef.current,
        remoteCursors,
        searchQueryRef.current,
        gridRef.current,
        lasersRef.current,
        guidesRef.current,
      );
    });
  }, [theme, remoteCursors]);

  useEffect(() => {
    paint();
  }, [paint, elements, viewport, tool, files, hoverHandle, selectedIds, marquee, remoteCursors, searchQuery, gridEnabled, editingLinearId, menu]);

  useEffect(() => {
    const onResize = () => paint();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [paint]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      const result = saveScene({ elements, viewport, version: 1, files });
      if (!result.ok && result.error === "quota") {
        window.dispatchEvent(
          new CustomEvent("rassam-save-error", {
            detail: messagesRef.current.dir === "rtl"
              ? "مساحة التخزين ممتلئة — صدّر JSON ثم امسح عناصر"
              : "Storage quota full — export JSON then clear elements",
          }),
        );
      } else if (result.ok) {
        window.dispatchEvent(
          new CustomEvent("rassam-save-error", { detail: null }),
        );
      }
    }, 250);
    return () => window.clearTimeout(id);
  }, [elements, viewport, files]);

  useEffect(() => {
    onViewportChange?.(viewport);
  }, [viewport, onViewportChange]);

  useEffect(() => {
    onElementsChange?.(elements.length);
  }, [elements, onElementsChange]);

  useEffect(() => {
    onHistoryChange?.(canUndo(history), canRedo(history));
  }, [history, onHistoryChange]);

  useEffect(() => {
    onSelectionChange?.(selectedIds.length);
  }, [selectedIds, onSelectionChange]);

  useEffect(() => {
    if (!clearSignal) {
      return;
    }
    if (readOnlyRef.current) {
      return;
    }
    if (!window.confirm(messages.confirmClear)) {
      return;
    }
    setHistory((h) => pushHistory(h, []));
    setSelectedIds([]);
    broadcastScene();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearSignal]);

  // Public API for App / collab
  useEffect(() => {
    if (!apiRef) {
      return;
    }
    apiRef.current = {
      getElements: () => elementsRef.current,
      getFiles: () => filesRef.current,
      setRemoteScene: (nextElements, nextFiles) => {
        // Element-level merge for collab (prefer newer updatedAt)
        setHistory((h) => {
          const remoteTs = Date.now();
          const localById = new Map(h.present.map((el) => [el.id, el]));
          const remoteIds = new Set(nextElements.map((el) => el.id));
          const merged: RassamElement[] = [];
          for (const remoteEl of nextElements) {
            const local = localById.get(remoteEl.id);
            if (!local) {
              merged.push(remoteEl);
              continue;
            }
            const rt = remoteEl.updatedAt || remoteTs;
            const lt = local.updatedAt || 0;
            merged.push(rt >= lt ? remoteEl : local);
          }
          // keep locally-newer elements missing from remote snapshot
          for (const local of h.present) {
            if (!remoteIds.has(local.id)) {
              const lt = local.updatedAt || 0;
              if (lt > remoteTs - 15000) {
                merged.push(local);
              }
            }
          }
          return replacePresent(h, merged);
        });
        if (nextFiles) {
          setFiles((f) => ({ ...f, ...nextFiles }));
        }
      },
      exportPng: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          exportPngFromCanvas(canvas);
        }
      },
      exportPngScaled: (scale, transparent) => {
        const canvas = canvasRef.current;
        if (canvas) {
          exportPngFromCanvas(canvas, { scale, transparent });
        }
      },
      exportPdf: async () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const { exportScenePdfFromCanvas } = await import("../core/pdf");
        await exportScenePdfFromCanvas(canvas);
      },
      copyPng: async () => {
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        try {
          await copyCanvasToClipboard(canvas);
        } catch {
          // ignore
        }
      },
      exportSvg: (selectedOnly) => {
        exportSvgFile(elementsRef.current, filesRef.current, theme, {
          selectedOnly,
          selectedIds: selectedIdsRef.current,
        });
      },
      align: (mode) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => {
          const next = alignElements(h.present, selectedIdsRef.current, mode);
          return next === h.present ? h : pushHistory(h, next);
        });
        window.setTimeout(broadcastScene, 0);
      },
      distribute: (axis) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => {
          const next = distributeElements(h.present, selectedIdsRef.current, axis);
          return next === h.present ? h : pushHistory(h, next);
        });
        window.setTimeout(broadcastScene, 0);
      },
      startCollabShare: async () => "",
      stopCollab: () => {
        collabRef?.current?.disconnect();
        setCollabUsers([]);
        setRemoteCursors({});
      },
      getSelectionCount: () => selectedIdsRef.current.length,
      insertElements: (els) => {
        if (readOnlyRef.current || !els.length) {
          return;
        }
        setHistory((h) => pushHistory(h, [...h.present, ...els]));
        setSelectedIds(els.map((el) => el.id));
        window.setTimeout(broadcastScene, 0);
      },
      setPreferredFont: (family) => {
        styleRef.current = { ...styleRef.current, preferredFont: family };
      },
      groupSelection: () => {
        if (readOnlyRef.current) {
          return;
        }
        const ids = selectedIdsRef.current;
        if (ids.length < 2) {
          return;
        }
        const gid = createId("group");
        setHistory((h) => pushHistory(h, groupElements(h.present, ids, gid)));
        window.setTimeout(broadcastScene, 0);
      },
      ungroupSelection: () => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => pushHistory(h, ungroupElements(h.present, selectedIdsRef.current)));
        window.setTimeout(broadcastScene, 0);
      },
      toggleLockSelection: () => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => {
          const sel = new Set(selectedIdsRef.current);
          const anyUnlocked = h.present.some((el) => sel.has(el.id) && !el.locked);
          return pushHistory(
            h,
            h.present.map((el) =>
              sel.has(el.id) ? setLocked(el, anyUnlocked) : el,
            ),
          );
        });
        window.setTimeout(broadcastScene, 0);
      },
      rotateSelection: (delta) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => {
          const sel = new Set(selectedIdsRef.current);
          return pushHistory(
            h,
            h.present.map((el) =>
              sel.has(el.id) ? setRotation(el, (el.rotation || 0) + delta) : el,
            ),
          );
        });
        window.setTimeout(broadcastScene, 0);
      },
      setSearchQuery: (q) => setSearchQuery(q),
      getSelectedIds: () => selectedIdsRef.current,
      getSearchQuery: () => searchQueryRef.current,
      copySelection: () => {
        const ids = new Set(selectedIdsRef.current);
        const els = elementsRef.current.filter((el) => ids.has(el.id));
        if (els.length) {
          writeClipboard(els, filesRef.current);
        }
      },
      cutSelection: () => {
        const ids = new Set(selectedIdsRef.current);
        const els = elementsRef.current.filter((el) => ids.has(el.id));
        if (!els.length || readOnlyRef.current) {
          return;
        }
        writeClipboard(els, filesRef.current);
        setHistory((h) => pushHistory(h, h.present.filter((el) => !ids.has(el.id))));
        setSelectedIds([]);
        window.setTimeout(broadcastScene, 0);
      },
      pasteClipboard: (at) => {
        const clip = readClipboard();
        if (!clip || readOnlyRef.current) {
          return;
        }
        const vp = viewportRef.current;
        const origin = at ?? {
          x: -vp.scrollX + 40 / vp.zoom,
          y: -vp.scrollY + 40 / vp.zoom,
        };
        const minX = Math.min(...clip.elements.map((el) => el.x));
        const minY = Math.min(...clip.elements.map((el) => el.y));
        const pasted = duplicateElements(
          clip.elements.map((el) => ({ ...el, x: el.x - minX, y: el.y - minY })),
          0,
        ).map((el) => ({ ...el, x: el.x + origin.x, y: el.y + origin.y }));
        if (clip.files) {
          setFiles((f) => ({ ...f, ...clip.files }));
        }
        setHistory((h) => pushHistory(h, [...h.present, ...pasted]));
        setSelectedIds(pasted.map((el) => el.id));
        window.setTimeout(broadcastScene, 0);
      },
      duplicateSelection: () => {
        if (readOnlyRef.current) {
          return;
        }
        const ids = new Set(selectedIdsRef.current);
        const els = elementsRef.current.filter((el) => ids.has(el.id));
        if (!els.length) {
          return;
        }
        const copies = duplicateElements(els);
        setHistory((h) => pushHistory(h, [...h.present, ...copies]));
        setSelectedIds(copies.map((el) => el.id));
        window.setTimeout(broadcastScene, 0);
      },
      deleteSelection: () => {
        if (readOnlyRef.current || !selectedIdsRef.current.length) {
          return;
        }
        const ids = new Set(selectedIdsRef.current);
        setHistory((h) => pushHistory(h, h.present.filter((el) => !ids.has(el.id))));
        setSelectedIds([]);
        window.setTimeout(broadcastScene, 0);
      },
      zOrder: (op) => {
        if (readOnlyRef.current) {
          return;
        }
        const ids = selectedIdsRef.current;
        setHistory((h) => {
          let next = h.present;
          if (op === "front") next = bringToFront(h.present, ids);
          else if (op === "back") next = sendToBack(h.present, ids);
          else if (op === "forward") next = bringForward(h.present, ids);
          else next = sendBackward(h.present, ids);
          return pushHistory(h, next);
        });
        window.setTimeout(broadcastScene, 0);
      },
      flipSelection: (axis) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => pushHistory(h, flipElements(h.present, selectedIdsRef.current, axis)));
        window.setTimeout(broadcastScene, 0);
      },
      exportJson: () => {
        const json = exportSceneJson(
          elementsRef.current,
          filesRef.current,
          viewportRef.current,
        );
        downloadTextFile(json, `rassam-${Date.now()}.rassam.json`);
      },
      importJsonText: (raw) => {
        if (readOnlyRef.current) {
          return;
        }
        const scene = parseSceneJson(raw);
        if (!scene) {
          return;
        }
        if (scene.files) {
          setFiles((f) => ({ ...f, ...scene.files! }));
        }
        setHistory((h) => pushHistory(h, scene.elements));
        setSelectedIds([]);
        window.setTimeout(broadcastScene, 0);
      },
      setGridEnabled: (v) => setGridEnabled(v),
      setSnapEnabled: (v) => setSnapEnabled(v),
      toggleHelp: () => setHelpOpen((o) => !o),
      editLinearPoints: (id) => setEditingLinearId(id),
      setLinearLabel: (id, label) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) =>
          pushHistory(
            h,
            h.present.map((el) =>
              el.id === id && (el.type === "line" || el.type === "arrow")
                ? { ...el, label }
                : el,
            ),
          ),
        );
        window.setTimeout(broadcastScene, 0);
      },
      runContextAction: (action) => {
        const api = apiRef.current;
        if (!api) {
          return;
        }
        const ids = selectedIdsRef.current;
        const targetId = menu?.targetId ?? ids[0] ?? null;
        switch (action) {
          case "duplicate":
            api.duplicateSelection();
            break;
          case "copy":
            api.copySelection();
            break;
          case "cut":
            api.cutSelection();
            break;
          case "paste":
            api.pasteClipboard(menu ? { x: menu.sceneX, y: menu.sceneY } : undefined);
            break;
          case "delete":
            api.deleteSelection();
            break;
          case "bringToFront":
            api.zOrder("front");
            break;
          case "sendToBack":
            api.zOrder("back");
            break;
          case "flipH":
            api.flipSelection("horizontal");
            break;
          case "flipV":
            api.flipSelection("vertical");
            break;
          case "editPoints":
            if (targetId) {
              const el = elementsRef.current.find((e) => e.id === targetId);
              if (el && (el.type === "line" || el.type === "arrow")) {
                api.editLinearPoints(targetId);
              }
            }
            break;
          case "label":
            if (targetId) {
              const el = elementsRef.current.find((e) => e.id === targetId);
              if (el && (el.type === "line" || el.type === "arrow" || el.type === "sticky")) {
                const label = window.prompt(
                  localeLabel(),
                  (el.type === "sticky" ? el.label : el.type === "line" || el.type === "arrow" ? el.label : "") || "",
                );
                if (label != null) {
                  if (el.type === "sticky") {
                    setHistory((h) =>
                      pushHistory(
                        h,
                        h.present.map((x) =>
                          x.id === targetId && x.type === "sticky"
                            ? { ...x, label }
                            : x,
                        ),
                      ),
                    );
                  } else {
                    api.setLinearLabel(targetId, label);
                  }
                }
              }
            }
            break;
          case "setLink": {
            const id = targetId;
            if (!id || readOnlyRef.current) {
              break;
            }
            const existing = elementsRef.current.find((e) => e.id === id);
            const url = window.prompt("URL", existing?.link || "https://");
            if (url != null) {
              api.setElementLink(id, url.trim() || undefined);
            }
            break;
          }
          case "openLink": {
            const id = targetId;
            if (id) {
              api.openElementLink(id);
            }
            break;
          }
          case "selectFrameContents": {
            const id = targetId;
            if (id) {
              setSelectedIds(selectFrameContents(id, elementsRef.current));
            }
            break;
          }
          case "lock":
          case "unlock": {
            if (readOnlyRef.current) {
              return;
            }
            const lock = action === "lock";
            const set = new Set(ids.length ? ids : targetId ? [targetId] : []);
            setHistory((h) =>
              pushHistory(
                h,
                h.present.map((el) => (set.has(el.id) ? setLocked(el, lock) : el)),
              ),
            );
            window.setTimeout(broadcastScene, 0);
            break;
          }
        }
      },
      setViewport: (v: Viewport) => setViewport(v),
      getViewport: () => viewportRef.current,
      setElementLink: (id, link) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) =>
          pushHistory(
            h,
            h.present.map((el) => (el.id === id ? { ...el, link } : el)),
          ),
        );
        window.setTimeout(broadcastScene, 0);
      },
      openElementLink: (id) => {
        const el = elementsRef.current.find((e) => e.id === id);
        if (el?.link) {
          window.open(el.link, "_blank", "noopener,noreferrer");
        }
      },
      toggleStats: () => setStatsOpen((o) => !o),
      toggleMinimap: () => setShowMinimap((v) => !v),
      exportFrame: (frameId) => {
        const ids = selectFrameContents(frameId, elementsRef.current);
        exportSvgFile(
          elementsRef.current.filter((el) => ids.includes(el.id)),
          filesRef.current,
          theme,
        );
      },
      zoomIn: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          applyZoom(rect.left + rect.width / 2, rect.top + rect.height / 2, 1);
        }
      },
      zoomOut: () => {
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          applyZoom(rect.left + rect.width / 2, rect.top + rect.height / 2, -1);
        }
      },
      fitToContent: () => {
        const els = elementsRef.current;
        const canvas = canvasRef.current;
        if (!canvas || !els.length) {
          return;
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of els) {
          const b = elementBounds(el);
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        }
        const w = maxX - minX || 1;
        const h = maxY - minY || 1;
        const zoom = clampZoom(
          Math.min(canvas.clientWidth / (w + 80), canvas.clientHeight / (h + 80)),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        setViewport({
          zoom,
          scrollX: -(minX - (canvas.clientWidth / zoom - w) / 2),
          scrollY: -(minY - (canvas.clientHeight / zoom - h) / 2),
        });
      },
      setSelectionStyle: (patch) => {
        if (readOnlyRef.current || !selectedIdsRef.current.length) {
          return;
        }
        const ids = new Set(selectedIdsRef.current);
        setHistory((h) =>
          pushHistory(
            h,
            h.present.map((el) => {
              if (!ids.has(el.id)) {
                return el;
              }
              return { ...el, ...patch, updatedAt: Date.now() } as RassamElement;
            }),
          ),
        );
        window.setTimeout(broadcastScene, 0);
      },
      importExcalidrawJson: (raw) => {
        if (readOnlyRef.current) {
          return;
        }
        const scene = parseSceneJson(raw);
        if (!scene?.elements.length) {
          return;
        }
        setHistory((h) => pushHistory(h, [...h.present, ...scene.elements]));
        if (scene.files) {
          setFiles((f) => ({ ...f, ...scene.files! }));
        }
        window.setTimeout(broadcastScene, 0);
      },
      selectElement: (id, additive) => {
        if (additive) {
          setSelectedIds((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
          );
        } else {
          setSelectedIds([id]);
        }
      },
      saveHistorySnapshot: () => {
        saveSnapshot(elementsRef.current);
        window.dispatchEvent(new CustomEvent("rassam-snapshots"));
      },
      listHistorySnapshots: () => listSnapshots(),
      restoreHistorySnapshot: (id) => {
        const els = restoreSnapshot(id);
        if (els && !readOnlyRef.current) {
          setHistory((h) => pushHistory(h, els));
          window.setTimeout(broadcastScene, 0);
        }
      },
      addComment: (x, y, text) => {
        if (readOnlyRef.current) {
          return;
        }
        const el: RassamElement = {
          id: createId(),
          type: "comment",
          x,
          y,
          width: 24,
          height: 24,
          stroke: "#2563EB",
          fill: "transparent",
          strokeWidth: 1,
          opacity: 1,
          seed: randomSeed(),
          label: text,
        } as RassamElement;
        setHistory((h) => pushHistory(h, [...h.present, el]));
        window.setTimeout(broadcastScene, 0);
      },
      raiseElement: (id) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => pushHistory(h, bringForward(h.present, [id])));
        window.setTimeout(broadcastScene, 0);
      },
      lowerElement: (id) => {
        if (readOnlyRef.current) {
          return;
        }
        setHistory((h) => pushHistory(h, sendBackward(h.present, [id])));
        window.setTimeout(broadcastScene, 0);
      },
    };
  }, [apiRef, collabRef, theme, broadcastScene, menu]);

  const beginTextEdit = useCallback(
    (el: RassamElement, clientX: number, clientY: number) => {
      if (el.type !== "text" || readOnlyRef.current) {
        return;
      }
      const canvas = canvasRef.current;
      if (!canvas) {
        return;
      }
      const rect = canvas.getBoundingClientRect();
      setSelectedIds([el.id]);
      setEditingTextId(el.id);
      setTextValue(el.text);
      const screenX =
        rect.left + (el.x + viewportRef.current.scrollX) * viewportRef.current.zoom;
      const screenY =
        rect.top + (el.y + viewportRef.current.scrollY) * viewportRef.current.zoom;
      setTextStyle({
        left: Number.isFinite(screenX) ? screenX : clientX - rect.left,
        top: Number.isFinite(screenY) ? screenY : clientY - rect.top,
      });
    },
    [],
  );

  const placeImageAt = useCallback(
    async (pt: { x: number; y: number }, payload: FilePayload) => {
      if (readOnlyRef.current) {
        return;
      }
      const fileId = createId("file");
      let width = 240;
      let height = 180;
      try {
        const size = await loadImageSize(payload.dataURL);
        const scale = Math.min(1, 320 / Math.max(size.width, size.height));
        width = Math.max(48, size.width * scale);
        height = Math.max(48, size.height * scale);
      } catch {
        // defaults
      }
      const el: RassamElement = {
        id: createId(),
        type: "image",
        x: pt.x,
        y: pt.y,
        width,
        height,
        stroke: "#0F172A",
        fill: "transparent",
        strokeWidth: 1,
        opacity: 1,
        seed: randomSeed(),
        fileId,
      };
      setFiles((f) => ({ ...f, [fileId]: payload }));
      setHistory((h) => pushHistory(h, [...h.present, el]));
      setSelectedIds([el.id]);
      pendingImageRef.current = null;
      setPendingImage(false);
      onToolChange?.("select");
      window.setTimeout(broadcastScene, 0);
    },
    [onToolChange, broadcastScene],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const meta = e.ctrlKey || e.metaKey;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) {
        return;
      }
      if (meta && e.key.toLowerCase() === "z" && !e.shiftKey) {
        e.preventDefault();
        if (!readOnlyRef.current) {
          const online = !!collabRef?.current?.connected;
          setHistory((h) => undo(h, online));
        }
        return;
      }
      if (
        meta &&
        (e.key.toLowerCase() === "y" || (e.key.toLowerCase() === "z" && e.shiftKey))
      ) {
        e.preventDefault();
        if (!readOnlyRef.current) {
          const online = !!collabRef?.current?.connected;
          setHistory((h) => redo(h, online));
        }
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        if (editingTextId || readOnlyRef.current) {
          return;
        }
        if (selectedIdsRef.current.length) {
          e.preventDefault();
          const ids = new Set(selectedIdsRef.current);
          setHistory((h) => pushHistory(h, h.present.filter((el) => !ids.has(el.id))));
          setSelectedIds([]);
          window.setTimeout(broadcastScene, 0);
        }
        return;
      }
      if (e.key === "Escape") {
        setSelectedIds([]);
        setEditingTextId(null);
        pendingImageRef.current = null;
        setPendingImage(false);
        return;
      }
      if (meta && e.key.toLowerCase() === "a") {
        e.preventDefault();
        setSelectedIds(elementsRef.current.map((el) => el.id));
        return;
      }
      // Z-order — allow Ctrl/Cmd modifiers (E2E BUG-3)
      if (
        (e.key === "PageUp" || e.key === "PageDown") &&
        selectedIdsRef.current.length &&
        !readOnlyRef.current
      ) {
        e.preventDefault();
        const toFront = e.ctrlKey && e.shiftKey;
        const up = e.key === "PageUp";
        if (up && toFront) {
          setHistory((h) => pushHistory(h, bringToFront(h.present, selectedIdsRef.current)));
        } else if (up) {
          setHistory((h) => pushHistory(h, bringForward(h.present, selectedIdsRef.current)));
        } else if (toFront) {
          setHistory((h) => pushHistory(h, sendToBack(h.present, selectedIdsRef.current)));
        } else {
          setHistory((h) => pushHistory(h, sendBackward(h.present, selectedIdsRef.current)));
        }
        window.setTimeout(broadcastScene, 0);
        return;
      }
      // Arrow-key nudge
      if (
        ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
        selectedIdsRef.current.length &&
        !readOnlyRef.current &&
        !editingTextId
      ) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx =
          e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0;
        const dy =
          e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0;
        const ids = new Set(selectedIdsRef.current);
        setHistory((h) =>
          pushHistory(
            h,
            h.present.map((el) => (ids.has(el.id) ? translateElement(el, dx, dy) : el)),
          ),
        );
        window.setTimeout(broadcastScene, 0);
        return;
      }
      // Zoom buttons shortcuts
      if (meta && (e.key === "=" || e.key === "+")) {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          applyZoom(rect.left + rect.width / 2, rect.top + rect.height / 2, 1);
        }
        return;
      }
      if (meta && e.key === "-") {
        e.preventDefault();
        const canvas = canvasRef.current;
        if (canvas) {
          const rect = canvas.getBoundingClientRect();
          applyZoom(rect.left + rect.width / 2, rect.top + rect.height / 2, -1);
        }
        return;
      }
      if (meta && e.key === "0") {
        e.preventDefault();
        setViewport({ scrollX: 0, scrollY: 0, zoom: 1 });
        return;
      }
      if (meta && e.key.toLowerCase() === "e" && !e.shiftKey) {
        // fit to content
        e.preventDefault();
        const els = elementsRef.current;
        if (!els.length) {
          return;
        }
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const el of els) {
          const b = elementBounds(el);
          minX = Math.min(minX, b.x);
          minY = Math.min(minY, b.y);
          maxX = Math.max(maxX, b.x + b.width);
          maxY = Math.max(maxY, b.y + b.height);
        }
        const canvas = canvasRef.current;
        if (!canvas) {
          return;
        }
        const w = maxX - minX || 1;
        const h = maxY - minY || 1;
        const zoom = clampZoom(
          Math.min(canvas.clientWidth / (w + 80), canvas.clientHeight / (h + 80)),
          MIN_ZOOM,
          MAX_ZOOM,
        );
        setViewport({
          zoom,
          scrollX: -(minX - (canvas.clientWidth / zoom - w) / 2),
          scrollY: -(minY - (canvas.clientHeight / zoom - h) / 2),
        });
        return;
      }
      if (!meta && !e.altKey && !e.ctrlKey && !e.metaKey) {
        const map: Record<string, Tool> = {
          v: "select",
          h: "hand",
          q: "lasso",
          r: "rectangle",
          d: "diamond",
          o: "ellipse",
          l: "line",
          a: "arrow",
          x: "elbow",
          p: "draw",
          t: "text",
          i: "image",
          n: "sticky",
          f: "frame",
          b: "bucket",
          s: "laser",
          e: "eraser",
        };
        if (e.key === "?") {
          e.preventDefault();
          setHelpOpen((o) => !o);
          return;
        }
        // selection ops when select tool
        if (toolRef.current === "select" && selectedIdsRef.current.length) {
          if (e.key.toLowerCase() === "g" && !e.shiftKey) {
            e.preventDefault();
            const ids = selectedIdsRef.current;
            if (ids.length >= 2 && !readOnlyRef.current) {
              const gid = createId("group");
              setHistory((h) => pushHistory(h, groupElements(h.present, ids, gid)));
              window.setTimeout(broadcastScene, 0);
            }
            return;
          }
          if (e.key.toLowerCase() === "g" && e.shiftKey) {
            e.preventDefault();
            if (!readOnlyRef.current) {
              setHistory((h) =>
                pushHistory(h, ungroupElements(h.present, selectedIdsRef.current)),
              );
              window.setTimeout(broadcastScene, 0);
            }
            return;
          }
          if (e.key.toLowerCase() === "k") {
            e.preventDefault();
            if (!readOnlyRef.current) {
              setHistory((h) => {
                const sel = new Set(selectedIdsRef.current);
                const anyUnlocked = h.present.some((el) => sel.has(el.id) && !el.locked);
                return pushHistory(
                  h,
                  h.present.map((el) => (sel.has(el.id) ? setLocked(el, anyUnlocked) : el)),
                );
              });
              window.setTimeout(broadcastScene, 0);
            }
            return;
          }
          if (e.key.toLowerCase() === "r" && e.altKey) {
            e.preventDefault();
            return;
          }
          if (e.key === "[" || e.key === "]") {
            e.preventDefault();
            if (!readOnlyRef.current) {
              const delta = e.key === "[" ? -Math.PI / 12 : Math.PI / 12;
              setHistory((h) => {
                const sel = new Set(selectedIdsRef.current);
                return pushHistory(
                  h,
                  h.present.map((el) =>
                    sel.has(el.id) ? setRotation(el, (el.rotation || 0) + delta) : el,
                  ),
                );
              });
              window.setTimeout(broadcastScene, 0);
            }
            return;
          }
        }
        const next = map[e.key.toLowerCase()];
        if (next) {
          onToolChange?.(next);
          if (next === "image" && !readOnlyRef.current) {
            fileInputRef.current?.click();
          }
        }
      }
      if (meta && e.key.toLowerCase() === "g") {
        e.preventDefault();
        if (e.shiftKey && e.altKey) {
          setGridEnabled((g) => !g);
          return;
        }
        if (e.shiftKey) {
          if (!readOnlyRef.current) {
            setHistory((h) =>
              pushHistory(h, ungroupElements(h.present, selectedIdsRef.current)),
            );
          }
        } else if (selectedIdsRef.current.length >= 2 && !readOnlyRef.current) {
          const gid = createId("group");
          setHistory((h) => pushHistory(h, groupElements(h.present, selectedIdsRef.current, gid)));
        }
        window.setTimeout(broadcastScene, 0);
      }
      if (meta && e.key.toLowerCase() === "c") {
        e.preventDefault();
        const ids = new Set(selectedIdsRef.current);
        const els = elementsRef.current.filter((el) => ids.has(el.id));
        if (els.length) {
          writeClipboard(els, filesRef.current);
        }
      }
      if (meta && e.key.toLowerCase() === "x") {
        e.preventDefault();
        const ids = new Set(selectedIdsRef.current);
        const els = elementsRef.current.filter((el) => ids.has(el.id));
        if (els.length && !readOnlyRef.current) {
          writeClipboard(els, filesRef.current);
          setHistory((h) => pushHistory(h, h.present.filter((el) => !ids.has(el.id))));
          setSelectedIds([]);
        }
      }
      if (meta && e.key.toLowerCase() === "v") {
        e.preventDefault();
        const clip = readClipboard();
        if (clip && !readOnlyRef.current) {
          const pasted = duplicateElements(clip.elements, 24);
          if (clip.files) {
            setFiles((f) => ({ ...f, ...clip.files }));
          }
          setHistory((h) => pushHistory(h, [...h.present, ...pasted]));
          setSelectedIds(pasted.map((el) => el.id));
        }
      }
      if (meta && e.key.toLowerCase() === "d") {
        e.preventDefault();
        if (!readOnlyRef.current && selectedIdsRef.current.length) {
          const ids = new Set(selectedIdsRef.current);
          const els = elementsRef.current.filter((el) => ids.has(el.id));
          const copies = duplicateElements(els);
          setHistory((h) => pushHistory(h, [...h.present, ...copies]));
          setSelectedIds(copies.map((el) => el.id));
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedIds, editingTextId, onToolChange, broadcastScene]);

  useEffect(() => {
    const onPaste = async (e: ClipboardEvent) => {
      if (readOnlyRef.current) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) {
        return;
      }
      for (const item of Array.from(items)) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (!file) {
            continue;
          }
          e.preventDefault();
          const payload = await readFileAsDataURL(file);
          const vp = viewportRef.current;
          const canvas = canvasRef.current;
          const rect = canvas?.getBoundingClientRect();
          const cx = rect ? rect.width / 2 : 400;
          const cy = rect ? rect.height / 2 : 300;
          const pt = {
            x: cx / vp.zoom - vp.scrollX - 120,
            y: cy / vp.zoom - vp.scrollY - 90,
          };
          await placeImageAt(pt, payload);
          break;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [placeImageAt]);

  const applyZoom = useCallback((clientX: number, clientY: number, delta: number) => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const rect = canvas.getBoundingClientRect();
    const vp = viewportRef.current;
    const nextZoom = clampZoom(vp.zoom * (delta > 0 ? 1.1 : 0.9), MIN_ZOOM, MAX_ZOOM);
    const sceneX = (clientX - rect.left) / vp.zoom - vp.scrollX;
    const sceneY = (clientY - rect.top) / vp.zoom - vp.scrollY;
    setViewport({
      scrollX: (clientX - rect.left) / nextZoom - sceneX,
      scrollY: (clientY - rect.top) / nextZoom - sceneY,
      zoom: nextZoom,
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    const onWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        applyZoom(e.clientX, e.clientY, -e.deltaY);
        return;
      }
      e.preventDefault();
      setViewport((v) => ({
        ...v,
        scrollX: v.scrollX - e.deltaX / v.zoom,
        scrollY: v.scrollY - e.deltaY / v.zoom,
      }));
    };
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => canvas.removeEventListener("wheel", onWheel);
  }, [applyZoom]);

  const toScene = useCallback((clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    return clientToScene({ x: clientX, y: clientY }, viewportRef.current, {
      left: rect.left,
      top: rect.top,
    });
  }, []);

  const textOpenedAtRef = useRef(0);

  const commitText = useCallback(() => {
    if (!editingTextId) {
      return;
    }
    const value = textValue;
    const openedAt = textOpenedAtRef.current;
    setHistory((h) => {
      const existing = h.present.find((el) => el.id === editingTextId);
      if (!existing || existing.type !== "text") {
        return h;
      }
      // Don't delete a brand-new empty editor on the same click that opened it
      // (pointerdown race) — only remove empty text on explicit cancel/outside click later.
      const isFresh = Date.now() - openedAt < 500;
      if (!value.trim() && !existing.text) {
        if (isFresh) {
          return h;
        }
        return pushHistory(h, h.present.filter((el) => el.id !== editingTextId));
      }
      if (value === existing.text) {
        return h;
      }
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const fontFamily = pickCanvasFontFamily(
        value,
        styleRef.current.preferredFont || undefined,
      );
      let width = existing.width;
      let height = existing.height;
      if (ctx) {
        ctx.font = `600 ${existing.fontSize}px ${fontFamily}`;
        const lines = value.split("\n");
        width = Math.max(
          40,
          ...lines.map((line) => ctx.measureText(line || " ").width + 8),
        );
        height = Math.max(
          existing.fontSize * 1.35,
          lines.length * existing.fontSize * 1.35,
        );
      }
      return pushHistory(
        h,
        h.present.map((el) =>
          el.id === editingTextId && el.type === "text"
            ? { ...el, text: value, width, height, fontFamily }
            : el,
        ),
      );
    });
    setEditingTextId(null);
    setTextValue("");
    window.setTimeout(broadcastScene, 0);
  }, [editingTextId, textValue, broadcastScene]);

  const onFilePicked = async (file: File | undefined) => {
    if (!file || readOnlyRef.current) {
      return;
    }
    const payload = await readFileAsDataURL(file);
    pendingImageRef.current = payload;
    setPendingImage(true);
    onToolChange?.("image");
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (editingTextId) {
      const age = Date.now() - textOpenedAtRef.current;
      if (age < 450) {
        // Newly opened text editor — ignore this pointer sequence so we don't
        // blur-delete the empty element (E2E BUG-1).
        return;
      }
      const target = e.target as HTMLElement | null;
      if (target && target.closest(".rassam-text-editor")) {
        return;
      }
      commitText();
    }
    if (readOnlyRef.current && toolRef.current !== "select" && toolRef.current !== "hand") {
      return;
    }
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }
    canvas.setPointerCapture(e.pointerId);
    const pt = toScene(e.clientX, e.clientY);
    const currentTool = toolRef.current;

    // Hand / middle-button pans. Shift+select: extend selection on hit,
    // pan when starting on empty canvas (e2e module 6 + BUG-2).
    const selectHitNow =
      currentTool === "select"
        ? hitTestElements(elementsRef.current, pt, 6)
        : null;

    if (
      currentTool === "hand" ||
      e.button === 1 ||
      (e.shiftKey && currentTool === "select" && !selectHitNow)
    ) {
      dragRef.current = {
        kind: "pan",
        originX: e.clientX,
        originY: e.clientY,
        scrollX: viewportRef.current.scrollX,
        scrollY: viewportRef.current.scrollY,
      };
      return;
    }

    if (currentTool === "image") {
      const pending = pendingImageRef.current;
      if (pending) {
        void placeImageAt(pt, pending);
      } else {
        fileInputRef.current?.click();
      }
      dragRef.current = { kind: "none" };
      return;
    }

    if (currentTool === "laser") {
      const stroke = createLaserStroke(createId("laser"), pt);
      setLasers((prev) => [...pruneLasers(prev), stroke]);
      dragRef.current = { kind: "freehand", points: [pt] };
      draftRef.current = null;
      // reuse freehand drag for laser point tracking via last stroke id
      laserActiveRef.current = stroke.id;
      return;
    }

    if (currentTool === "bucket") {
      if (readOnlyRef.current) {
        return;
      }
      const hit = hitTestElements(elementsRef.current, pt, 8);
      if (hit && hit.type !== "draw" && hit.type !== "line" && hit.type !== "arrow") {
        const fill = styleRef.current.fill === "transparent" ? "#DBEAFE" : styleRef.current.fill;
        setHistory((h) =>
          pushHistory(
            h,
            h.present.map((el) => (el.id === hit.id ? { ...el, fill } : el)),
          ),
        );
        window.setTimeout(broadcastScene, 0);
      }
      dragRef.current = { kind: "none" };
      return;
    }

    if (currentTool === "lasso") {
      dragRef.current = { kind: "lasso", path: [pt] };
      lassoRef.current = [pt];
      return;
    }

    if (currentTool === "select") {
      // linear point editing
      const linId = editingLinearRef.current;
      if (linId && !readOnlyRef.current) {
        const lin = elementsRef.current.find(
          (el) => el.id === linId && (el.type === "line" || el.type === "arrow"),
        );
        if (lin && (lin.type === "line" || lin.type === "arrow")) {
          const zoom = viewportRef.current.zoom;
          const hitIdx = lin.points.findIndex(
            (p) => Math.hypot(p.x - pt.x, p.y - pt.y) < 10 / zoom,
          );
          if (hitIdx >= 0) {
            dragRef.current = {
              kind: "point",
              id: lin.id,
              index: hitIdx,
              snapshot: cloneElements(elementsRef.current),
            };
            return;
          }
        }
      }

      // resize handle on single selection
      if (selectedIdsRef.current.length === 1 && !readOnlyRef.current) {
        const selected = elementsRef.current.find(
          (el) => el.id === selectedIdsRef.current[0],
        );
        if (selected) {
          const handle = hitResizeHandle(
            pt,
            elementBounds(selected),
            viewportRef.current.zoom,
          );
          if (handle) {
            dragRef.current = {
              kind: "resize",
              id: selected.id,
              handle,
              originBounds: elementBounds(selected),
              originElement: cloneElements([selected])[0],
              snapshot: cloneElements(elementsRef.current),
            };
            return;
          }
        }
      }

      const hit = hitTestElements(elementsRef.current, pt, 6);
      if (hit) {
        let nextIds = selectedIdsRef.current;
        if (e.shiftKey) {
          nextIds = nextIds.includes(hit.id)
            ? nextIds.filter((id) => id !== hit.id)
            : [...nextIds, hit.id];
        } else if (!nextIds.includes(hit.id)) {
          nextIds = expandGroupSelection(elementsRef.current, [hit.id]);
        } else {
          nextIds = expandGroupSelection(elementsRef.current, nextIds);
        }
        setSelectedIds(nextIds);

        const now = Date.now();
        const last = lastClickRef.current;
        if (
          last &&
          last.id === hit.id &&
          now - last.at < 350 &&
          hit.type === "text" &&
          !readOnlyRef.current
        ) {
          lastClickRef.current = null;
          beginTextEdit(hit, e.clientX, e.clientY);
          dragRef.current = { kind: "none" };
          return;
        }
        lastClickRef.current = { id: hit.id, at: now };

        if (!readOnlyRef.current) {
          dragRef.current = {
            kind: "move",
            id: hit.id,
            last: pt,
            snapshot: cloneElements(elementsRef.current),
          };
        }
        return;
      }

      if (!e.shiftKey) {
        setSelectedIds([]);
        setEditingLinearId(null);
      }
      lastClickRef.current = null;
      dragRef.current = { kind: "marquee", start: pt, current: pt };
      setMarquee({ x: pt.x, y: pt.y, width: 0, height: 0 });
      return;
    }

    if (currentTool === "eraser") {
      if (readOnlyRef.current) {
        return;
      }
      const hit = hitTestElements(elementsRef.current, pt, 8);
      if (hit) {
        setHistory((h) => pushHistory(h, h.present.filter((el) => el.id !== hit.id)));
        window.setTimeout(broadcastScene, 0);
      }
      dragRef.current = { kind: "none" };
      return;
    }

    if (currentTool === "text") {
      const existing = hitTestElements(elementsRef.current, pt, 6);
      if (existing?.type === "text") {
        beginTextEdit(existing, e.clientX, e.clientY);
        dragRef.current = { kind: "none" };
        return;
      }
      const fontFamily = pickCanvasFontFamily("", styleRef.current.preferredFont || undefined);
      const el: RassamElement = {
        id: createId(),
        type: "text",
        x: pt.x,
        y: pt.y,
        stroke: styleRef.current.stroke,
        fill: "transparent",
        strokeWidth: styleRef.current.strokeWidth,
        opacity: 1,
        seed: randomSeed(),
        text: "",
        fontSize: DEFAULT_FONT_SIZE,
        fontFamily,
        width: 120,
        height: DEFAULT_FONT_SIZE * 1.35,
      };
      setHistory((h) => pushHistory(h, [...h.present, el]));
      setSelectedIds(el.id ? [el.id] : []);
      setEditingTextId(el.id);
      textOpenedAtRef.current = Date.now();
      setTextValue("");
      const canvasRect = canvas.getBoundingClientRect();
      setTextStyle({
        left: e.clientX - canvasRect.left,
        top: e.clientY - canvasRect.top,
      });
      dragRef.current = { kind: "none" };
      return;
    }

    if (currentTool === "draw") {
      dragRef.current = { kind: "freehand", points: [pt] };
      draftRef.current = {
        id: createId(),
        type: "draw",
        x: pt.x,
        y: pt.y,
        stroke: styleRef.current.stroke,
        fill: "transparent",
        strokeWidth: styleRef.current.strokeWidth,
        opacity: 1,
        seed: randomSeed(),
        points: [pt],
      };
      paint();
      return;
    }

    dragRef.current = { kind: "draw", start: pt, current: pt };
    draftRef.current = createElementFromDraft(currentTool, pt, pt, styleRef.current);
    paint();
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    const pt = toScene(e.clientX, e.clientY);

    if (collabRef?.current?.connected && !collabRef.current.isReadOnly) {
      const now = Date.now();
      if (now - lastCursorSentRef.current >= 50) {
        lastCursorSentRef.current = now;
        void collabRef.current.broadcastCursor(pt.x, pt.y);
      }
    }

    if (drag.kind === "none" && toolRef.current === "select" && selectedIds.length === 1) {
      const selected = elementsRef.current.find((el) => el.id === selectedIds[0]);
      if (selected && !readOnlyRef.current) {
        const handle = hitResizeHandle(
          pt,
          elementBounds(selected),
          viewportRef.current.zoom,
        );
        setHoverHandle(handle);
      }
      return;
    }

    if (drag.kind === "none") {
      return;
    }

    if (drag.kind === "pan") {
      const vp = viewportRef.current;
      // Invert: dragging canvas left/up reveals content to the right/bottom
      setViewport({
        ...vp,
        scrollX: drag.scrollX + (drag.originX - e.clientX) / vp.zoom,
        scrollY: drag.scrollY + (drag.originY - e.clientY) / vp.zoom,
      });
      return;
    }

    if (drag.kind === "marquee") {
      drag.current = pt;
      const rect = normalizeRect(drag.start, pt);
      setMarquee(rect);
      return;
    }

    if (drag.kind === "lasso") {
      const last = drag.path[drag.path.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) > 2) {
        drag.path.push(pt);
        lassoRef.current = drag.path;
        paint();
      }
      return;
    }

    if (drag.kind === "point") {
      const lin = elementsRef.current.find((el) => el.id === drag.id);
      if (!lin || (lin.type !== "line" && lin.type !== "arrow")) {
        return;
      }
      const nextPt = snapRef.current
        ? { x: snapValue(pt.x, 24), y: snapValue(pt.y, 24) }
        : pt;
      const points = lin.points.map((p, i) => (i === drag.index ? nextPt : p));
      setHistory((h) =>
        replacePresent(
          h,
          h.present.map((el) =>
            el.id === drag.id &&
            (el.type === "line" || el.type === "arrow")
              ? {
                  ...el,
                  points,
                  x: points[0].x,
                  y: points[0].y,
                }
              : el,
          ),
        ),
      );
      return;
    }

    if (drag.kind === "move") {
      if (readOnlyRef.current) {
        return;
      }
      let dx = pt.x - drag.last.x;
      let dy = pt.y - drag.last.y;
      drag.last = pt;
      const ids = new Set(
        selectedIdsRef.current.length ? selectedIdsRef.current : [drag.id],
      );
      const primary =
        elementsRef.current.find((el) => el.id === drag.id) ||
        elementsRef.current.find((el) => ids.has(el.id));
      let guides: SnapGuide[] = [];
      if (snapRef.current && primary && ids.size === 1) {
        const others = elementsRef.current.filter((el) => !ids.has(el.id));
        const snapped = snapToObjects(primary, others, {
          x: primary.x + dx,
          y: primary.y + dy,
        });
        dx = snapped.x - primary.x;
        dy = snapped.y - primary.y;
        guides = snapped.guides;
      } else {
        guides = [];
      }
      setSnapGuides(guides);
      setHistory((h) =>
        replacePresent(
          h,
          h.present.map((el) => {
            if (!ids.has(el.id)) {
              return el;
            }
            let nx = el.x + dx;
            let ny = el.y + dy;
            if (snapRef.current && ids.size > 1) {
              nx = snapValue(nx, 24);
              ny = snapValue(ny, 24);
              dx = nx - el.x;
              dy = ny - el.y;
            }
            return { ...translateElement(el, dx, dy), updatedAt: Date.now() };
          }),
        ),
      );
      return;
    }

    if (drag.kind === "resize") {
      if (readOnlyRef.current) {
        return;
      }
      const next = resizeElement(drag.originElement, drag.originBounds, drag.handle, pt);
      setHistory((h) =>
        replacePresent(h, h.present.map((el) => (el.id === drag.id ? next : el))),
      );
      return;
    }

    if (drag.kind === "freehand") {
      const last = drag.points[drag.points.length - 1];
      if (Math.hypot(pt.x - last.x, pt.y - last.y) < 1.2) {
        return;
      }
      drag.points.push(pt);
      if (laserActiveRef.current) {
        setLasers((prev) =>
          prev.map((s) =>
            s.id === laserActiveRef.current ? appendLaserPoint(s, pt) : s,
          ),
        );
        return;
      }
      if (draftRef.current?.type === "draw") {
        draftRef.current = { ...draftRef.current, points: [...drag.points] };
      }
      paint();
      return;
    }

    if (drag.kind === "draw") {
      drag.current = pt;
      draftRef.current = createElementFromDraft(
        toolRef.current,
        drag.start,
        pt,
        styleRef.current,
      );
      paint();
    }
  };

  const onPointerUp = () => {
    const drag = dragRef.current;
    const draft = draftRef.current;
    dragRef.current = { kind: "none" };
    draftRef.current = null;

    if (drag.kind === "lasso") {
      const path = drag.path;
      lassoRef.current = null;
      if (path.length > 3) {
        const hits = elementsRef.current
          .filter((el) => {
            const b = elementBounds(el);
            const c = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
            return pointInPolygon(c, path);
          })
          .map((el) => el.id);
        setSelectedIds(hits);
      }
      paint();
      return;
    }

    if (drag.kind === "point") {
      setHistory((h) => ({
        past: [
          ...h.past,
          {
            elements: drag.snapshot,
            changedIds: [drag.id],
            ts: Date.now(),
            source: "local" as const,
          },
        ].slice(-80),
        present: refreshBindings(h.present, new Set([drag.id])),
        future: [],
      }));
      broadcastScene();
      paint();
      return;
    }

    if (drag.kind === "marquee") {
      const rect = normalizeRect(drag.start, drag.current);
      setMarquee(null);
      if (rect.width > 3 || rect.height > 3) {
        const hits = elementsRef.current
          .filter((el) => {
            const b = elementBounds(el);
            return !(
              b.x + b.width < rect.x ||
              b.x > rect.x + rect.width ||
              b.y + b.height < rect.y ||
              b.y > rect.y + rect.height
            );
          })
          .map((el) => el.id);
        setSelectedIds(hits);
      }
      return;
    }

    if (drag.kind === "move" || drag.kind === "resize") {
      const changedIds =
        drag.kind === "move"
          ? [...new Set([drag.id, ...selectedIdsRef.current])]
          : [drag.id];
      setSnapGuides([]);
      setHistory((h) => ({
        past: [
          ...h.past,
          {
            elements: drag.snapshot,
            changedIds,
            ts: Date.now(),
            source: "local" as const,
          },
        ].slice(-80),
        present:
          drag.kind === "move"
            ? refreshBindings(h.present, new Set(changedIds))
            : h.present,
        future: [],
      }));
      broadcastScene();
      paint();
      return;
    }

    if (drag.kind === "freehand" && draft?.type === "draw") {
      if (draft.points.length >= 1) {
        const pts = finalizeFreehand(draft.points);
        const smoothed: RassamElement = { ...draft, points: pts };
        setHistory((h) => pushHistory(h, [...h.present, smoothed]));
        broadcastScene();
      }
      laserActiveRef.current = null;
      paint();
      return;
    }

    if (toolRef.current === "laser" || laserActiveRef.current) {
      laserActiveRef.current = null;
      paint();
      return;
    }

    if (drag.kind === "draw" && draft) {
      let committed: RassamElement | null = draft;
      const b =
        draft.type === "rectangle" ||
        draft.type === "diamond" ||
        draft.type === "ellipse" ||
        draft.type === "sticky" ||
        draft.type === "frame"
          ? draft.width + draft.height
          : 0;
      const isLinear = draft.type === "line" || draft.type === "arrow";
      const meaningful =
        (draft.type !== "line" &&
          draft.type !== "arrow" &&
          draft.type !== "draw" &&
          b > 4) ||
        (isLinear &&
          draft.points.length >= 2 &&
          Math.hypot(
            draft.points[1].x - draft.points[0].x,
            draft.points[1].y - draft.points[0].y,
          ) > 4);
      if (meaningful && draft.type === "arrow" && draft.points.length >= 2) {
        const start = draft.points[0];
        const end = draft.points[draft.points.length - 1];
        const startEl = findBindableShape(elementsRef.current, start, draft.id);
        const endEl = findBindableShape(elementsRef.current, end, draft.id);
        const elbow = draft.elbow || elbowModeRef.current || toolRef.current === "elbow";
        let points = [start, end];
        if (elbow) {
          points = elbowBetweenShapes(startEl, endEl, start, end);
        }
        committed = {
          ...draft,
          type: "arrow",
          points,
          elbow,
          startBinding: startEl ? { elementId: startEl.id } : null,
          endBinding: endEl ? { elementId: endEl.id } : null,
        };
        if (startEl || endEl) {
          committed = refreshBindings(
            [...elementsRef.current, committed],
            new Set(),
          ).find((el) => el.id === committed!.id) as RassamElement;
        }
      }
      if (meaningful && committed) {
        setHistory((h) => pushHistory(h, [...h.present, committed as RassamElement]));
        broadcastScene();
      }
    }
    paint();
  };

  // marquee overlay + selection box for multi-select drawn in render
  const selectionOverlay = marquee
    ? (() => {
        const canvas = canvasRef.current;
        const vp = viewportRef.current;
        if (!canvas) {
          return null;
        }
        return {
          left: (marquee.x + vp.scrollX) * vp.zoom,
          top: (marquee.y + vp.scrollY) * vp.zoom,
          width: marquee.width * vp.zoom,
          height: marquee.height * vp.zoom,
        };
      })()
    : null;

  const cursor =
    tool === "hand"
      ? "grab"
      : tool === "text"
        ? "text"
        : tool === "select"
          ? hoverHandle
            ? handleCursor(hoverHandle)
            : "default"
          : tool === "image"
            ? pendingImage
              ? "copy"
              : "pointer"
          : tool === "lasso"
            ? "crosshair"
            : "crosshair";

  return (
    <div
      ref={wrapRef}
      className="rassam-canvas-wrap"
      style={{ background: canvasPaper(theme) }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void onFilePicked(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <canvas
        ref={canvasRef}
        className="rassam-canvas"
        style={{ cursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={(e) => {
          if (toolRef.current !== "select" || readOnlyRef.current) {
            return;
          }
          const pt = toScene(e.clientX, e.clientY);
          const hit = hitTestElements(elementsRef.current, pt, 6);
          if (hit?.type === "text") {
            beginTextEdit(hit, e.clientX, e.clientY);
            return;
          }
          // live label edit for sticky / frame / linear
          if (
            hit &&
            (hit.type === "sticky" || hit.type === "frame" || hit.type === "line" || hit.type === "arrow")
          ) {
            const label = window.prompt(
              messages.dir === "rtl" ? "النص" : "Label",
              (hit as { label?: string; name?: string }).label ||
                (hit as { name?: string }).name ||
                "",
            );
            if (label != null && !readOnlyRef.current) {
              const id = hit.id;
              const key = hit.type === "frame" ? "name" : "label";
              setHistory((h) =>
                pushHistory(
                  h,
                  h.present.map((el) =>
                    el.id === id
                      ? ({ ...el, [key]: label, updatedAt: Date.now() } as RassamElement)
                      : el,
                  ),
                ),
              );
              window.setTimeout(broadcastScene, 0);
            }
            return;
          }
          if (hit && (hit.type === "line" || hit.type === "arrow")) {
            setEditingLinearId(hit.id);
            setSelectedIds([hit.id]);
            return;
          }
          if (hit && hit.type === "frame") {
            setSelectedIds(selectFrameContents(hit.id, elementsRef.current));
            return;
          }
          if (hit && hit.type === "comment") {
            const note = window.prompt(
              messages.dir === "rtl" ? "تعليق" : "Comment",
              (hit as { label?: string }).label || "",
            );
            if (note != null && !readOnlyRef.current) {
              const id = hit.id;
              setHistory((h) =>
                pushHistory(
                  h,
                  h.present.map((el) =>
                    el.id === id
                      ? ({ ...el, label: note, updatedAt: Date.now() } as RassamElement)
                      : el,
                  ),
                ),
              );
            }
            return;
          }
          setEditingLinearId(null);
        }}
        onClickCapture={(e) => {
          if (!(e.ctrlKey || e.metaKey)) {
            return;
          }
          const pt = toScene(e.clientX, e.clientY);
          const hit = hitTestElements(elementsRef.current, pt, 8);
          if (hit?.link) {
            e.preventDefault();
            window.open(hit.link, "_blank", "noopener,noreferrer");
          }
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          const pt = toScene(e.clientX, e.clientY);
          const hit = hitTestElements(elementsRef.current, pt, 6);
          if (hit && !selectedIdsRef.current.includes(hit.id)) {
            setSelectedIds(expandGroupSelection(elementsRef.current, [hit.id]));
          }
          setMenu({
            x: e.clientX,
            y: e.clientY,
            sceneX: pt.x,
            sceneY: pt.y,
            targetId: hit?.id ?? null,
          });
        }}
      />

      <ContextMenu
        messages={messages}
        locale={messages.dir === "rtl" ? "ar" : "en"}
        state={menu}
        onAction={(action) => apiRef?.current?.runContextAction(action)}
        onClose={() => setMenu(null)}
      />
      <HelpDialog
        messages={messages}
        locale={messages.dir === "rtl" ? "ar" : "en"}
        open={helpOpen}
        onClose={() => setHelpOpen(false)}
        shortcuts={HELP_SHORTCUTS}
      />

      {selectionOverlay && (
        <div
          className="rassam-marquee"
          style={{
            left: selectionOverlay.left,
            top: selectionOverlay.top,
            width: selectionOverlay.width,
            height: selectionOverlay.height,
          }}
        />
      )}

      {editingTextId && (
        <textarea
          className="rassam-text-editor"
          autoFocus
          dir="auto"
          value={textValue}
          onChange={(e) => setTextValue(e.target.value)}
          onBlur={commitText}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commitText();
            }
            if (e.key === "Escape") {
              e.preventDefault();
              commitText();
            }
          }}
          style={{
            left: textStyle.left,
            top: textStyle.top,
            color: stroke,
            borderColor: "#2563EB",
            fontFamily: pickCanvasFontFamily(textValue),
            direction: pickCanvasFontFamily(textValue).includes("Cairo")
              ? "rtl"
              : "ltr",
          }}
        />
      )}

      {pendingImage && (
        <div className="rassam-toast" dir={messages.dir}>
          {messages.imageHint}
        </div>
      )}

      {showMinimap && (
        <div className="rassam-minimap-wrap" dir={messages.dir}>
          <Minimap
            elements={elements}
            viewport={viewport}
            onNavigate={(p) => {
              const canvas = canvasRef.current;
              if (!canvas) {
                return;
              }
              const w = canvas.clientWidth;
              const h = canvas.clientHeight;
              setViewport({
                ...viewportRef.current,
                scrollX: -(p.x - w / (2 * viewportRef.current.zoom)),
                scrollY: -(p.y - h / (2 * viewportRef.current.zoom)),
              });
            }}
          />
        </div>
      )}

      <StatsPanel
        messages={messages}
        locale={messages.dir === "rtl" ? "ar" : "en"}
        stats={computeStats(elements, selectedIds, viewport)}
        open={statsOpen}
        onClose={() => setStatsOpen(false)}
      />

      {collabUsers.length > 0 && (
        <div className="rassam-collab-users" dir={messages.dir}>
          {messages.collab.users}: {collabUsers.length + 1}
        </div>
      )}

      {elements.length === 0 && !editingTextId && (
        <div className="rassam-empty" dir={messages.dir}>
          <strong>{messages.welcome.title}</strong>
          <p>{messages.welcome.subtitle}</p>
          <span>{messages.welcome.hint}</span>
        </div>
      )}
    </div>
  );
}

// re-export for App collab wiring
export { pointInBounds };
