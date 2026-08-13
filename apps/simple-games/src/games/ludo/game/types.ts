/**
 * Core Ludo types: the four seats, the geometry of the board, and one
 * match's state.
 *
 * The rules these shapes serve are the Ludo section of
 * docs/plans/2026-08-08-mahjong-bubble-ludo.md §2 — docs/LUDO_RULES.md, once
 * a later PR writes it, becomes the source of truth in its place and this
 * file follows it exactly the same way.
 *
 * Two things are deliberate. First, **a pawn's entire position is one
 * number**: `progress` folds "still in the yard", "somewhere on the shared
 * fifty-two-square ring", "in this seat's own home column", and "home" into
 * a single 0..59 scale, and `globalSquareOf` is the one place that turns the
 * ring portion of it into a board coordinate. Every rule in engine.ts —
 * exact-count homing, which squares are safe, whether a landing can capture
 * — reads off `progress` and nothing else. Second, **`isCapturableAt` is
 * written as a rule, not a lookup table**: it names the three reasons a
 * square can be immune (not on the ring at all, or a safe square) rather
 * than enumerating safe squares twice. The CPU's hard difficulty will read
 * this same predicate for its capture-risk estimate (design doc §E), so it
 * has to be the one place that rule lives.
 */

/**
 * Four seats round a board, clockwise from the player: 0 is you at the
 * bottom, 1 on your left, 2 across, 3 on your right. Turns go 0 → 1 → 2 → 3
 * → 0. Identical to Hearts' seating (src/games/hearts/game/types.ts).
 */
export const YOU = 0;
export type Seat = 0 | 1 | 2 | 3;
export const SEAT_COUNT = 4;
export const SEATS: readonly Seat[] = [0, 1, 2, 3];

export const isSeat = (value: unknown): value is Seat =>
  value === 0 || value === 1 || value === 2 || value === 3;

/** The three seats the CPU takes. All of them play at the chosen strength. */
export const isCpuSeat = (seat: Seat): boolean => seat !== YOU;

export type Difficulty = 'easy' | 'normal' | 'hard';
export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];

export const isDifficulty = (value: unknown): value is Difficulty =>
  value === 'easy' || value === 'normal' || value === 'hard';

/** Four of anything, indexed by seat. */
export type BySeat<T> = readonly [T, T, T, T];

/** Builds one value per seat, in seat order. Four fresh values, never shared. */
export const bySeat = <T>(make: (seat: Seat) => T): BySeat<T> => [
  make(0),
  make(1),
  make(2),
  make(3),
];

// ---------------------------------------------------------------------------
// Board geometry
// ---------------------------------------------------------------------------

/** The shared track every seat's pawns cross, however much of it they use. */
export const RING_SIZE = 52;

/** How far apart, in ring squares, each seat's entrance sits from the last. */
export const SEAT_START_STRIDE = 13;

/** Squares in a home column, between leaving the ring and reaching home. */
export const HOME_COLUMN_LENGTH = 6;

/** Four pawns to a seat, the whole game through. */
export const PAWNS_PER_SEAT = 4;

/**
 * `progress` is the whole of a pawn's position, relative to its own seat:
 *
 * | value    | meaning                                                        |
 * | -------- | --------------------------------------------------------------- |
 * | `0`      | the yard — not yet out                                          |
 * | `1..52`  | on the ring; global square = `(seat * 13 + progress - 1) % 52`  |
 * | `53..58` | this seat's own home column, first square to last               |
 * | `59`     | home — finished                                                 |
 *
 * `52` is one square short of this seat's own entrance square — the last
 * ring square before a pawn turns off into its home column.
 */
export const HOME_PROGRESS = 52 + HOME_COLUMN_LENGTH + 1;

/**
 * The ring square a pawn at `progress` occupies, or null when `progress`
 * places it somewhere that is not part of the shared ring — the yard, a
 * home column, or home. Only the ring is shared between seats; nothing else
 * needs a global coordinate.
 */
export function globalSquareOf(seat: Seat, progress: number): number | null {
  if (progress < 1 || progress > RING_SIZE) return null;
  return (seat * SEAT_START_STRIDE + progress - 1) % RING_SIZE;
}

/**
 * The eight squares nothing can be captured on: each seat's entrance square
 * (where a pawn first lands leaving the yard) and, eight squares further
 * round from each of those, a star square. Derived from `SEAT_START_STRIDE`
 * rather than written out, so the one number the board's geometry actually
 * depends on stays the only place it is spelled out.
 */
export const SAFE_SQUARES: readonly number[] = SEATS.flatMap((seat) => [
  seat * SEAT_START_STRIDE,
  (seat * SEAT_START_STRIDE + 8) % RING_SIZE,
]).sort((a, b) => a - b);

export const isSafeSquare = (square: number): boolean => SAFE_SQUARES.includes(square);

/**
 * Whether a capture can happen at all to a pawn sitting at `progress` for
 * `seat` — the rule hard difficulty's risk estimate leans on (design doc
 * §E), so it is written here once as a predicate rather than as a list of
 * squares repeated wherever the question comes up.
 *
 * Four regions are immune, for two different reasons:
 *
 *   - The yard, this seat's own home column, and home hold only this seat's
 *     own pawns (§2.5) — there is no enemy there to send back, so the
 *     question of capture does not arise. `globalSquareOf` returning null is
 *     exactly this case.
 *   - A safe square is immune by rule (§2.3), regardless of who is on it.
 *
 * Everywhere else on the shared ring, a capture can happen.
 */
export function isCapturableAt(seat: Seat, progress: number): boolean {
  const square = globalSquareOf(seat, progress);
  if (square === null) return false;
  return !isSafeSquare(square);
}

// ---------------------------------------------------------------------------
// Match state
// ---------------------------------------------------------------------------

/** How a match ends: one seat's four pawns all home, or the roll cap (§2.9). */
export type MatchResult =
  { readonly kind: 'win'; readonly winner: Seat } | { readonly kind: 'noContest' };

/**
 * One match, as far as it has gone.
 *
 * Invariant held by every function in engine.ts that produces a
 * `MatchState`, though nothing in this type enforces it by construction:
 * **whenever `die` is not null, the seat on turn has at least one legal
 * move.** `rollDie` resolves the two cases that would break this — an
 * automatic pass, and a turn forfeited on a third six — before it ever
 * returns a state with `die` set, so a state awaiting a move with no legal
 * one to make is not a state this module produces. `isValidMatchState`
 * below does not check this itself; see its own comment for why.
 */
export interface MatchState {
  /** Each pawn's progress, indexed by seat and then by pawn (0..3). */
  readonly pawns: BySeat<readonly [number, number, number, number]>;
  readonly turn: Seat;
  /** Rolls completed so far. Also the dice and CPU tie-break key for the next one. */
  readonly rollIndex: number;
  /** Sixes the seat on turn has rolled in a row. Resets whenever turn changes seat. */
  readonly sixStreak: number;
  /** null before this roll is made; 1..6 once rolled, while a legal move stands. */
  readonly die: number | null;
  /** The match's outcome, or null while it continues. */
  readonly result: MatchResult | null;
}

/** Moving one pawn from where it sits to where a roll would take it. */
export interface Move {
  readonly pawn: 0 | 1 | 2 | 3;
  readonly from: number;
  readonly to: number;
}

/**
 * A shape check for a `MatchState` that might have come from outside this
 * module — every `progress` in range, the small counters in range, at most
 * one seat already fully home.
 *
 * This is **not** a proof the state is reachable by play. It does not
 * replay rolls, recompute legal moves, or check the `die` invariant
 * documented on `MatchState` above (doing so would need `legalMovesFor`,
 * which lives in engine.ts and would make this a circular dependency for a
 * check that reachability testing subsumes anyway). Reachability is what
 * replaying a saved match's roll and choice history proves, and that is the
 * job of the module that owns saved games, not this one.
 */
export function isValidMatchState(state: MatchState): boolean {
  if (!isSeat(state.turn)) return false;
  if (!Number.isInteger(state.rollIndex) || state.rollIndex < 0) return false;
  if (!Number.isInteger(state.sixStreak) || state.sixStreak < 0 || state.sixStreak > 2)
    return false;
  if (state.die !== null) {
    if (!Number.isInteger(state.die) || state.die < 1 || state.die > 6) return false;
  }
  if (!Array.isArray(state.pawns) || state.pawns.length !== SEAT_COUNT) return false;

  let seatsHome = 0;
  for (const seat of SEATS) {
    const pawns = state.pawns[seat];
    if (!Array.isArray(pawns) || pawns.length !== PAWNS_PER_SEAT) return false;
    let allHome = true;
    for (const progress of pawns) {
      if (!Number.isInteger(progress) || progress < 0 || progress > HOME_PROGRESS) return false;
      if (progress !== HOME_PROGRESS) allHome = false;
    }
    if (allHome) seatsHome += 1;
  }
  // A match ends the instant a seat gets all four pawns home (§2.8), so a
  // second seat also sitting fully home is a position play never reaches.
  if (seatsHome > 1) return false;

  if (state.result === null) return true;
  if (state.result.kind === 'noContest') return true;
  return isSeat(state.result.winner);
}
