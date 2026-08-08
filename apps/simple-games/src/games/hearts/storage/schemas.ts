/**
 * Hearts' own persisted records, under the `ht.` prefix. Isolated from the
 * shared records and from every other game: corruption here can never take the
 * shell or another game down (docs/ARCHITECTURE.md).
 *
 * Validators never throw: corrupt data yields null and callers fall back to
 * safe defaults. The hand itself is checked by `decodeHand` (game/serialize.ts),
 * which fails closed on anything play could not have produced — a missing or
 * duplicated card, a pass that does not fit its phase, a trick somebody could
 * not legally have played. Nothing here repairs anything.
 */
import type { SchemaDef } from '../../../storage/schemas';
import { asBool, asInt, asString, isRecord } from '../../../storage/validate';
import {
  decodeHand,
  DIFFICULTIES,
  isDifficulty,
  MATCH_TARGET,
  SEAT_COUNT,
  SEATS,
  type Difficulty,
} from '../game';

import { HT_STORAGE_KEYS } from './keys';

export { HT_STORAGE_KEYS };

// ---------- game-specific preferences ----------

/**
 * How strong the three opponents are next time. It lives here rather than in
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
  key: HT_STORAGE_KEYS.prefs,
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
  key: HT_STORAGE_KEYS.flags,
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
 * A record per opponent strength, and no streak. Matches abandoned for a new
 * one count as played but never as lost — only matches that actually ended are
 * results, and the only thing to compare them against is the same device's own
 * history.
 *
 * **There is a `draws` column here**, unlike Gin Rummy's. Hearts is won by
 * holding the fewest points at four seats, and four seats make a tie for lowest
 * ordinary rather than exotic; a match the player shares the lowest score in is
 * a real outcome the rules produce (game/session.ts `statusOf`), so it gets a
 * column of its own rather than being rounded into a win or a loss.
 */
export interface OpponentStats {
  played: number;
  wins: number;
  losses: number;
  draws: number;
}

export type Stats = {
  schemaVersion: 1;
  totalPlaySeconds: number;
} & Record<Difficulty, OpponentStats>;

const emptyOpponent = (): OpponentStats => ({ played: 0, wins: 0, losses: 0, draws: 0 });

const validateOpponent = (raw: unknown): OpponentStats | null => {
  if (!isRecord(raw)) return null;
  const played = asInt(raw.played, 0, 1e9);
  const wins = asInt(raw.wins, 0, 1e9);
  const losses = asInt(raw.losses, 0, 1e9);
  const draws = asInt(raw.draws, 0, 1e9);
  if (played === null || wins === null || losses === null || draws === null) return null;
  return { played, wins, losses, draws };
};

export const statsSchema: SchemaDef<Stats> = {
  key: HT_STORAGE_KEYS.stats,
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
 * it is parsed. The real gate is `decodeHand`. The longest a real hand can run
 * is around a hundred and sixty characters — fifty-two cards at two base-36
 * digits, up to twelve of them written a second time as pass selections,
 * thirteen trick leaders, the flags and eleven separators — so this leaves
 * three times the room one needs.
 */
const MAX_HAND_TEXT = 512;

/**
 * One slot, holding a match mid-play: the hand on the table *and* the match
 * around it — the four running scores and how many hands have been dealt.
 *
 * The hand is one string (game/serialize.ts) rather than a nest of arrays,
 * because the thing that has to be right about it is not its shape but its
 * conservation of fifty-two cards and the legality of every card already
 * played, and that is what the decoder checks by replaying them.
 *
 * Neither the match status nor the last hand's result is stored: both are
 * functions of the scores and the hand, and `restoreSession` recomputes them
 * rather than trusting a record that could disagree with itself.
 */
export interface PersistedGame {
  schemaVersion: 1;
  seed: string;
  difficulty: Difficulty;
  /** The whole hand, encoded (serialize.ts) — cards, pass, and every trick. */
  hand: string;
  /** Hands dealt so far, from 1. Half of the deal's seed, and the pass cycle. */
  handNumber: number;
  /** Match points, indexed by seat. */
  scores: [number, number, number, number];
  moveCount: number;
  elapsedSeconds: number;
  savedAt: number;
}

const asScores = (raw: unknown): [number, number, number, number] | null => {
  if (!Array.isArray(raw) || raw.length !== SEAT_COUNT) return null;
  const scores = SEATS.map((seat) => asInt(raw[seat], 0, 1e6));
  if (scores.some((score) => score === null)) return null;
  // A match somebody has already won is not a match to come back to: the next
  // one is free and starts fresh. A hand is only scored when it ends, so a seat
  // at or past the target means the match ended with it.
  if (scores.some((score) => score! >= MATCH_TARGET)) return null;
  return [scores[0]!, scores[1]!, scores[2]!, scores[3]!];
};

export const gameSchema: SchemaDef<PersistedGame | null> = {
  key: HT_STORAGE_KEYS.game,
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
    // fifty-two cards, each exactly once, and every card already played run
    // back through the rules that allowed it.
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
