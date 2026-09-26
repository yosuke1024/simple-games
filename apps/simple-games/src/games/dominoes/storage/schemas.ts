/**
 * Dominoes's own persisted records, under the `dm.` prefix declared in
 * ./keys. Isolated from the shared records and from every other game:
 * corruption here can never take the shell or another game down
 * (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults (docs/DOMINOES_RULES.md §9). These check the record's shape;
 * whether the position it describes could have come from play is the game's
 * own question (game/serialize.ts `decodePosition`).
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { CPU, MAX_PIP, PASSES_TO_BLOCK, PLAYER, TILE_COUNT, type Side } from '../game';
import type { StoredTile } from '../game';

import { DM_STORAGE_KEYS } from './keys';

export { DM_STORAGE_KEYS };

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: DM_STORAGE_KEYS.flags,
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
 * One record, and no streak (§8). A game abandoned for a new one counts as
 * played but never as lost — only games that actually ended are results.
 */
export interface Stats {
  schemaVersion: 1;
  played: number;
  wins: number;
  losses: number;
  draws: number;
  totalPlaySeconds: number;
}

export const statsSchema: SchemaDef<Stats> = {
  key: DM_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    played: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    totalPlaySeconds: 0,
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const played = asInt(raw.played, 0, 1e9);
    const wins = asInt(raw.wins, 0, 1e9);
    const losses = asInt(raw.losses, 0, 1e9);
    const draws = asInt(raw.draws, 0, 1e9);
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (
      played === null ||
      wins === null ||
      losses === null ||
      draws === null ||
      totalPlaySeconds === null
    ) {
      return null;
    }
    return { schemaVersion: 1, played, wins, losses, draws, totalPlaySeconds };
  },
};

// ---------- saved game ----------

/**
 * One slot, holding a game mid-play (§9). Tiles are stored as their two pips:
 * the line as each tile lies (`[left, right]`), the hands and the boneyard
 * smaller pip first, the boneyard in drawing order. The status is not stored
 * — it follows from the position — and neither is the opening, which the
 * seed deals again.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  line: StoredTile[];
  playerHand: StoredTile[];
  cpuHand: StoredTile[];
  boneyard: StoredTile[];
  toMove: Side;
  /** Passes in a row (§4). */
  passes: number;
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

/** A list of pip pairs, each value 0–6, no longer than the whole set. */
function asTiles(raw: unknown): StoredTile[] | null {
  if (!Array.isArray(raw) || raw.length > TILE_COUNT) return null;
  const out: StoredTile[] = [];
  for (const entry of raw) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const a = asInt(entry[0], 0, MAX_PIP);
    const b = asInt(entry[1], 0, MAX_PIP);
    if (a === null || b === null) return null;
    out.push([a, b]);
  }
  return out;
}

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: DM_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const line = asTiles(raw.line);
    const playerHand = asTiles(raw.playerHand);
    const cpuHand = asTiles(raw.cpuHand);
    const boneyard = asTiles(raw.boneyard);
    const toMove = raw.toMove === PLAYER || raw.toMove === CPU ? raw.toMove : null;
    const passes = asInt(raw.passes, 0, PASSES_TO_BLOCK);
    const moveCount = asInt(raw.moveCount, 1, 1e9);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);

    if (
      seed === null ||
      seed.length === 0 ||
      line === null ||
      playerHand === null ||
      cpuHand === null ||
      boneyard === null ||
      toMove === null ||
      passes === null ||
      moveCount === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    return {
      schemaVersion: 1,
      seed,
      line,
      playerHand,
      cpuHand,
      boneyard,
      toMove,
      passes,
      moveCount,
      elapsedSeconds,
      savedAt,
    };
  },
};
