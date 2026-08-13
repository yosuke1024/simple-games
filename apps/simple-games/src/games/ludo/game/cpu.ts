/**
 * The three opponents — and, more importantly, what they can see.
 *
 * The contract this file is held to is the design doc's CPU section
 * (docs/plans/2026-08-08-mahjong-bubble-ludo.md, Phase 4 §E; docs/LUDO_RULES.md
 * §4, once written, replaces it as the source of truth in its place).
 *
 * Ludo has no hidden hand to keep off a CPU seat's plate the way Hearts does
 * — every pawn's `progress` is public knowledge the instant it changes, for
 * all four seats at once. What still has to stay out of reach is the
 * *future*: which face the die will show on rolls not yet made, on any
 * seat's turn, including this one's later rolls. `LudoView` is where that is
 * enforced — it has a field for the roll that already happened (`die`) and
 * none at all for a seed or an RNG, so there is nowhere on the type for a
 * roll to be seen before it happens. `buildLudoView` is the only bridge from
 * a live `MatchState` to a view, and it copies the board out rather than
 * referencing it, so a view can never be walked back to the match it came
 * from.
 *
 * Ties need a coin, so `chooseCpuMove` takes one float as its second
 * argument, drawn from a stream of its own by whoever calls it — a number,
 * not a key to the dice.
 *
 * There is no search. Every decision below is arithmetic over at most four
 * legal moves — easy picks one, normal weighs one term per move, hard adds
 * one more term. It is also, deliberately, not very strong: hard prices the
 * risk of being captured back next turn, but it never looks past this one
 * roll, so a chain of sixes on somebody else's turn is invisible to it. A
 * CPU that read that far ahead would be doing search, which is exactly what
 * this file does not do.
 */
import { legalMovesFor } from './engine';
import {
  bySeat,
  globalSquareOf,
  HOME_PROGRESS,
  isCapturableAt,
  isSafeSquare,
  RING_SIZE,
  SEATS,
  type BySeat,
  type Difficulty,
  type MatchState,
  type Move,
  type Seat,
} from './types';

/**
 * Everything a CPU seat is allowed to know for one decision. There is no
 * field for a seed, an RNG, or any roll but the one already made — add one
 * and the peek ahead is visible in the diff, which is the whole point of the
 * type existing. The board itself is not secret in Ludo, so every seat's
 * pawns are here in full; what is missing is only ever the future.
 */
export interface LudoView {
  /** Which chair this is. Every seat number below is read against it. */
  readonly seat: Seat;
  readonly difficulty: Difficulty;
  /** The roll just made. No future roll — this seat's own next one included — reaches here. */
  readonly die: number;
  /** Every seat's four pawns, by `progress` (design doc §A) — the whole board is public. */
  readonly pawns: BySeat<readonly [number, number, number, number]>;
  /** This seat's legal replies to `die`, as `legalMovesFor` in engine.ts computed them. */
  readonly moves: readonly Move[];
}

/**
 * The one bridge from a live match to a view. Copies rather than references,
 * so a view can never be walked back to the state it came from. Null when
 * `state` is not waiting on a move — there is nothing for a seat to decide
 * about a roll that has not happened yet.
 */
export function buildLudoView(state: MatchState, difficulty: Difficulty): LudoView | null {
  if (state.die === null) return null;
  return {
    seat: state.turn,
    difficulty,
    die: state.die,
    pawns: bySeat((seat) => [...state.pawns[seat]] as const),
    moves: legalMovesFor(state, state.turn, state.die),
  };
}

// ---------------------------------------------------------------------------
// Reading the board
// ---------------------------------------------------------------------------

/**
 * How many enemy pawns a landing at `to` would send home — zero when the
 * square cannot be captured on at all (`isCapturableAt`, types.ts), and
 * otherwise a straight count of whichever other seats' pawns share the
 * landing's global square. Mirrors what `captureAt` in engine.ts actually
 * does, so normal's weight table and hard's score agree with the rules
 * rather than with a separate guess at them.
 */
export function capturedPawnCountAt(
  seat: Seat,
  to: number,
  pawns: BySeat<readonly [number, number, number, number]>,
): number {
  if (!isCapturableAt(seat, to)) return 0;
  const square = globalSquareOf(seat, to)!;
  let count = 0;
  for (const other of SEATS) {
    if (other === seat) continue;
    for (const progress of pawns[other]) {
      if (globalSquareOf(other, progress) === square) count += 1;
    }
  }
  return count;
}

/** How many of the six faces a die roll offers, so `SIX_FACES` reads as what it is below. */
const SIX_FACES = 6;

/**
 * A rough size of the danger a pawn would be in sitting at `to`, for one
 * roll — **an estimate, not a probability and not an upper bound.**
 *
 * Zero straight away when the square cannot be captured at all
 * (`isCapturableAt`): a safe square, this seat's own home column, or home
 * itself, no matter how many enemy pawns sit within striking distance —
 * there is no rule under which any of them would ever take this pawn there.
 *
 * Otherwise, worked out seat by seat and combined as independent chances of
 * *surviving* each seat, because the seats roll separately: for enemy seat
 * i, `kᵢ` is the count of **distinct die faces** (1..6) that would land one
 * of seat i's pawns on `to` — not the count of pawns that could do it, so
 * two of seat i's own pawns sitting the same distance back only cost one
 * face, the one either of them needs. A pawn contributes a face only if
 * rolling it would actually carry that pawn all the way to `to` along the
 * shared ring; one that would turn off into seat i's own home column first
 * is not a threat to this square at all, and a pawn already in the yard, a
 * home column, or home cannot reach the ring this turn regardless of the
 * roll, so neither counts. The risk is `1 − Π(1 − kᵢ / 6)` over every
 * threatening seat — **not** `(total threatening pawns within six squares) /
 * 6`, which double-counts a seat with two pawns the same distance back and
 * under-counts two seats with one pawn each equally placed.
 *
 * This number reads low in one direction: it is only the very next roll,
 * with no allowance for a six buying a threatening seat a second, closer
 * shot — seeing that far would mean reading what that seat does with its
 * next roll too, which is exactly the search this file does not do. It
 * reads high in the other direction: an enemy seat with more than one way to
 * reach `to` might not actually choose this pawn, or this landing, when its
 * own turn comes. Nothing here promises the seats are ranked correctly by
 * how dangerous they truly are, only that a square with more ways to be hit
 * scores higher than one with fewer.
 */
export function captureRiskAt(
  seat: Seat,
  to: number,
  pawns: BySeat<readonly [number, number, number, number]>,
): number {
  if (!isCapturableAt(seat, to)) return 0;
  const target = globalSquareOf(seat, to)!;

  let survivesEveryone = 1;
  for (const other of SEATS) {
    if (other === seat) continue;
    const reachingFaces = new Set<number>();
    for (const progress of pawns[other]) {
      // Only a pawn already on the shared ring can threaten this square this
      // turn — the yard, a home column, and home are all out of reach of it.
      if (progress < 1 || progress > RING_SIZE) continue;
      const from = globalSquareOf(other, progress)!;
      const distance = (((target - from) % RING_SIZE) + RING_SIZE) % RING_SIZE;
      if (distance < 1 || distance > 6) continue;
      // A roll that would carry this pawn past its own ring exit turns it
      // into its home column instead of landing it on `target`.
      if (progress + distance > RING_SIZE) continue;
      reachingFaces.add(distance);
    }
    survivesEveryone *= 1 - reachingFaces.size / SIX_FACES;
  }
  return 1 - survivesEveryone;
}

/**
 * Whether `to` is a safe square this pawn was not already standing on —
 * "moving to safety", as opposed to already being safe or never having been
 * on the ring to be unsafe in the first place (leaving the yard has its own,
 * separate bonus below).
 */
function entersSafetyFrom(seat: Seat, from: number, to: number): boolean {
  const toSquare = globalSquareOf(seat, to);
  if (toSquare === null || !isSafeSquare(toSquare)) return false;
  const fromSquare = globalSquareOf(seat, from);
  return fromSquare === null || !isSafeSquare(fromSquare);
}

// ---------------------------------------------------------------------------
// Weighing a move
// ---------------------------------------------------------------------------

/**
 * The floor of each bucket below sits far above the richest score the
 * bucket beneath it can ever reach, so the ranking capture > home > exit the
 * yard > enter safety > plain advance holds by construction — comparing two
 * scores from different buckets is comparing these constants, nothing more
 * subtle. A capture is worth more for every extra pawn it sends home at
 * once, which is what makes catching a two-pawn stack outscore catching one
 * pawn even before the tie-break is reached.
 */
const CAPTURE_BASE = 1_000_000;
const CAPTURE_PER_PAWN = 1_000;
const HOME_BONUS = 100_000;
const EXIT_YARD_BONUS = 10_000;
const SAFE_ENTRY_BONUS = 1_000;
// Plain advance has no bucket constant of its own: the score is simply
// `move.to` (0..58), a gradient too small to reach into `SAFE_ENTRY_BONUS`
// but big enough to prefer the more-advanced pawn between two plain moves.

/**
 * Normal's greedy weight table (design doc §E): capture beats reaching
 * home beats leaving the yard beats stepping onto a safe square beats
 * simply advancing. A move belongs to exactly one of these — landing on
 * home or a safe square is never also a capture (neither is a square a
 * capture can happen on), and leaving the yard always lands on this seat's
 * own entrance square, which is one of the eight safe squares by
 * construction (design doc §A) — so this is an ordinary priority chain, not
 * a sum of independent bonuses.
 */
function normalScoreOf(
  move: Move,
  seat: Seat,
  pawns: BySeat<readonly [number, number, number, number]>,
): number {
  const captured = capturedPawnCountAt(seat, move.to, pawns);
  if (captured > 0) return CAPTURE_BASE + CAPTURE_PER_PAWN * captured;
  if (move.to === HOME_PROGRESS) return HOME_BONUS;
  if (move.from === 0) return EXIT_YARD_BONUS;
  if (entersSafetyFrom(seat, move.from, move.to)) return SAFE_ENTRY_BONUS;
  return move.to;
}

/**
 * How much a risky landing costs hard, on top of normal's score. Sized to
 * swing a choice between two otherwise-equal plain advances (up to 58 apart
 * at most) — the risk difference alone is enough to flip that — while never
 * coming close to erasing the gap between adjacent buckets above, so hard
 * never turns down an available capture, home run, yard exit, or safe entry
 * just because it looks dangerous; those are worth having regardless.
 */
const HARD_RISK_WEIGHT = 200;

function hardScoreOf(
  move: Move,
  seat: Seat,
  pawns: BySeat<readonly [number, number, number, number]>,
): number {
  return normalScoreOf(move, seat, pawns) - HARD_RISK_WEIGHT * captureRiskAt(seat, move.to, pawns);
}

/** Picks from equally-good candidates with the tie-break float. */
function pickByTieBreak<T>(options: readonly T[], tieBreak: number): T {
  const index = Math.floor(tieBreak * options.length);
  return options[Math.min(Math.max(index, 0), options.length - 1)]!;
}

/**
 * The move to make, or null when there is none legal to make. Deterministic:
 * the same view and the same tie-break float always give the same move, at
 * every strength — what lets a saved match resume into the game it was
 * suspended from.
 *
 * Easy picks uniformly among the legal moves with the tie-break float alone.
 * Normal and hard score every move and pick uniformly among whichever tie
 * for the best score, the same way.
 */
export function chooseCpuMove(view: LudoView, tieBreak: number): Move | null {
  if (view.moves.length === 0) return null;
  if (view.moves.length === 1) return view.moves[0]!;
  if (view.difficulty === 'easy') return pickByTieBreak(view.moves, tieBreak);

  const scoreOf = (move: Move): number =>
    view.difficulty === 'hard'
      ? hardScoreOf(move, view.seat, view.pawns)
      : normalScoreOf(move, view.seat, view.pawns);

  const best = Math.max(...view.moves.map(scoreOf));
  const top = view.moves.filter((move) => scoreOf(move) === best);
  return pickByTieBreak(top, tieBreak);
}
