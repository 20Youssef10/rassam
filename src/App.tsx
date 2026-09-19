import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Editor, type EditorApi } from "./editor/Editor";
import { Toolbar } from "./ui/Toolbar";
import { TopBar } from "./ui/TopBar";
import { LibraryPanel } from "./ui/LibraryPanel";
import { FontPicker } from "./ui/FontPicker";
import { DEFAULT_LOCALE, applyDocumentLocale, messages, type Locale } from "./i18n";
import {
  DEFAULT_FILL,
  DEFAULT_STROKE,
  DEFAULT_STROKE_WIDTH,
  type FilePayload,
  type RassamElement,
  type Tool,
  type Viewport,
} from "./core/types";
import type { Theme } from "./styles/tokens";
import { CollabClient, roomLibraryKey, type CollabStatus } from "./collab/CollabClient";
import {
  buildCollabLink,
  encryptJSON,
  generateRoomId,
  generateRoomKey,
  parseCollabLink,
  decryptJSON,
} from "./collab/crypto";
import { getConfig, loadRoomScene, saveRoomScene } from "./collab/storageApi";
import { onRemoteViewport } from "./collab/events";
import { CollaboratorPanel } from "./ui/CollaboratorPanel";
import { CommandPalette } from "./ui/CommandPalette";
import { MermaidDialog } from "./ui/MermaidDialog";
import { AiTtdDialog } from "./ui/AiTtdDialog";
import { LayersPanel } from "./ui/LayersPanel";
import { ChatPanel } from "./ui/ChatPanel";
import {
  PresentationOverlay,
  usePresentation,
} from "./ui/Presentation";
import { buildCommands } from "./editor/commandPalette";
import {
  activatePlugins,
  getPluginCommands,
  registerBuiltinPlugins,
} from "./plugins/registry";
import type { AlignMode } from "./core/align";
import type { LibraryItem } from "./library/arabicShapes";
import {
  loadLocalLibrary,
  pushServerLibrary,
  fetchServerLibrary,
  saveLocalLibrary,
  type LibraryRecord,
} from "./library/libraryStore";
// Self-hosted fonts only (@fontsource) — no Google Fonts CDN (E2E finding)

export default function App() {
  const [locale, setLocale] = useState<Locale>(DEFAULT_LOCALE);
  const [theme, setTheme] = useState<Theme>("light");
  const [tool, setTool] = useState<Tool>("rectangle");
  const [stroke, setStroke] = useState(DEFAULT_STROKE);
  const [fill, setFill] = useState(DEFAULT_FILL);
  const [strokeWidth, setStrokeWidth] = useState(DEFAULT_STROKE_WIDTH);
  const [preferredFont, setPreferredFont] = useState("");
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [viewport, setViewport] = useState<Viewport>({
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
  });
  const [elementCount, setElementCount] = useState(0);
  const [, setLayerTick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setLayerTick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, []);
  const [selectionCount, setSelectionCount] = useState(0);
  const [historyFlags, setHistoryFlags] = useState({ canUndo: false, canRedo: false });
  const [clearSignal, setClearSignal] = useState(0);
  const [collabStatus, setCollabStatus] = useState<CollabStatus>("idle");
  const [collabLink, setCollabLink] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<string | null>(null);
  const [readOnly, setReadOnly] = useState(false);
  const [liveMessage, setLiveMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [customLibrary, setCustomLibrary] = useState<LibraryRecord[]>([]);
  const [gridEnabled, setGridEnabled] = useState(false);
  const [snapEnabled, setSnapEnabled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [zenMode, setZenMode] = useState(false);
  const [viewOnly, setViewOnly] = useState(false);
  const [mermaidOpen, setMermaidOpen] = useState(false);
  const [opacity, setOpacity] = useState(1);
  const [strokeStyle, setStrokeStyle] = useState<"solid" | "dashed" | "dotted">("solid");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [layersOpen, setLayersOpen] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const presentation = usePresentation([]);
  // presentation needs live elements — use apiRef when starting
  const [presentSlides, setPresentSlides] = useState<
    ReturnType<typeof import("./ui/Presentation").collectSlides>
  >([]);
  const [presenting, setPresenting] = useState(false);
  const [presentIndex, setPresentIndex] = useState(0);
  const [userName, setUserName] = useState(
    () => localStorage.getItem("rassam-username") || "",
  );
  const [followingId, setFollowingId] = useState<string | null>(null);
  const [roomId, setRoomId] = useState<string | null>(null);

  const apiRef = useRef<EditorApi | null>(null);
  const collabRef = useRef<CollabClient | null>(null);
  const roomKeyRef = useRef<string | null>(null);

  const t = messages[locale];

  useEffect(() => {
    applyDocumentLocale(locale);
  }, [locale]);

  useEffect(() => {
    // fonts.css (@fontsource) is imported in main.tsx — do not inject Google Fonts
  }, []);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Offline cache is best-effort; a failed registration must not break the app.
      navigator.serviceWorker.register("/sw.js").catch(() => undefined);
    }
  }, []);

  useEffect(() => {
    setLiveMessage(
      collabStatus === "connected"
        ? t.collab.connected
        : collabStatus === "read-only"
          ? t.collab.readOnly
          : collabStatus === "error"
            ? t.collab.offline
            : "",
    );
  }, [collabStatus, t.collab]);

  useEffect(() => {
    apiRef.current?.setPreferredFont(preferredFont);
  }, [preferredFont]);

  useEffect(() => {
    registerBuiltinPlugins();
    void activatePlugins({
      locale,
      insertElements: (els) => apiRef.current?.insertElements(els),
      getElements: () => apiRef.current?.getElements() || [],
      setLiveMessage,
      registerCommand: () => undefined,
    });
  }, [locale]);

  useEffect(() => {
    const onSaveErr = (e: Event) => {
      const detail = (e as CustomEvent<string | null>).detail;
      setSaveError(detail || null);
    };
    window.addEventListener("rassam-save-error", onSaveErr);
    return () => window.removeEventListener("rassam-save-error", onSaveErr);
  }, []);

  const startPresentation = useCallback(async () => {
    const { collectSlides } = await import("./ui/Presentation");
    const els = apiRef.current?.getElements() || [];
    const slides = collectSlides(els);
    if (!slides.length) {
      setLiveMessage(t.advanced.noFrames);
      return;
    }
    setPresentSlides(slides);
    setPresentIndex(0);
    setPresenting(true);
    void presentation;
  }, [t.advanced.noFrames, presentation]);

  const startCollabRef = useRef<(readOnly: boolean) => Promise<void>>(
    async () => undefined,
  );

  const paletteCommands = useMemo(() => {
    return [
      ...buildCommands({
        setTool,
        undo: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true })),
        redo: () => window.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true })),
        duplicate: () => apiRef.current?.duplicateSelection(),
        copy: () => apiRef.current?.copySelection(),
        paste: () => apiRef.current?.pasteClipboard(),
        deleteSel: () => apiRef.current?.deleteSelection(),
        group: () => apiRef.current?.groupSelection(),
        ungroup: () => apiRef.current?.ungroupSelection(),
        exportPng: () => apiRef.current?.exportPng(),
        exportSvg: () => apiRef.current?.exportSvg(false),
        exportJson: () => apiRef.current?.exportJson(),
        toggleTheme: () => setTheme((th) => (th === "dark" ? "light" : "dark")),
        toggleLocale: () => setLocale((l) => (l === "ar" ? "en" : "ar")),
        toggleGrid: () => {
          setGridEnabled((g) => {
            apiRef.current?.setGridEnabled(!g);
            return !g;
          });
        },
        toggleStats: () => apiRef.current?.toggleStats(),
        toggleMinimap: () => apiRef.current?.toggleMinimap(),
        toggleHelp: () => apiRef.current?.toggleHelp(),
        openLibrary: () => setLibraryOpen(true),
        openMermaid: () => setMermaidOpen(true),
        toggleZen: () => setZenMode((z) => !z),
        toggleViewOnly: () => setViewOnly((v) => !v),
        startPresentation: () => void startPresentation(),
        startCollab: () => void startCollabRef.current(false),
        shareReadOnly: () => void startCollabRef.current(true),
      }),
      ...getPluginCommands(),
    ];
  }, [startPresentation, setTool]);

  const effectiveReadOnly = readOnly || viewOnly;

  useEffect(() => {
    const local = loadLocalLibrary();
    setCustomLibrary(local);
    void fetchServerLibrary().then((remote) => {
      if (remote.length) {
        const merged = [...local];
        for (const item of remote) {
          if (!merged.some((m) => m.id === item.id)) {
            merged.push(item);
          }
        }
        setCustomLibrary(merged);
        saveLocalLibrary(merged);
      }
    });
  }, []);

  const insertLibraryItem = useCallback((item: LibraryItem) => {
    const api = apiRef.current;
    if (!api) {
      return;
    }
    const vp = viewport;
    const origin = {
      x: -vp.scrollX + 80 / vp.zoom,
      y: -vp.scrollY + 80 / vp.zoom,
    };
    const els = item.create(origin);
    api.insertElements(els);
    setLibraryOpen(false);
    setTool("select");
    setLiveMessage(locale === "ar" ? "تم إدراج عنصر من المكتبة" : "Library item inserted");
  }, [viewport, locale]);

  const setupCollabClient = useCallback(() => {
    if (collabRef.current) {
      return collabRef.current;
    }
    const client = new CollabClient({
      onStatus: (status) => setCollabStatus(status),
      onUsers: () => undefined,
      onScene: (scene) => {
        // Remote scene merge — no local history entry (multiplayer-safe undo)
        apiRef.current?.setRemoteScene(scene.elements, scene.files);
      },
      onCursor: () => undefined,
    });
    collabRef.current = client;
    return client;
  }, []);

  // Follow viewport
  useEffect(() => {
    return onRemoteViewport((v) => {
      if (!followingId || v.userId !== followingId) {
        return;
      }
      apiRef.current?.setViewport({
        scrollX: v.scrollX,
        scrollY: v.scrollY,
        zoom: v.zoom,
      });
    });
  }, [followingId]);

  // Room library sync
  const syncRoomLibrary = useCallback(async (id: string) => {
    const key = roomLibraryKey(id);
    const remote = await fetchServerLibrary(key).catch(() => [] as LibraryRecord[]);
    if (remote.length) {
      setCustomLibrary((prev) => {
        const merged = [...prev];
        for (const item of remote) {
          if (!merged.some((m) => m.id === item.id)) {
            merged.push(item);
          }
        }
        return merged;
      });
    }
  }, []);

  // Join room/share from URL hash
  useEffect(() => {
    const parts = parseCollabLink(window.location.hash);
    if (!parts) {
      return;
    }
    const client = setupCollabClient();
    const { wsUrl } = getConfig();
    void client
      .connect({
        url: wsUrl,
        roomId: parts.roomId,
        roomKey: parts.roomKey,
        readOnly: parts.readOnly,
      })
      .then(async () => {
        roomKeyRef.current = parts.roomKey;
        setCollabLink(window.location.href);
        setReadOnly(parts.readOnly);
        setCollabStatus(parts.readOnly ? "read-only" : "connected");
        setRoomId(parts.roomId);
        if (userName) {
          collabRef.current?.setUserName(userName);
        }
        void syncRoomLibrary(parts.roomId);
        const remote = await loadRoomScene(parts.roomId).catch(() => null);
        if (remote && apiRef.current) {
          try {
            const scene = await decryptJSON<{
              elements: RassamElement[];
              files?: Record<string, FilePayload>;
            }>(remote, parts.roomKey);
            if (scene && Array.isArray(scene.elements)) {
              apiRef.current.setRemoteScene(
                scene.elements.slice(0, 5000),
                scene.files,
              );
            }
          } catch {
            setCollabStatus(parts.readOnly ? "read-only" : "connected");
            setLiveMessage(
              locale === "ar" ? "مفتاح الغرفة غير صحيح أو اللقطة تالفة" : "Wrong room key or corrupt snapshot",
            );
          }
        }
      })
      .catch(() => setCollabStatus("error"));
  }, [setupCollabClient, syncRoomLibrary, userName]);

  const persistRoomSnapshot = useCallback(async () => {
    const client = collabRef.current;
    const key = roomKeyRef.current;
    const api = apiRef.current;
    if (!client || !key || !api || client.isReadOnly) {
      return;
    }
    // Prefer the live client room id; fall back to the URL hash link.
    const parts = parseCollabLink(window.location.hash) ??
      (collabLink ? parseCollabLink(new URL(collabLink).hash) : null);
    const id = client.getRoomId() ?? parts?.roomId;
    if (!id) {
      return;
    }
    const payload = await encryptJSON(
      { elements: api.getElements(), files: api.getFiles(), ts: Date.now() },
      key,
    );
    await saveRoomScene(id, payload).catch((error) => {
      console.warn("Rassam: room snapshot save failed", error);
    });
  }, [collabLink]);

  const startCollab = useCallback(
    async (readOnlyMode: boolean) => {
      const client = setupCollabClient();
      const id = await generateRoomId();
      const roomKey = await generateRoomKey();
      roomKeyRef.current = roomKey;
      const link = buildCollabLink(id, roomKey, readOnlyMode);
      const { wsUrl } = getConfig();
      await client.connect({
        url: wsUrl,
        roomId: id,
        roomKey,
        readOnly: readOnlyMode,
        userName: userName || undefined,
      });
      setCollabLink(link);
      setReadOnly(readOnlyMode);
      setCollabStatus(readOnlyMode ? "read-only" : "connected");
      setRoomId(id);
      window.history.replaceState(null, "", link);
      void syncRoomLibrary(id);
      if (apiRef.current && !readOnlyMode) {
        const payload = await encryptJSON(
          {
            elements: apiRef.current.getElements(),
            files: apiRef.current.getFiles(),
            ts: Date.now(),
          },
          roomKey,
        );
        await saveRoomScene(id, payload).catch((error) => {
          console.warn("Rassam: initial room snapshot save failed", error);
        });
        void client.broadcastScene(
          apiRef.current.getElements(),
          apiRef.current.getFiles(),
        );
      }
    },
    [setupCollabClient, userName, syncRoomLibrary],
  );

  useEffect(() => {
    startCollabRef.current = startCollab;
  }, [startCollab]);

  const stopCollab = useCallback(() => {
    collabRef.current?.disconnect();
    collabRef.current = null;
    roomKeyRef.current = null;
    setCollabStatus("idle");
    setCollabLink(null);
    setReadOnly(false);
    setRoomId(null);
    setFollowingId(null);
    const url = new URL(window.location.href);
    url.hash = "";
    window.history.replaceState(null, "", url.toString());
  }, []);

  const renameSelf = useCallback(() => {
    const next = window.prompt(t.collab.rename, userName || t.collab.you);
    if (next == null || !next.trim()) {
      return;
    }
    const name = next.trim().slice(0, 64);
    setUserName(name);
    localStorage.setItem("rassam-username", name);
    collabRef.current?.setUserName(name);
    void collabRef.current?.broadcastPresence("active");
  }, [userName, t.collab.rename, t.collab.you]);

  const onHistoryChange = useCallback((canUndo: boolean, canRedo: boolean) => {
    setHistoryFlags({ canUndo, canRedo });
  }, []);

  const fireUndo = () =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
  const fireRedo = () =>
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "y", ctrlKey: true }));

  const onAlign = useCallback((mode: AlignMode) => {
    apiRef.current?.align(mode);
  }, []);

  const onDistribute = useCallback((axis: "x" | "y") => {
    apiRef.current?.distribute(axis);
  }, []);

  const onCopyLink = useCallback(async () => {
    if (!collabLink) {
      return;
    }
    try {
      await navigator.clipboard.writeText(collabLink);
      setCopyState(t.collab.copied);
    } catch {
      window.prompt(t.collab.copyLink, collabLink);
    }
    window.setTimeout(() => setCopyState(null), 2000);
  }, [collabLink, t.collab.copied, t.collab.copyLink]);

  // persist room snapshot when elements change while connected
  useEffect(() => {
    if (collabStatus !== "connected" && collabStatus !== "read-only") {
      return;
    }
    const id = window.setTimeout(() => {
      void persistRoomSnapshot();
    }, 600);
    return () => window.clearTimeout(id);
  }, [elementCount, collabStatus, persistRoomSnapshot]);

  return (
    <div
      className={`rassam-app theme-${theme}${zenMode ? " is-zen" : ""}${
        effectiveReadOnly ? " is-viewonly" : ""
      }`}
      dir={t.dir}
    >
      <a className="rassam-skip" href="#rassam-canvas">
        {t.a11y.skipCanvas}
      </a>
      <div className="rassam-live" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </div>
      <TopBar
        messages={t}
        theme={theme}
        strokeWidth={strokeWidth}
        zoom={viewport.zoom}
        elementCount={elementCount}
        selectionCount={selectionCount}
        undoDisabled={!historyFlags.canUndo}
        redoDisabled={!historyFlags.canRedo}
        collabStatus={collabStatus}
        collabLink={collabLink}
        onUndo={fireUndo}
        onRedo={fireRedo}
        onClear={() => setClearSignal((n) => n + 1)}
        onExportPng={() => apiRef.current?.exportPng()}
        onExportPng2x={() => apiRef.current?.exportPngScaled(2, false)}
        onExportPdf={() => void apiRef.current?.exportPdf()}
        onCopyPng={() => void apiRef.current?.copyPng()}
        onExportSvg={() => apiRef.current?.exportSvg(false)}
        onExportSvgSelection={() => apiRef.current?.exportSvg(true)}
        onExportJson={() => apiRef.current?.exportJson()}
        onImportJson={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = "application/json,.json";
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              return;
            }
            const text = await file.text();
            apiRef.current?.importJsonText(text);
          };
          input.click();
        }}
        onToggleHelp={() => apiRef.current?.toggleHelp()}
        onToggleStats={() => apiRef.current?.toggleStats()}
        onToggleMinimap={() => apiRef.current?.toggleMinimap()}
        onOpenPalette={() => setPaletteOpen(true)}
        onToggleZen={() => setZenMode((z) => !z)}
        onToggleViewOnly={() => setViewOnly((v) => !v)}
        onOpenMermaid={() => setMermaidOpen(true)}
        onStartPresentation={() => void startPresentation()}
        onZoomIn={() => apiRef.current?.zoomIn()}
        onZoomOut={() => apiRef.current?.zoomOut()}
        onFitContent={() => apiRef.current?.fitToContent()}
        onExportSelectedFrame={() => {
          const ids = apiRef.current?.getSelectedIds() || [];
          const els = apiRef.current?.getElements() || [];
          const frame =
            els.find((el) => el.id === ids[0] && el.type === "frame") ||
            els.find((el) => el.type === "frame");
          if (frame) {
            apiRef.current?.exportFrame(frame.id);
          }
        }}
        onImportExcalidraw={() => {
          const input = document.createElement("input");
          input.type = "file";
          input.accept = ".json,.excalidraw,application/json";
          input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) {
              return;
            }
            const text = await file.text();
            apiRef.current?.importExcalidrawJson(text);
          };
          input.click();
        }}
        onToggleLayers={() => setLayersOpen((v) => !v)}
        onToggleChat={() => setChatOpen((v) => !v)}
        onOpenAi={() => setAiOpen(true)}
        onSaveSnapshot={() => {
          apiRef.current?.saveHistorySnapshot();
          setLiveMessage(locale === "ar" ? "تم حفظ لقطة" : "Snapshot saved");
        }}
        onAddComment={() => {
          const text = window.prompt(
            locale === "ar" ? "نص التعليق" : "Comment text",
            "",
          );
          if (text == null) {
            return;
          }
          const vp = viewport;
          apiRef.current?.addComment(
            -vp.scrollX + 80 / vp.zoom,
            -vp.scrollY + 80 / vp.zoom,
            text || "…",
          );
        }}
        onOpacityChange={(value) => {
          setOpacity(value);
          apiRef.current?.setSelectionStyle({ opacity: value });
        }}
        onStrokeStyleChange={(style) => {
          setStrokeStyle(style);
          apiRef.current?.setSelectionStyle({ strokeStyle: style });
        }}
        opacity={opacity}
        strokeStyle={strokeStyle}
        zenMode={zenMode}
        viewOnly={effectiveReadOnly}
        onToggleGrid={() => {
          setGridEnabled((g) => {
            const next = !g;
            apiRef.current?.setGridEnabled(next);
            return next;
          });
        }}
        onToggleSnap={() => {
          setSnapEnabled((s) => {
            const next = !s;
            apiRef.current?.setSnapEnabled(next);
            return next;
          });
        }}
        gridEnabled={gridEnabled}
        snapEnabled={snapEnabled}
        onToggleTheme={() => setTheme((th) => (th === "dark" ? "light" : "dark"))}
        onToggleLocale={() => setLocale((l) => (l === "ar" ? "en" : "ar"))}
        onAlign={onAlign}
        onDistribute={onDistribute}
        onStartCollab={() => void startCollab(false)}
        onStartShareReadonly={() => void startCollab(true)}
        onStopCollab={stopCollab}
        onCopyLink={() => void onCopyLink()}
        stroke={stroke}
        fill={fill}
        onStrokeChange={setStroke}
        onFillChange={setFill}
        onStrokeWidthChange={setStrokeWidth}
      />
      <div className="rassam-body">
        <Toolbar messages={t} tool={tool} onToolChange={setTool} />
        <div className="rassam-stage">
          <div className="rassam-stage-tools">
            <FontPicker
              messages={t}
              locale={locale}
              value={preferredFont}
              onChange={setPreferredFont}
            />
            <label className="rassam-search">
              <span className="rassam-label">{t.search.label}</span>
              <input
                type="search"
                value={searchQuery}
                placeholder={t.search.placeholder}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  apiRef.current?.setSearchQuery(e.target.value);
                }}
              />
            </label>
            <button type="button" onClick={() => apiRef.current?.groupSelection()}>
              {t.edit.group}
            </button>
            <button type="button" onClick={() => apiRef.current?.ungroupSelection()}>
              {t.edit.ungroup}
            </button>
            <button type="button" onClick={() => apiRef.current?.toggleLockSelection()}>
              {t.edit.lock}
            </button>
            <button
              type="button"
              onClick={() => apiRef.current?.rotateSelection(Math.PI / 12)}
            >
              {t.edit.rotate}
            </button>
            <button
              type="button"
              onClick={() => setLibraryOpen(true)}
              aria-haspopup="dialog"
            >
              {t.library.open}
            </button>
            <button
              type="button"
              onClick={() => {
                const api = apiRef.current;
                if (!api) {
                  return;
                }
                const ids = new Set(api.getSelectedIds());
                const els = api.getElements().filter((el) => ids.has(el.id));
                if (!els.length) {
                  return;
                }
                const minX = Math.min(...els.map((el) => el.x));
                const minY = Math.min(...els.map((el) => el.y));
                const template = els.map((el) => ({ ...el, x: el.x - minX, y: el.y - minY }));
                const record = {
                  id: `custom_${Date.now().toString(36)}`,
                  titleAr: "عنصر محفوظ",
                  titleEn: "Saved element",
                  category: "custom",
                  template,
                };
                const next = [...customLibrary, record];
                setCustomLibrary(next);
                saveLocalLibrary(next);
                void pushServerLibrary(next, collabRef.current?.id);
                if (roomId) {
                  void pushServerLibrary(
                    [...customLibrary.filter((c) => c.category === "room"), record].map((c) => ({
                      ...c,
                      category: "room",
                    })),
                    roomLibraryKey(roomId),
                  );
                }
                setLiveMessage(t.library.saved);
              }}
            >
              {t.library.saveSelection}
            </button>
          </div>
          <div id="rassam-canvas" className="rassam-editor-host" tabIndex={-1}>
            <Editor
              messages={t}
              theme={theme}
              tool={tool}
              stroke={stroke}
              fill={fill}
              strokeWidth={strokeWidth}
              preferredFont={preferredFont}
              collabRef={collabRef}
              apiRef={apiRef}
              readOnly={effectiveReadOnly}
              onViewportChange={setViewport}
              onElementsChange={setElementCount}
              onHistoryChange={onHistoryChange}
              onSelectionChange={setSelectionCount}
              onToolChange={setTool}
              clearSignal={clearSignal}
            />
            {(collabStatus === "connected" ||
              collabStatus === "read-only" ||
              collabStatus === "connecting") && (
              <CollaboratorPanel
                messages={t}
                locale={locale}
                selfId={collabRef.current?.id || ""}
                selfName={userName}
                followingId={followingId}
                onRename={renameSelf}
                onFollow={(id) => {
                  setFollowingId(id);
                  void collabRef.current?.setFollowing(id);
                }}
              />
            )}
          </div>
        </div>
      </div>
      <LibraryPanel
        messages={t}
        locale={locale}
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        onInsert={insertLibraryItem}
        customItems={customLibrary}
        onLoadRemote={(records) => {
          const merged = [...customLibrary, ...records];
          setCustomLibrary(merged);
          saveLocalLibrary(merged);
          setLiveMessage(locale === "ar" ? "تم تحميل مكتبة عن بُعد" : "Remote library loaded");
        }}
        onInsertCustom={(record) => {
          const api = apiRef.current;
          if (!api) {
            return;
          }
          if (!record || !Array.isArray(record.template)) {
            return;
          }
          const vp = viewport;
          const origin = {
            x: -vp.scrollX + 80 / vp.zoom,
            y: -vp.scrollY + 80 / vp.zoom,
          };
          const els = (record.template as RassamElement[]).slice(0, 500).map((el) => ({
            ...el,
            id: `${el.id}_${Math.random().toString(36).slice(2, 6)}`,
            x: el.x + origin.x,
            y: el.y + origin.y,
          }));
          api.insertElements(els);
          setLibraryOpen(false);
          setTool("select");
        }}
      />
      <CommandPalette
        messages={t}
        locale={locale}
        open={paletteOpen}
        commands={paletteCommands}
        onClose={() => setPaletteOpen(false)}
      />
      <MermaidDialog
        messages={t}
        locale={locale}
        open={mermaidOpen}
        onClose={() => setMermaidOpen(false)}
        onImport={(els) => {
          apiRef.current?.insertElements(els);
          setTool("select");
          setLiveMessage(locale === "ar" ? "تم إدراج مخطط Mermaid" : "Mermaid diagram inserted");
        }}
      />
      {presenting && presentSlides.length > 0 && (
        <PresentationOverlay
          messages={t}
          locale={locale}
          slides={presentSlides}
          index={presentIndex}
          onNext={() => setPresentIndex((i) => Math.min(presentSlides.length - 1, i + 1))}
          onPrev={() => setPresentIndex((i) => Math.max(0, i - 1))}
          onExit={() => setPresenting(false)}
        />
      )}
      <LayersPanel
        messages={t}
        locale={locale}
        elements={apiRef.current?.getElements() || []}
        selectedIds={apiRef.current?.getSelectedIds() || []}
        open={layersOpen}
        onClose={() => setLayersOpen(false)}
        onSelect={(id, additive) => apiRef.current?.selectElement(id, additive)}
        onRaise={(id) => apiRef.current?.raiseElement(id)}
        onLower={(id) => apiRef.current?.lowerElement(id)}
      />
      <ChatPanel
        messages={t}
        locale={locale}
        open={chatOpen}
        onClose={() => setChatOpen(false)}
        selfId={collabRef.current?.id || ""}
        selfName={userName}
        onSend={(text) => void collabRef.current?.broadcastChat(text)}
      />
      <AiTtdDialog
        messages={t}
        locale={locale}
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        onInsert={(els) => {
          apiRef.current?.insertElements(els);
          setTool("select");
          setLiveMessage(locale === "ar" ? "تم إنشاء المخطط" : "Diagram created");
        }}
      />
      <footer className="rassam-status" dir={t.dir}>
        <span>{saveError || t.status.saved}</span>
        <span>
          {elementCount} {t.status.elements}
          {selectionCount > 0 ? ` · ${selectionCount} ${t.status.selected}` : ""}
        </span>
        <span>
          {collabLink
            ? locale === "ar"
              ? "غرفة"
              : "Room"
            : locale === "ar"
              ? "محلي"
              : "Local"}
        </span>
        <span>{Math.round((viewport.zoom + Number.EPSILON) * 100)}%</span>
        {copyState && <span className="rassam-copy-ok">{copyState}</span>}
        {collabLink && (
          <span className="rassam-collab-chip" title={collabLink}>
            {readOnly ? t.collab.readOnly : t.collab.connected}
          </span>
        )}
      </footer>
    </div>
  );
}
