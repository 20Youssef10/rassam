import type { RassamElement } from "./types";

const MAX_HISTORY = 80;

export type HistorySnapshot = {
  elements: RassamElement[];
  changedIds: string[];
  ts: number;
  source: "local";
};

export type HistoryState = {
  past: HistorySnapshot[];
  present: RassamElement[];
  future: HistorySnapshot[];
};

export type SceneSnapshot = {
  id: string;
  label: string;
  ts: number;
  elements: RassamElement[];
};

const SNAP_KEY = "rassam-snapshots-v1";

export function createHistory(present: RassamElement[] = []): HistoryState {
  return { past: [], present, future: [] };
}

export function diffChangedIds(
  before: RassamElement[],
  after: RassamElement[],
): string[] {
  const ids = new Set<string>();
  const beforeMap = new Map(before.map((el) => [el.id, el]));
  const afterMap = new Map(after.map((el) => [el.id, el]));
  for (const [id, el] of afterMap) {
    const prev = beforeMap.get(id);
    if (!prev || prev !== el) {
      ids.add(id);
    }
  }
  for (const id of beforeMap.keys()) {
    if (!afterMap.has(id)) {
      ids.add(id);
    }
  }
  return [...ids];
}

export function pushHistory(
  state: HistoryState,
  next: RassamElement[],
): HistoryState {
  const changedIds = diffChangedIds(state.present, next);
  const entry: HistorySnapshot = {
    elements: state.present,
    changedIds,
    ts: Date.now(),
    source: "local",
  };
  return {
    past: [...state.past, entry].slice(-MAX_HISTORY),
    present: next,
    future: [],
  };
}

export function replacePresent(
  state: HistoryState,
  present: RassamElement[],
): HistoryState {
  return { ...state, present };
}

export function mergeUndo(
  current: RassamElement[],
  snapshot: HistorySnapshot,
): RassamElement[] {
  const idSet = new Set(snapshot.changedIds);
  const prevById = new Map(
    snapshot.elements.filter((el) => idSet.has(el.id)).map((el) => [el.id, el]),
  );
  const next: RassamElement[] = [];
  for (const el of current) {
    if (!idSet.has(el.id)) {
      next.push(el);
      continue;
    }
    const prev = prevById.get(el.id);
    if (prev) {
      next.push(prev);
      prevById.delete(el.id);
    }
  }
  for (const el of prevById.values()) {
    next.push(el);
  }
  return next;
}

export function mergeRedo(
  current: RassamElement[],
  snapshot: HistorySnapshot,
  redoTarget: RassamElement[],
): RassamElement[] {
  const idSet = new Set(snapshot.changedIds);
  const targetById = new Map(
    redoTarget.filter((el) => idSet.has(el.id)).map((el) => [el.id, el]),
  );
  const next: RassamElement[] = [];
  const used = new Set<string>();
  for (const el of current) {
    if (!idSet.has(el.id)) {
      next.push(el);
      continue;
    }
    const t = targetById.get(el.id);
    if (t) {
      next.push(t);
      used.add(el.id);
    } else {
      next.push(el);
    }
  }
  for (const [id, t] of targetById) {
    if (!used.has(id) && !next.some((el) => el.id === id)) {
      next.push(t);
    }
  }
  return next;
}

export function undo(state: HistoryState, multiplayer = false): HistoryState {
  if (!state.past.length) {
    return state;
  }
  const snapshot = state.past[state.past.length - 1];
  const present = multiplayer
    ? mergeUndo(state.present, snapshot)
    : snapshot.elements;
  return {
    past: state.past.slice(0, -1),
    present,
    future: [
      {
        elements: state.present,
        changedIds: snapshot.changedIds,
        ts: Date.now(),
        source: "local",
      },
      ...state.future,
    ],
  };
}

export function redo(state: HistoryState, multiplayer = false): HistoryState {
  if (!state.future.length) {
    return state;
  }
  const snapshot = state.future[0];
  const present = multiplayer
    ? mergeRedo(state.present, snapshot, snapshot.elements)
    : snapshot.elements;
  return {
    past: [
      ...state.past,
      {
        elements: state.present,
        changedIds: snapshot.changedIds,
        ts: Date.now(),
        source: "local",
      },
    ],
    present,
    future: state.future.slice(1),
  };
}

export function canUndo(state: HistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: HistoryState): boolean {
  return state.future.length > 0;
}

export function listSnapshots(): SceneSnapshot[] {
  try {
    return JSON.parse(localStorage.getItem(SNAP_KEY) || "[]") as SceneSnapshot[];
  } catch {
    return [];
  }
}

export function saveSnapshot(
  elements: RassamElement[],
  label?: string,
): SceneSnapshot {
  const snap: SceneSnapshot = {
    id: `snap_${Date.now().toString(36)}`,
    label: label || new Date().toLocaleString(),
    ts: Date.now(),
    elements,
  };
  const all = [...listSnapshots(), snap].slice(-30);
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(all));
  } catch {
    // quota
  }
  return snap;
}

export function restoreSnapshot(id: string): RassamElement[] | null {
  const snap = listSnapshots().find((s) => s.id === id);
  return snap ? snap.elements : null;
}
