/**
 * YachtSession — a pure, immutable snapshot of one game in progress: the five
 * dice, which are kept, how many throws this turn has used, and the sheet.
 * The React layer only dispatches into these functions; every rule lives
 * here and in engine.ts (docs/YACHT_RULES.md).
 *
 * The turn, the status and the total are not stored: they are what the sheet
 * says (§2). There is no undo history — the game has no take-back (§5) — and
 * no clock on screen; elapsed seconds are carried for the statistics only.
 */
import { isPossibleScore, scoreFor, sheetTotal } from './engine';
import { createRng } from './rng';
import {
  CATEGORIES,
  CATEGORY_COUNT,
  DICE_COUNT,
  FACES,
  ROLLS_PER_TURN,
  type Category,
  type Dice,
  type Scores,
  type YachtStatus,
} from './types';

export type RollsUsed = 0 | 1 | 2 | 3;

export interface YachtSession {
  readonly seed: string;
  /** Throws made this game, across every turn: half of the next throw's draw (§4). */
  readonly rollIndex: number;
  /**
   * The five faces. Before the first throw of a turn these are the previous
   * turn's dice, which the screen does not show (§7, §9).
   */
  readonly dice: Dice;
  /** Which dice the next throw leaves alone (§2). */
  readonly held: readonly boolean[];
  /** Throws used this turn: 0 before the first, at most 3 (§2). */
  readonly rollsUsed: RollsUsed;
  /** One entry per box, in `CATEGORIES` order (§3). */
  readonly scores: Scores;
  readonly elapsedSeconds: number;
}

/** Boxes filled so far — the turns already played (§2). */
export function turnsPlayed(session: Pick<YachtSession, 'scores'>): number {
  return session.scores.filter((points) => points !== null).length;
}

/** Twelve boxes filled is the end of the game, and the only one (§2). */
export function statusOf(session: Pick<YachtSession, 'scores'>): YachtStatus {
  return turnsPlayed(session) === CATEGORY_COUNT ? 'finished' : 'playing';
}

export function totalOf(session: Pick<YachtSession, 'scores'>): number {
  return sheetTotal(session.scores);
}

/**
 * A token that makes one game's seed its own. There are no levels and no
 * dates to seed from, so every new game gets new dice — while the seed still
 * pins every throw down completely (§4).
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const gameSeed = (token: string): string => `yacht-${token}`;

const noneHeld = (): boolean[] => new Array<boolean>(DICE_COUNT).fill(false);

/** A fresh sheet, before the first throw. */
export function createSession(seed: string = gameSeed(newSeedToken())): YachtSession {
  return {
    seed,
    rollIndex: 0,
    // Never shown: the screen draws no faces until the first throw (§9).
    dice: new Array<number>(DICE_COUNT).fill(1),
    held: noneHeld(),
    rollsUsed: 0,
    scores: new Array<number | null>(CATEGORY_COUNT).fill(null),
    elapsedSeconds: 0,
  };
}

/**
 * The five faces a throw draws (§4): one rng per throw, called five times,
 * always all five — so what each position would show depends on the seed and
 * the throw's number alone, never on which dice happen to be kept.
 */
export function drawFaces(seed: string, rollIndex: number): number[] {
  const rng = createRng(`${seed}:roll:${rollIndex}`);
  return Array.from({ length: DICE_COUNT }, () => Math.floor(rng() * FACES) + 1);
}

/** Whether a throw is possible right now (§2). */
export function canRoll(session: YachtSession): boolean {
  if (statusOf(session) !== 'playing') return false;
  if (session.rollsUsed >= ROLLS_PER_TURN) return false;
  // Nothing left to throw once every die is kept.
  return session.rollsUsed === 0 || session.held.some((kept) => !kept);
}

/**
 * Throws the dice (§2, §4). The first throw of a turn throws all five,
 * whatever `held` says; later throws leave the kept dice alone. Returns null
 * when no throw is possible — the third is used, or every die is kept.
 */
export function roll(session: YachtSession): YachtSession | null {
  if (!canRoll(session)) return null;
  const held = session.rollsUsed === 0 ? noneHeld() : session.held;
  const faces = drawFaces(session.seed, session.rollIndex);
  return {
    ...session,
    dice: session.dice.map((face, i) => (held[i] ? face : faces[i]!)),
    held,
    rollIndex: session.rollIndex + 1,
    rollsUsed: (session.rollsUsed + 1) as RollsUsed,
  };
}

/** Whether keeping a die means anything right now (§2). */
export function canHold(session: YachtSession): boolean {
  // Before the first throw there is nothing to keep; after the third there is
  // no throw left to keep it from.
  return (
    statusOf(session) === 'playing' && session.rollsUsed > 0 && session.rollsUsed < ROLLS_PER_TURN
  );
}

/** Keeps a die, or lets it go (§2). Null when keeping means nothing now. */
export function toggleHold(session: YachtSession, index: number): YachtSession | null {
  if (!canHold(session)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= DICE_COUNT) return null;
  return { ...session, held: session.held.map((kept, i) => (i === index ? !kept : kept)) };
}

/** Whether a box can take the dice now (§2). */
export function canScore(session: YachtSession, category: Category): boolean {
  if (statusOf(session) !== 'playing' || session.rollsUsed === 0) return false;
  return session.scores[CATEGORIES.indexOf(category)] === null;
}

/**
 * Ends the turn in one open box (§2): the dice's points go in, every hold is
 * released, and the next turn starts before its first throw. Null before the
 * first throw, on a box already used, or once the sheet is full.
 */
export function score(session: YachtSession, category: Category): YachtSession | null {
  if (!canScore(session, category)) return null;
  const index = CATEGORIES.indexOf(category);
  const points = scoreFor(category, session.dice);
  return {
    ...session,
    scores: session.scores.map((taken, i) => (i === index ? points : taken)),
    held: noneHeld(),
    rollsUsed: 0,
  };
}

/**
 * Restores a session from persisted data, or null when it could not have come
 * from play (§7). The shape — lengths, types, ranges — is the schema's to
 * check; this is the part only the rules can answer.
 */
export function restoreSession(data: YachtSession): YachtSession | null {
  // Holds exist only after a throw: none can survive into a turn not yet thrown.
  if (data.rollsUsed === 0 && data.held.some((kept) => kept)) return null;
  // Every filled box must hold points some throw could have scored there.
  for (let index = 0; index < CATEGORY_COUNT; index++) {
    const points = data.scores[index];
    if (points === null || points === undefined) continue;
    if (!isPossibleScore(CATEGORIES[index]!, points)) return null;
  }
  // One to three throws per filled box, plus this turn's: anything else could
  // not have been played, and the throw count is half of every draw to come.
  const filled = turnsPlayed(data);
  const least = filled + data.rollsUsed;
  const most = ROLLS_PER_TURN * filled + data.rollsUsed;
  if (data.rollIndex < least || data.rollIndex > most) return null;
  return data;
}
