/**
 * MahjongSession — a pure, immutable snapshot of one board: the layout, the
 * generated faces, and the ordered list of removed pairs. Everything else is
 * derived: the remaining set, freeness, stuck-ness, the win.
 *
 * The removal history doubles as the undo stack (§8) and as the persisted
 * form (§10): undo pops the last pair, and a save is the identity plus this
 * same list. One list, three jobs — which is what keeps them from drifting.
 *
 * Elapsed seconds are carried for the result screen and the statistics only —
 * never shown while the game is running (§9).
 */
import { dailySeed } from './daily';
import { freeTiles } from './freeState';
import { generateBoard } from './generator';
import { clampLevel, levelSeed, paramsFor, type Layout } from './layouts';
import { facesMatch, type GameMode, type GameStatus, type TileFace } from './types';

export interface MahjongSession {
  readonly mode: GameMode;
  /** 1..100 for level mode, null for daily. */
  readonly level: number | null;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  readonly layout: Layout;
  readonly faces: readonly TileFace[];
  /** Removed pairs of tile indices, oldest first. The undo stack and the save. */
  readonly removed: ReadonlyArray<readonly [number, number]>;
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
  readonly hintCount: number;
}

/** The canonical seed of a session's identity (§10 — derived, never stored). */
export function seedFor(mode: GameMode, level: number | null, dailyDate: string | null): string {
  return mode === 'daily' ? dailySeed(dailyDate ?? '') : levelSeed(level ?? 1);
}

function buildSession(
  mode: GameMode,
  level: number | null,
  dailyDate: string | null,
  removed: ReadonlyArray<readonly [number, number]>,
  elapsedSeconds: number,
  hintCount: number,
): MahjongSession {
  const board = generateBoard(paramsFor(mode, level), seedFor(mode, level, dailyDate));
  const status: GameStatus = removed.length * 2 === board.layout.tiles.length ? 'won' : 'playing';
  return {
    mode,
    level,
    dailyDate,
    layout: board.layout,
    faces: board.faces,
    removed,
    status,
    elapsedSeconds,
    hintCount,
  };
}

/** A fresh (or restarted) level game — deterministic per level (§5, §6). */
export function createLevelSession(level: number): MahjongSession {
  return buildSession('level', clampLevel(level), null, [], 0, 0);
}

/** A fresh (or restarted) daily game for a local YYYY-MM-DD date (§6). */
export function createDailySession(dateString: string): MahjongSession {
  return buildSession('daily', null, dateString, [], 0, 0);
}

/** The same board again (§7): identity is the only truth, so nothing to keep. */
export function restartSession(session: MahjongSession): MahjongSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/**
 * Restores a session from validated persisted parts. The board is rebuilt
 * from the identity; the caller (storage/gamePersistence.ts) has already
 * replayed `removed` against it, so this only reassembles.
 */
export function restoreSession(data: {
  mode: GameMode;
  level: number | null;
  dailyDate: string | null;
  removed: ReadonlyArray<readonly [number, number]>;
  elapsedSeconds: number;
  hintCount: number;
}): MahjongSession {
  return buildSession(
    data.mode,
    data.level,
    data.dailyDate,
    data.removed,
    data.elapsedSeconds,
    data.hintCount,
  );
}

/** The remaining set, derived from the removal history. */
export function removedFlags(session: MahjongSession): boolean[] {
  const flags = new Array<boolean>(session.layout.tiles.length).fill(false);
  for (const [a, b] of session.removed) {
    flags[a] = true;
    flags[b] = true;
  }
  return flags;
}

export function remainingCount(session: MahjongSession): number {
  return session.layout.tiles.length - session.removed.length * 2;
}

/** Indices a player may take right now (§2). */
export function currentFreeTiles(session: MahjongSession): number[] {
  return freeTiles(session.layout, removedFlags(session));
}

/**
 * Takes a matching pair of free tiles (§2). Returns null when the move is
 * not legal — the caller treats that as "selection moves", never as an error
 * to scold (§3).
 */
export function removePair(session: MahjongSession, a: number, b: number): MahjongSession | null {
  if (session.status !== 'playing' || a === b) return null;
  const tileCount = session.layout.tiles.length;
  if (a < 0 || b < 0 || a >= tileCount || b >= tileCount) return null;
  const flags = removedFlags(session);
  if (flags[a] || flags[b]) return null;
  const free = new Set(currentFreeTiles(session));
  if (!free.has(a) || !free.has(b)) return null;
  if (!facesMatch(session.faces[a]!, session.faces[b]!)) return null;
  const removed = [...session.removed, [a, b] as const];
  return {
    ...session,
    removed,
    status: removed.length * 2 === tileCount ? 'won' : 'playing',
  };
}

/**
 * Undo — free and unlimited (§8). Taking back a pair after seeing what was
 * underneath is the same side as Klondike taking back a flip: the reveal is
 * the help this game offers. Works from a stuck position too, which is what
 * makes stuck a notice rather than an ending (§7).
 */
export function undoRemoval(session: MahjongSession): MahjongSession | null {
  if (session.removed.length === 0) return null;
  return {
    ...session,
    removed: session.removed.slice(0, -1),
    status: 'playing',
  };
}

/** A free matching pair, or null. The order is stable, so hints do not dance. */
export function findMatchingPair(session: MahjongSession): [number, number] | null {
  const free = currentFreeTiles(session);
  for (let i = 0; i < free.length; i++) {
    for (let j = i + 1; j < free.length; j++) {
      if (facesMatch(session.faces[free[i]!]!, session.faces[free[j]!]!)) {
        return [free[i]!, free[j]!];
      }
    }
  }
  return null;
}

/**
 * Stuck (§7): no free matching pair while tiles remain. Derived, never
 * stored — the same board answers the same way after a restore.
 */
export function isStuck(session: MahjongSession): boolean {
  return session.status === 'playing' && findMatchingPair(session) === null;
}

/** Hints are counted for the result screen, never limited or charged for. */
export function countHintUse(session: MahjongSession): MahjongSession {
  return { ...session, hintCount: session.hintCount + 1 };
}
