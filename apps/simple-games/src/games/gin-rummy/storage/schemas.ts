/**
 * Gin Rummy's own persisted records, under the `gr.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. The hand itself is checked by `decodeHand` (game/serialize.ts),
 * which fails closed on anything play could not have produced — a missing or
 * duplicated card, hand sizes the phase does not allow, a knock over the limit.
 * Nothing here repairs anything.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import { decodeHand, DIFFICULTIES, isDifficulty, MATCH_TARGET, type Difficulty } from '../game';

import { GR_STORAGE_KEYS } from './keys';

export { GR_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * Which opponent the next match is dealt against. It lives here rather than in
 * the shared settings record because it belongs to this game
 * (docs/ARCHITECTURE.md), and it is a preference rather than part of a match:
 * changing it never touches the match in progress, which keeps the difficulty
 * it was started with until it ends.
 */
export interface Prefs {
  schemaVersion: 1;
  difficulty: Difficulty;
}

export const prefsSchema: SchemaDef<Prefs> = {
  key: GR_STORAGE_KEYS.prefs,
  version: 1,
  defaultValue: () => ({ schemaVersion: 1, difficulty: 'normal' }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    return isDifficulty(raw.difficulty) ? { schemaVersion: 1, difficulty: raw.difficulty } : null;
  },
};

// ---------- one-time flags ----------

export interface Flags {
  schemaVersion: 1;
  tutorialCompleted: boolean;
}

export const flagsSchema: SchemaDef<Flags> = {
  key: GR_STORAGE_KEYS.flags,
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
 * A record per opponent, and no streak. Matches abandoned for a new one count
 * as played but never as lost — only matches that actually ended are results,
 * and the only thing to compare them against is the same device's own history.
 *
 * **There is no `draws` field**, unlike the board shelf's four. A Gin match ends
 * when somebody passes a hundred points, and only one seat can be the one that
 * did; a drawn match is not a result this game can produce, so a column of
 * permanent zeroes would be a promise about the rules that is simply untrue.
 */
export interface OpponentStats {
  played: number;
  wins: number;
  losses: number;
}

export type Stats = {
  schemaVersion: 1;
  totalPlaySeconds: number;
} & Record<Difficulty, OpponentStats>;

const emptyOpponent = (): OpponentStats => ({ played: 0, wins: 0, losses: 0 });

const validateOpponent = (raw: unknown): OpponentStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const wins = asInt(raw.wins, 0, 1e9);
  const losses = asInt(raw.losses, 0, 1e9);
  if (played === null || wins === null || losses === null) return null;
  return { played, wins, losses };
};

export const statsSchema: SchemaDef<Stats> = {
  key: GR_STORAGE_KEYS.stats,
  version: 1,
  defaultValue: () => ({
    schemaVersion: 1,
    totalPlaySeconds: 0,
    easy: emptyOpponent(),
    normal: emptyOpponent(),
    hard: emptyOpponent(),
  }),
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const totalPlaySeconds = asInt(raw.totalPlaySeconds, 0, 1e12);
    if (totalPlaySeconds === null) return null;
    const out = { schemaVersion: 1 as const, totalPlaySeconds } as Stats;
    for (const difficulty of DIFFICULTIES) {
      const opponent = validateOpponent(raw[difficulty]);
      if (opponent === null) return null;
      out[difficulty] = opponent;
    }
    return out;
  },
};

// ---------- saved game ----------

/**
 * A generous ceiling on the encoded hand, so a wild payload is refused before
 * it is parsed. The real gate is `decodeHand`. Fifty-two cards are 104 base-36
 * digits, the fields and separators another dozen, and the public log four
 * characters per event — a played-out hand runs to well under a hundred events,
 * so this leaves several times the room a real one needs.
 */
const MAX_HAND_TEXT = 2048;

/**
 * One slot, holding a match mid-play: the hand on the table *and* the match
 * around it — the running score, whose deal it is (inside the hand), and how
 * many hands have been dealt.
 *
 * The hand is one string (game/serialize.ts) rather than a nest of arrays,
 * because the thing that has to be right about it is not its shape but its
 * conservation of fifty-two cards, and that is what the decoder checks.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  difficulty: Difficulty;
  /** The whole hand, encoded (serialize.ts) — piles, phase, and public log. */
  hand: string;
  /** Hands dealt so far, from 1. Half of the deal's seed. */
  handNumber: number;
  /** Match points, [you, cpu]. */
  scores: [number, number];
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const asScores = (raw: unknown): [number, number] | null => {
  if (!Array.isArray(raw) || raw.length !== 2) return null;
  const you = asInt(raw[0], 0, 1e6);
  const cpu = asInt(raw[1], 0, 1e6);
  if (you === null || cpu === null) return null;
  // A match somebody has already won is not a match to come back to: the next
  // one is free and starts fresh. A record claiming both seats are past the
  // target could not have come from play at all — the first one there ends it.
  if (you >= MATCH_TARGET || cpu >= MATCH_TARGET) return null;
  return [you, cpu];
};

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: GR_STORAGE_KEYS.game,
  version: 1,
  defaultValue: () => null,
  validate: (raw) => {
    if (!isRecord(raw) || raw.schemaVersion !== 1) return null;
    const seed = asString(raw.seed);
    const hand = asString(raw.hand, MAX_HAND_TEXT);
    const handNumber = asInt(raw.handNumber, 1, 1e6);
    const scores = asScores(raw.scores);
    const moveCount = asInt(raw.moveCount, 0, 1e9);
    const elapsedSeconds = asInt(raw.elapsedSeconds, 0, 1e9);
    const savedAt = asInt(raw.savedAt, 0, 1e15);

    if (
      seed === null ||
      seed.length === 0 ||
      hand === null ||
      !isDifficulty(raw.difficulty) ||
      handNumber === null ||
      scores === null ||
      moveCount === null ||
      elapsedSeconds === null ||
      savedAt === null
    ) {
      return null;
    }

    // The hand has to survive the decoder before the record counts as one:
    // fifty-two cards, each exactly once, in a position the rules allow.
    if (decodeHand(hand) === null) return null;

    return {
      schemaVersion: 1,
      seed,
      difficulty: raw.difficulty,
      hand,
      handNumber,
      scores,
      moveCount,
      elapsedSeconds,
      savedAt,
    };
  },
};
