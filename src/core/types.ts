export type Tool =
  | "select"
  | "hand"
  | "lasso"
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "line"
  | "arrow"
  | "elbow"
  | "draw"
  | "text"
  | "image"
  | "sticky"
  | "frame"
  | "bucket"
  | "laser"
  | "eraser";

export type ElementType =
  | "rectangle"
  | "diamond"
  | "ellipse"
  | "line"
  | "arrow"
  | "draw"
  | "text"
  | "image"
  | "sticky"
  | "frame"
  | "comment";

export type Point = { x: number; y: number };

export type ElementBinding = {
  elementId: string;
  focus?: number;
  gap?: number;
};

export type BaseElement = {
  id: string;
  type: ElementType;
  x: number;
  y: number;
  stroke: string;
  fill: string;
  strokeWidth: number;
  opacity: number;
  seed: number;
  rotation?: number;
  locked?: boolean;
  groupIds?: string[];
  /** External hyperlink (Ctrl/Cmd+click to open) */
  link?: string;
  strokeStyle?: "solid" | "dashed" | "dotted";
  arrowhead?: "none" | "triangle" | "bar";
  updatedAt?: number;
};

export type ShapeElement = BaseElement & {
  type: "rectangle" | "diamond" | "ellipse" | "sticky" | "frame" | "comment";
  width: number;
  height: number;
  label?: string;
  name?: string;
};

export type LinearElement = BaseElement & {
  type: "line" | "arrow";
  points: Point[];
  startBinding?: ElementBinding | null;
  endBinding?: ElementBinding | null;
  label?: string;
  /** orthogonal elbow routing */
  elbow?: boolean;
};

export type DrawElement = BaseElement & {
  type: "draw";
  points: Point[];
};

export type TextElement = BaseElement & {
  type: "text";
  text: string;
  fontSize: number;
  fontFamily: string;
  width: number;
  height: number;
};

export type ImageElement = BaseElement & {
  type: "image";
  width: number;
  height: number;
  fileId: string;
  /** optional crop window in image natural coords (normalized 0-1) */
  crop?: { x: number; y: number; w: number; h: number };
};

export type RassamElement =
  | ShapeElement
  | LinearElement
  | DrawElement
  | TextElement
  | ImageElement;

export type Viewport = {
  scrollX: number;
  scrollY: number;
  zoom: number;
};

export type FilePayload = {
  dataURL: string;
  mimeType: string;
};

export type Scene = {
  elements: RassamElement[];
  viewport: Viewport;
  version: number;
  files?: Record<string, FilePayload>;
  gridEnabled?: boolean;
  snapEnabled?: boolean;
};

export const RASSAM_SCENE_TYPE = "rassam-scene";

export type Bounds = { x: number; y: number; width: number; height: number };

export type ResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "e"
  | "se"
  | "s"
  | "sw"
  | "w";

export const DEFAULT_STROKE = "#0F172A";
export const DEFAULT_FILL = "transparent";
export const DEFAULT_STROKE_WIDTH = 2;
export const DEFAULT_FONT_SIZE = 20;
export const ARABIC_FONT = "Cairo, 'Noto Naskh Arabic', 'Segoe UI', sans-serif";

export const MIN_ZOOM = 0.2;
export const MAX_ZOOM = 4;
export const HANDLE_SIZE = 8;
export const MIN_ELEMENT_SIZE = 8;
export const BIND_SNAP_DISTANCE = 48;
export const ELBOW_GAP = 16;
