/**
 * One match of Ludo: legal moves, rolling the die to a full stop, and what
 * a move does to the board.
 *
 * Pure and immutable, like the board games' engines — every function here
 * returns a new `MatchState`, or null when the rules do not allow what was
 * asked. Nothing here knows about seats being human or CPU, about time, or
 * about storage; a match is a match. The rules are the Ludo section of
 * docs/plans/2026-08-08-mahjong-bubble-ludo.md §2 (docs/LUDO_RULES.md, once
 * written, replaces it as the source of truth).
 *
 * `rollDie` is the one function that resolves more than it is asked for: a
 * single call carries a roll all the way to either a state with a die
 * waiting on a move, or a state that has already moved on — because an
 * automatic pass and a forfeited third six are not choices anybody makes,
 * they are what the rules say happens next. That is also why neither one
 * shows up as a `Move`: there is nothing to choose. It refuses to roll at
 * all — returning null instead — for a match that is already over or that
 * is still waiting on a move from the roll before this one.
 */
import { rollFor } from './dice';
import {
  bySeat,
  globalSquareOf,
  isCapturableAt,
  HOME_PROGRESS,
  PAWNS_PER_SEAT,
  SEAT_COUNT,
  YOU,
  type BySeat,
  type MatchState,
  type Move,
  type Seat,
} from './types';

/**
 * The cap on rolls a match may run to (§2.9). Nothing in the rules
 * shortens a match on its own — a captured pawn only goes back to the
 * yard, there is no draw and no move limit — so a legal match can in
 * principle run forever, and some cap has to exist somewhere. It has to be
 * a rule the engine enforces itself, not a bound the storage layer imposes
 * on what it is willing to believe: a real match that merely runs long must
 * not be rejected as if its save file were corrupt. Reaching the cap ends
 * the match in a no-contest (`{ kind: 'noContest' }`), never a win.
 */
// Pinned from a self-play sweep (Phase 4 §D): every seat driven by
// `chooseCpuMove` (cpu.ts), 2,000 seeds per difficulty, MAX_ROLLS
// temporarily raised to 200,000 so nothing was cut off mid-measurement.
// Observed roll counts to a decision (median / p99 / p99.9 / max):
//   easy:    413 /  594 /  709 /  714
//   normal:  477 /  798 /  962 / 1101
//   hard:    520 /  858 / 1066 / 1090
// No sweep produced a no-contest at that raised cap — every one of the
// 6,000 matches ended in a win. The observed max across all three was
// 1,101; this cap sits at roughly 9x that, both comfortably past any real
// match and a round number. rollDistribution.test.ts re-checks a smaller
// sweep on every CI run; the full sweep's numbers live above, not in code
// that re-derives them.
export const MAX_ROLLS = 10_000;

/** All sixteen pawns in the yard, seat 0 to move first (§2.7 — fixed by rule, not by seed). */
export function initialState(): MatchState {
  return {
    pawns: bySeat(() => [0, 0, 0, 0] as const),
    turn: YOU,
    rollIndex: 0,
    sixStreak: 0,
    die: null,
    result: null,
  };
}

const nextSeatOf = (seat: Seat): Seat => ((seat + 1) % SEAT_COUNT) as Seat;

/**
 * What `seat` may do with a roll of `die`: which pawn, and where it lands.
 *
 * Pawns are considered in their own fixed order (0..3), so two pawns
 * sitting on the same `progress` come back as two separate moves rather
 * than being collapsed into one — each is a different pawn to pick up, even
 * though picking either lands on the same square.
 */
export function legalMovesFor(state: MatchState, seat: Seat, die: number): Move[] {
  const moves: Move[] = [];
  const progresses = state.pawns[seat];
  for (let index = 0; index < PAWNS_PER_SEAT; index++) {
    const pawn = index as 0 | 1 | 2 | 3;
    const from = progresses[index]!;
    if (from === HOME_PROGRESS) continue;
    if (from === 0) {
      // In the yard: only a six sends a pawn out, and it always lands on
      // the first square of the ring.
      if (die === 6) moves.push({ pawn, from, to: 1 });
      continue;
    }
    const to = from + die;
    // Exact count only (§2.5): a roll that would overshoot home cannot move
    // this pawn at all, not even partway.
    if (to <= HOME_PROGRESS) moves.push({ pawn, from, to });
  }
  return moves;
}

/** What one call to `rollDie` resolved to. */
export interface RollOutcome {
  readonly die: number;
  readonly kind: 'move' | 'autoPass' | 'thirdSix' | 'noContest';
  /** The state after this roll — `awaitingMove` (die set) only when `kind` is `'move'`. */
  readonly state: MatchState;
  /** The seat's legal replies to `die`. Non-empty only when `kind` is `'move'`. */
  readonly moves: readonly Move[];
}

/**
 * Rolls once for the seat on turn and carries it all the way to a stop.
 *
 * Returns null rather than rolling when there is nothing to roll for: a
 * finished match does not get another roll (`state.result !== null`), and
 * neither does a match already waiting on a move for the roll it just made
 * (`state.die !== null`) — that roll has to be resolved with `applyMove`
 * first, not re-rolled out from under it.
 *
 * Otherwise, four things can happen, decided in this order:
 *
 *   1. This is the roll that reaches `MAX_ROLLS` (§2.9): the match ends in a
 *      no-contest right here, before any of the ordinary outcomes below get
 *      a chance to apply — whatever this roll would otherwise have resolved
 *      to (a move, an auto-pass, a forfeited third six) is moot, because the
 *      rule is that the match is over the instant the roll count reaches the
 *      cap, not that it plays out this one roll first. The die is reported
 *      as rolled, but `state.die` is null and `moves` is empty: there is
 *      nothing left to play, on screen or off it. (Before this outcome
 *      existed, a capped roll that would have had a legal move returned
 *      `kind: 'move'` with that move listed *and* `result: { kind:
 *      'noContest' }` set at the same time — a move the screen could show
 *      but `applyMove` would always refuse, since it checks
 *      `state.result !== null` before anything else. That state is no
 *      longer reachable.)
 *   2. This is the seat's third six in a row (§2.1): the turn is forfeited
 *      without offering a move, the streak resets, and turn passes on.
 *   3. The roll has no legal reply for this seat: an automatic pass. A six
 *      still earns the seat another roll here — §2.6's point is that an
 *      automatic pass spends the *move* a six would otherwise unlock, not
 *      the *extra roll* a six grants by itself — so the streak carries
 *      forward unreset and the same seat rolls again; anything else passes
 *      turn and resets the streak.
 *   4. Otherwise: the roll stands, waiting on a move.
 *
 * `rollIndex` advances by one on every call, win or lose, move or not —
 * it counts rolls, and every call here is exactly one roll.
 */
export function rollDie(state: MatchState, seed: string): RollOutcome | null {
  if (state.result !== null || state.die !== null) return null;
  const seat = state.turn;
  const die = rollFor(seed, state.rollIndex);
  const rollIndex = state.rollIndex + 1;

  // The cap is checked against the *count of rolls made*. Reaching it
  // decides the outcome on its own (point 1 above), so nothing past this
  // point — thirdSix, autoPass, or the legal moves themselves — is computed.
  if (rollIndex >= MAX_ROLLS) {
    const nextState: MatchState = {
      ...state,
      rollIndex,
      die: null,
      result: { kind: 'noContest' },
    };
    return { die, kind: 'noContest', state: nextState, moves: [] };
  }

  const consecutiveSixes = die === 6 ? state.sixStreak + 1 : 0;
  if (consecutiveSixes >= 3) {
    const nextState: MatchState = {
      ...state,
      turn: nextSeatOf(seat),
      rollIndex,
      sixStreak: 0,
      die: null,
      result: null,
    };
    return { die, kind: 'thirdSix', state: nextState, moves: [] };
  }

  const moves = legalMovesFor(state, seat, die);
  if (moves.length === 0) {
    const rollsAgain = die === 6;
    const nextState: MatchState = {
      ...state,
      turn: rollsAgain ? seat : nextSeatOf(seat),
      rollIndex,
      sixStreak: rollsAgain ? consecutiveSixes : 0,
      die: null,
      result: null,
    };
    return { die, kind: 'autoPass', state: nextState, moves: [] };
  }

  const nextState: MatchState = {
    ...state,
    rollIndex,
    sixStreak: consecutiveSixes,
    die,
    result: null,
  };
  return { die, kind: 'move', state: nextState, moves };
}

function replacePawnAt(
  pawns: BySeat<readonly [number, number, number, number]>,
  seat: Seat,
  pawn: 0 | 1 | 2 | 3,
  to: number,
): BySeat<readonly [number, number, number, number]> {
  return bySeat((s) => {
    if (s !== seat) return pawns[s];
    const updated: [number, number, number, number] = [...pawns[s]];
    updated[pawn] = to;
    return updated;
  });
}

/**
 * Sends home every enemy pawn sharing the landing square, if the landing
 * can capture at all (§2.2, §2.3). One landing captures the whole square at
 * once — there is no such thing as capturing only one of several enemy
 * pawns stacked together.
 */
function captureAt(
  pawns: BySeat<readonly [number, number, number, number]>,
  seat: Seat,
  to: number,
): BySeat<readonly [number, number, number, number]> {
  if (!isCapturableAt(seat, to)) return pawns;
  const square = globalSquareOf(seat, to);
  return bySeat((s) => {
    if (s === seat) return pawns[s];
    return pawns[s].map((progress) => (globalSquareOf(s, progress) === square ? 0 : progress)) as [
      number,
      number,
      number,
      number,
    ];
  });
}

/**
 * Applies one of `legalMovesFor(state, state.turn, state.die)` — the move
 * must match one exactly, including `from` and `to`, so a stale move
 * computed against an older state is refused rather than silently replayed
 * against this one. Null when `state` is not waiting on a move, or `move`
 * is not among the legal ones.
 *
 * A capture never earns another roll (§2.2) — only the die does, and only
 * when it showed a six. Landing on a seat's own pawns does nothing beyond
 * the landing itself (§2.4): no capture, no block, nothing to undo.
 */
export function applyMove(state: MatchState, move: Move): MatchState | null {
  if (state.result !== null || state.die === null) return null;
  const seat = state.turn;
  const legal = legalMovesFor(state, seat, state.die);
  const isLegal = legal.some(
    (candidate) =>
      candidate.pawn === move.pawn && candidate.from === move.from && candidate.to === move.to,
  );
  if (!isLegal) return null;

  const moved = replacePawnAt(state.pawns, seat, move.pawn, move.to);
  const pawns = captureAt(moved, seat, move.to);

  const hasWon = pawns[seat].every((progress) => progress === HOME_PROGRESS);
  if (hasWon) {
    return { ...state, pawns, die: null, result: { kind: 'win', winner: seat } };
  }

  // Only a six earns another roll for the same seat (§2.1); every other
  // roll — including this move having just captured — passes turn on.
  const rollsAgain = state.die === 6;
  return {
    ...state,
    pawns,
    turn: rollsAgain ? seat : nextSeatOf(seat),
    sixStreak: rollsAgain ? state.sixStreak : 0,
    die: null,
    result: null,
  };
}
