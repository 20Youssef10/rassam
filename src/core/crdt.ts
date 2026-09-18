/**
 * Rassam CRDT — per-element Lamport clocks + operation log.
 * Merges concurrent edits without whole-scene LWW clobber.
 */
import type { RassamElement } from "./types";

export type CrdtOp =
  | { type: "upsert"; el: RassamElement; clock: number; actor: string }
  | { type: "delete"; id: string; clock: number; actor: string };

export type CrdtState = {
  /** id → element */
  map: Record<string, RassamElement>;
  /** id → {clock, actor} */
  clocks: Record<string, { clock: number; actor: string }>;
  /** ids deleted */
  deleted: Record<string, { clock: number; actor: string }>;
  /** actor lamport */
  clock: number;
  actor: string;
};

export function createCrdt(actor: string, elements: RassamElement[] = []): CrdtState {
  const state: CrdtState = {
    map: {},
    clocks: {},
    deleted: {},
    clock: 0,
    actor,
  };
  const now = Date.now();
  for (const el of elements) {
    state.map[el.id] = el;
    state.clocks[el.id] = { clock: now, actor };
  }
  return state;
}

function wins(
  incoming: { clock: number; actor: string },
  existing?: { clock: number; actor: string },
): boolean {
  if (!existing) {
    return true;
  }
  if (incoming.clock > existing.clock) {
    return true;
  }
  if (incoming.clock === existing.clock && incoming.actor > existing.actor) {
    return true;
  }
  return false;
}

export function applyOp(state: CrdtState, op: CrdtOp): CrdtState {
  const clock = Math.max(state.clock, op.clock) + 1;
  if (op.type === "upsert") {
    const id = op.el.id;
    const existing = state.clocks[id];
    const del = state.deleted[id];
    if (del && !wins({ clock: op.clock, actor: op.actor }, del)) {
      return { ...state, clock };
    }
    if (!wins({ clock: op.clock, actor: op.actor }, existing)) {
      return { ...state, clock };
    }
    return {
      ...state,
      clock,
      map: { ...state.map, [id]: op.el },
      clocks: {
        ...state.clocks,
        [id]: { clock: op.clock, actor: op.actor },
      },
      deleted: (() => {
        const d = { ...state.deleted };
        delete d[id];
        return d;
      })(),
    };
  }
  const delId = op.id;
  const existing = state.clocks[delId];
  if (existing && !wins({ clock: op.clock, actor: op.actor }, existing)) {
    return { ...state, clock };
  }
  const map = { ...state.map };
  delete map[delId];
  const clocks = { ...state.clocks };
  delete clocks[delId];
  return {
    ...state,
    clock,
    map,
    clocks,
    deleted: {
      ...state.deleted,
      [delId]: { clock: op.clock, actor: op.actor },
    },
  };
}

export function opsFromDiff(
  prev: RassamElement[],
  next: RassamElement[],
  actor: string,
  clock: number,
): CrdtOp[] {
  const prevMap = new Map(prev.map((el) => [el.id, el]));
  const nextMap = new Map(next.map((el) => [el.id, el]));
  const ops: CrdtOp[] = [];
  const ts = clock;
  for (const el of next) {
    const old = prevMap.get(el.id);
    if (!old || JSON.stringify(old) !== JSON.stringify(el)) {
      ops.push({ type: "upsert", el, clock: ts, actor });
    }
  }
  for (const [id] of prevMap) {
    if (!nextMap.has(id)) {
      ops.push({ type: "delete", id, clock: ts, actor });
    }
  }
  return ops;
}

export function elementsFromCrdt(state: CrdtState): RassamElement[] {
  return Object.values(state.map);
}

export function mergeOps(local: CrdtState, remoteOps: CrdtOp[]): CrdtState {
  return remoteOps.reduce((s, op) => applyOp(s, op), local);
}

export function opsFromState(state: CrdtState): CrdtOp[] {
  const ops: CrdtOp[] = [];
  for (const el of Object.values(state.map)) {
    const c = state.clocks[el.id];
    ops.push({
      type: "upsert",
      el,
      clock: c?.clock ?? state.clock,
      actor: c?.actor ?? state.actor,
    });
  }
  for (const [id, c] of Object.entries(state.deleted)) {
    ops.push({ type: "delete", id, clock: c.clock, actor: c.actor });
  }
  return ops;
}

/** Snapshot for storage backend (encrypted upstream). */
export function serializeCrdt(state: CrdtState): string {
  return JSON.stringify({
    v: 1,
    actor: state.actor,
    clock: state.clock,
    map: state.map,
    clocks: state.clocks,
    deleted: state.deleted,
  });
}

export function deserializeCrdt(raw: string, fallbackActor: string): CrdtState | null {
  try {
    const p = JSON.parse(raw) as Partial<CrdtState> & { v?: number };
    if (!p || typeof p !== "object" || !p.map) {
      return null;
    }
    return {
      map: p.map,
      clocks: p.clocks || {},
      deleted: p.deleted || {},
      clock: p.clock || 0,
      actor: p.actor || fallbackActor,
    };
  } catch {
    return null;
  }
}
