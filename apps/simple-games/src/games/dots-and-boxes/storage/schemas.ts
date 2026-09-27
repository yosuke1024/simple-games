/**
 * Dots and Boxes's own persisted records, under the `db.` prefix. Isolated
 * from the shared records and from every other game: corruption here can
 * never take the shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/DOTS_AND_BOXES_RULES.md §8).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  BOARD_SIZES,
  BOXES_FOR,
  boxCount,
  CPU,
  edgeCount,
  isBoardSize,
  PLAYER,
  type BoardSize,
  type Side,
} from '../game';

import { DB_STORAGE_KEYS } from './keys';

export { DB_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * The board last picked (§1), and which side the player takes next time
 * (§1). Not a setting — nothing here changes how a match in progress plays;
 * `size` only saves choosing the board again, and `playerGoesFirst` never
 * touches a match once it has started, which keeps the side it was started
 * with until it ends.
 */
export interface Prefs {
  schemaVersion: 2;
  size: BoardSize;
  playerGoesFirst: boolean;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: DB_STORAGE_KEYS.prefs,
  version: 2,
  defaultValue: () => ({ schemaVersion: 2, size: 'small', playerGoesFirst: true }),
  validate: (raw) => {
    if (!isRecord(raw)) return null;

    // v1 → v2: the side choice (§1) did not exist yet, so every v1 record
    // played the player first.
    if (raw.schemaVersion === 1) {
      return isBoardSize(raw.size)
        ? { schemaVersion: 2, size: raw.size, playerGoesFirst: true }
        : null;
    }

    if (raw.schemaVersion !== 2) return null;
    if (!isBoardSize(raw.size)) return null;
    const playerGoesFirst = asBool(raw.playerGoesFirst);
    return playerGoesFirst === null ? null : { schemaVersion: 2, size: raw.size, playerGoesFirst };
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: DB_STORAGE_KEYS.flags,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, tutorialCompleted: false }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const tutorialCompleted = asBool(raw.tutorialCompleted);
    return tutorialCompleted === null ? null : { schemaVersion: 1, tutorialCompleted };
  },
};

// ---------- statistics ----------

/**
 * A record per board size, and no streak (§7). Matches abandoned for a new
 * one count as played but never as lost — only matches that actually ended
 * are results.
 */
export interface SizeStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export type Stats = {
  schemaVersion: 1;
  totalPlaySeconds: number;
} & Record<BoardSize, SizeStats>;

const emptySize = (): SizeStats => ({ played: 0, wins: 0, losses: 0, draws: 0 });

const validateSize = (raw: unknown): SizeStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const wins = asInt(raw.wins, 0, 1e9);
  const losses = asInt(raw.losses, 0, 1e9);
  const draws = asInt(raw.draws, 0, 1e9);
  if (played === null || wins === null || losses === null || draws === null) return null;
  return { played, wins, losses, draws };
};

export const statsSchema: SchemaDef<Stats> = {
  key: DB_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    totalPlaySeconds: 0,
    small: emptySize(),
    medium: emptySize(),
    large: emptySize(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (totalPlaySeconds === null) return null;
    const out = { schemaVersion: 1 as const, totalPlaySeconds } as Stats;
    for (const size of BOARD_SIZES) {
      const record = validateSize(raw[size]);
      if (record === null) return null;
      out[size] = record;
    }
    return out;
  },
};

// ---------- saved game ----------

/**
 * One slot, holding a match mid-play (§8). The turn is stored, not derived:
 * closing a box keeps the move (§2), so the board cannot say whose line is
 * next. The undo history is not part of it.
 *
 * This validator checks shapes; whether the two board strings could have
 * come from play is checked one layer out, by `decodeBoard` and the move
 * count in gamePersistence (§8) — the rules have one implementation, in the
 * game.
 */
export interface PersistedGame {
  schemaVersion: 2;
  size: BoardSize;
  seed: string;
  /** Who opened this match (§1). */
  first: Side;
  /** One character per edge (§1). */
  edges: string;
  /** One character per box (§1). */
  boxes: string;
  toMove: Side;
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const asSide = (raw: unknown): Side | null => (raw === PLAYER || raw === CPU ? raw : null);

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: DB_STORAGE_KEYS.game,
  version: 2,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw)) return null;
    if (raw.schemaVersion !== 1 && raw.schemaVersion !== 2) return null;
    if (!isBoardSize(raw.size)) return null;
    const n = BOXES_FOR[raw.size];
    const seed = asString(raw.seed);
    const edges = asString(raw.edges, edgeCount(n));
    const boxes = asString(raw.boxes, boxCount(n));
    const moveCount = asInt(raw.moveCount, 0, edgeCount(n));
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);
    const toMove = asSide(raw.toMove);
    // v1 saves predate the side choice (§1); every one of them was a match
    // the player opened.
    const first = raw.schemaVersion === 1 ? PLAYER : asSide(raw.first);

    if (
      seed === null ||
      seed.length === 0 ||
      edges === null ||
      boxes === null ||
      toMove === null ||
      first === null ||
      moveCount === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    return {
      schemaVersion: 2,
      size: raw.size,
      seed,
      first,
      edges,
      boxes,
      toMove,
      moveCount,
      elapsedSeconds,
      savedAt,
    };
  },
};
