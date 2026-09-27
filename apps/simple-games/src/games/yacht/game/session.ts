/**
 * YachtSession — a pure, immutable snapshot of one match in progress: the
 * five dice on the table, which are kept, how many throws this turn has
 * used, and the two sheets — yours and the CPU's. The React layer only
 * dispatches into these functions; every rule lives here, in engine.ts and in
 * cpu.ts (docs/YACHT_RULES.md).
 *
 * The turn, the status and the totals are not stored: they are what the two
 * sheets say (§2). There is no undo history — the game has no take-back
 * (§6) — and no clock on screen; elapsed seconds are carried for the
 * statistics only.
 *
 * The dice, the holds and the throw count belong to whoever is at the table
 * right now (`toMove`), not to a seat — the player and the CPU take turns at
 * the one set of dice, exactly as they would sitting across a real table
 * (§1).
 */
import { chooseCpuAction, type CpuInput } from './cpu';
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
  type Outcome,
  type Scores,
  type Seat,
  type YachtStatus,
} from './types';

export type RollsUsed = 0 | 1 | 2 | 3;

export interface YachtSession {
  readonly seed: string;
  /** Throws made this game, by both seats together: half of the next throw's draw (§4). */
  readonly rollIndex: number;
  /**
   * The five faces on the table — whoever's turn it is. Before the first
   * throw of a turn these are the previous turn's dice, which the screen
   * does not show (§8, §10).
   */
  readonly dice: Dice;
  /** Which dice the next throw leaves alone (§2). */
  readonly held: readonly boolean[];
  /** Throws used this turn: 0 before the first, at most 3 (§2). */
  readonly rollsUsed: RollsUsed;
  /** The player's sheet: one entry per box, in `CATEGORIES` order (§3). */
  readonly scores: Scores;
  /** The CPU's sheet, same shape and order (§3, §5). */
  readonly cpuScores: Scores;
  readonly elapsedSeconds: number;
}

/** Boxes filled on one sheet — that seat's turns already played (§2). */
export function filledCount(scores: Scores): number {
  return scores.filter((points) => points !== null).length;
}

/** The player's turns played (§2). The screen's "turn n / 12" is this plus one. */
export function turnsPlayed(session: Pick<YachtSession, 'scores'>): number {
  return filledCount(session.scores);
}

/**
 * Whose turn it is (§1, §2), derived from the two sheets: the player always
 * throws first and the seats alternate one box each, so the player leads by
 * exactly zero or one filled box at every point in the match.
 */
export function toMove(session: Pick<YachtSession, 'scores' | 'cpuScores'>): Seat {
  return filledCount(session.scores) > filledCount(session.cpuScores) ? 'cpu' : 'player';
}

/** The sheet belonging to one seat (§3). */
export function sheetOf(session: Pick<YachtSession, 'scores' | 'cpuScores'>, seat: Seat): Scores {
  return seat === 'player' ? session.scores : session.cpuScores;
}

/** Both sheets full is the end of the match, and the only one (§2). */
export function statusOf(session: Pick<YachtSession, 'cpuScores'>): YachtStatus {
  return filledCount(session.cpuScores) === CATEGORY_COUNT ? 'finished' : 'playing';
}

/** The player's total (§3, §7). */
export function totalOf(session: Pick<YachtSession, 'scores'>): number {
  return sheetTotal(session.scores);
}

/** The CPU's total (§3, §7). */
export function cpuTotalOf(session: Pick<YachtSession, 'cpuScores'>): number {
  return sheetTotal(session.cpuScores);
}

/**
 * How the match reads from the player's side, once it is over — null while
 * still playing (§1, §7).
 */
export function outcomeOf(session: Pick<YachtSession, 'scores' | 'cpuScores'>): Outcome | null {
  if (statusOf(session) !== 'finished') return null;
  const player = totalOf(session);
  const cpu = cpuTotalOf(session);
  return player > cpu ? 'won' : player < cpu ? 'lost' : 'draw';
}

/**
 * A token that makes one match's seed its own. There are no levels and no
 * dates to seed from, so every new match gets new dice — while the seed
 * still pins every throw, and the CPU's every reply, down completely (§4,
 * §5).
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const gameSeed = (token: string): string => `yacht-${token}`;

const noneHeld = (): boolean[] => new Array<boolean>(DICE_COUNT).fill(false);
const emptySheet = (): (number | null)[] => new Array<number | null>(CATEGORY_COUNT).fill(null);

/** A fresh match, before the player's first throw. Both sheets are empty (§1). */
export function createSession(seed: string = gameSeed(newSeedToken())): YachtSession {
  return {
    seed,
    rollIndex: 0,
    // Never shown: the screen draws no faces until the first throw (§10).
    dice: new Array<number>(DICE_COUNT).fill(1),
    held: noneHeld(),
    rollsUsed: 0,
    scores: emptySheet(),
    cpuScores: emptySheet(),
    elapsedSeconds: 0,
  };
}

/**
 * The five faces a throw draws (§4): one rng per throw, called five times,
 * always all five — so what each position would show depends on the seed and
 * the throw's number alone, never on which dice happen to be kept, and never
 * on which seat is throwing.
 */
export function drawFaces(seed: string, rollIndex: number): number[] {
  const rng = createRng(`${seed}:roll:${rollIndex}`);
  return Array.from({ length: DICE_COUNT }, () => Math.floor(rng() * FACES) + 1);
}

/** Whether `seat` can throw right now (§1, §2): only on that seat's own turn. */
export function canRoll(session: YachtSession, seat: Seat): boolean {
  if (statusOf(session) !== 'playing') return false;
  if (toMove(session) !== seat) return false;
  if (session.rollsUsed >= ROLLS_PER_TURN) return false;
  // Nothing left to throw once every die is kept.
  return session.rollsUsed === 0 || session.held.some((kept) => !kept);
}

/**
 * `seat` throws the dice (§2, §4). The first throw of a turn throws all
 * five, whatever `held` says; later throws leave the kept dice alone. Null
 * when it is not `seat`'s turn, the third throw is used, or every die is
 * kept.
 */
export function roll(session: YachtSession, seat: Seat): YachtSession | null {
  if (!canRoll(session, seat)) return null;
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

/** Whether keeping a die means anything right now, for `seat` (§1, §2). */
export function canHold(session: YachtSession, seat: Seat): boolean {
  // Before the first throw there is nothing to keep; after the third there is
  // no throw left to keep it from; and only the seat to move may touch a die.
  return (
    statusOf(session) === 'playing' &&
    toMove(session) === seat &&
    session.rollsUsed > 0 &&
    session.rollsUsed < ROLLS_PER_TURN
  );
}

/** `seat` keeps a die, or lets it go (§2). Null when keeping means nothing now. */
export function toggleHold(session: YachtSession, seat: Seat, index: number): YachtSession | null {
  if (!canHold(session, seat)) return null;
  if (!Number.isInteger(index) || index < 0 || index >= DICE_COUNT) return null;
  return { ...session, held: session.held.map((kept, i) => (i === index ? !kept : kept)) };
}

/**
 * `seat` sets its whole keep in one step (§5) — the CPU's turn, not the
 * player's tap-one-at-a-time gesture. Null when keeping means nothing now, or
 * `held` is not exactly five flags.
 */
export function setHolds(
  session: YachtSession,
  seat: Seat,
  held: readonly boolean[],
): YachtSession | null {
  if (!canHold(session, seat)) return null;
  if (held.length !== DICE_COUNT || held.some((kept) => typeof kept !== 'boolean')) return null;
  return { ...session, held: [...held] };
}

/** Whether `seat` can take the dice in `category` now (§2). */
export function canScore(session: YachtSession, seat: Seat, category: Category): boolean {
  if (statusOf(session) !== 'playing') return false;
  if (toMove(session) !== seat) return false;
  if (session.rollsUsed === 0) return false;
  return sheetOf(session, seat)[CATEGORIES.indexOf(category)] === null;
}

/**
 * Ends `seat`'s turn in one open box on its own sheet (§2): the dice's
 * points go in, every hold is released, and the next turn — the other
 * seat's, unless this was the CPU's twelfth — starts before its first
 * throw. Null when `seat` cannot take that box now, or it is already used.
 */
export function score(session: YachtSession, seat: Seat, category: Category): YachtSession | null {
  if (!canScore(session, seat, category)) return null;
  const index = CATEGORIES.indexOf(category);
  const points = scoreFor(category, session.dice);
  const key = seat === 'player' ? 'scores' : 'cpuScores';
  return {
    ...session,
    [key]: session[key].map((taken, i) => (i === index ? points : taken)),
    held: noneHeld(),
    rollsUsed: 0,
  };
}

/**
 * The CPU takes one step of its turn (§5): a throw, setting its whole keep,
 * or taking a box — one call, one step, so a CPU turn plays out visibly over
 * several beats rather than landing all at once. Null unless the match is
 * playing and it is the CPU's turn.
 */
export function applyCpuStep(session: YachtSession): YachtSession | null {
  if (statusOf(session) !== 'playing' || toMove(session) !== 'cpu') return null;
  const input: CpuInput = {
    dice: session.dice,
    held: session.held,
    rollsUsed: session.rollsUsed,
    cpuScores: session.cpuScores,
  };
  const action = chooseCpuAction(input);
  switch (action.kind) {
    case 'roll':
      return roll(session, 'cpu');
    case 'hold':
      return setHolds(session, 'cpu', action.held);
    case 'score':
      return score(session, 'cpu', action.category);
  }
}

/**
 * Restores a session from persisted data, or null when it could not have come
 * from play (§8). The shape — lengths, types, ranges — is the schema's to
 * check; this is the part only the rules can answer.
 */
export function restoreSession(data: YachtSession): YachtSession | null {
  // Holds exist only after a throw: none can survive into a turn not yet thrown.
  if (data.rollsUsed === 0 && data.held.some((kept) => kept)) return null;
  // Every filled box, on either sheet, must hold points some throw could have
  // scored there.
  for (let index = 0; index < CATEGORY_COUNT; index++) {
    for (const sheet of [data.scores, data.cpuScores]) {
      const points = sheet[index];
      if (points === null || points === undefined) continue;
      if (!isPossibleScore(CATEGORIES[index]!, points)) return null;
    }
  }
  // The player throws first and the seats alternate one box each, so the
  // player's sheet is either level with the CPU's or exactly one box ahead —
  // anything else is not a match play could have reached.
  const playerFilled = filledCount(data.scores);
  const cpuFilled = filledCount(data.cpuScores);
  if (playerFilled !== cpuFilled && playerFilled !== cpuFilled + 1) return null;
  // One to three throws per filled box (either seat's), plus this turn's:
  // anything else could not have been played, and the throw count is half of
  // every draw to come.
  const filled = playerFilled + cpuFilled;
  const least = filled + data.rollsUsed;
  const most = ROLLS_PER_TURN * filled + data.rollsUsed;
  if (data.rollIndex < least || data.rollIndex > most) return null;
  return data;
}
