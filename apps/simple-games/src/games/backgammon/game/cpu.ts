/**
 * The CPU's turn (docs/BACKGAMMON_RULES.md §5).
 *
 * `chooseTurn` sees a `BackgammonView` and nothing else: the public board,
 * the strength, the dice just rolled and the complete turns they allow
 * (engine.ts `maximalTurns`). There is no place on the type for the seed,
 * the RNG or any future roll, which is the whole of the promise that the CPU
 * never knows the next dice before they are thrown (§4, §5.1). The one float
 * that breaks ties arrives as a separate argument — a number, not a key into
 * the dice.
 *
 * - easy picks a legal turn at random (seeded).
 * - normal evaluates every turn's resulting position one ply deep.
 * - hard keeps the best `HARD_CANDIDATES` of those and, for each, averages the
 *   opponent's best one-ply reply over the 21 distinct rolls — an expectation,
 *   exact because the rolls are enumerated, not sampled. Positions evaluated
 *   are counted against `HARD_NODE_LIMIT`; when the limit is hit the
 *   candidates already completed compete on their expectation and the rest on
 *   their one-ply score, so hard is never weaker than normal (§5.2).
 */
import { DISTINCT_ROLLS, diceOf } from './dice';
import { maximalTurns, type TurnOutcome } from './engine';
import { evaluate } from './evaluate';
import { opponentOf, type Board, type Difficulty, type Side, type Turn } from './types';

/** Positions a hard turn may evaluate (§5.4). Provisional — see §16. */
export const HARD_NODE_LIMIT = 20000;
/** Turns hard carries into the second ply (§5.2). */
export const HARD_CANDIDATES = 6;

export interface BackgammonView {
  readonly board: Board;
  readonly side: Side;
  readonly difficulty: Difficulty;
  readonly dice: readonly number[];
  readonly turns: readonly TurnOutcome[];
}

/** The view for `side` about to play `dice` on `board` — all public, nothing else. */
export function buildView(
  board: Board,
  side: Side,
  difficulty: Difficulty,
  dice: readonly number[],
): BackgammonView {
  return { board, side, difficulty, dice, turns: maximalTurns(board, side, dice) };
}

export interface Choice {
  readonly turn: Turn;
  /** Positions the search evaluated — the bench's deterministic yardstick (§5.4). */
  readonly nodes: number;
}

/** The turn the CPU plays, or an empty turn when there is none (§2.4). */
export function chooseTurn(view: BackgammonView, tieBreak: number): Choice {
  const { turns } = view;
  if (turns.length === 0) return { turn: [], nodes: 0 };
  if (turns.length === 1) return { turn: turns[0]!.steps, nodes: 0 };

  if (view.difficulty === 'easy') {
    const index = Math.min(turns.length - 1, Math.floor(tieBreak * turns.length));
    return { turn: turns[index]!.steps, nodes: 0 };
  }

  let nodes = 0;
  const scored = turns.map((outcome) => {
    nodes += 1;
    return { outcome, score: evaluate(outcome.board, view.side) };
  });
  scored.sort((a, b) => b.score - a.score);

  if (view.difficulty === 'normal') {
    return { turn: pickBest(scored, tieBreak).outcome.steps, nodes };
  }

  // hard: a second ply over the opponent's rolls for the leading candidates.
  const opponent = opponentOf(view.side);
  const candidates = scored.slice(0, HARD_CANDIDATES);
  const expectations: { outcome: TurnOutcome; score: number }[] = [];
  let exhausted = false;
  for (const candidate of candidates) {
    if (exhausted) break;
    let total = 0;
    let completed = true;
    for (const { roll, weight } of DISTINCT_ROLLS) {
      const replies = maximalTurns(candidate.outcome.board, opponent, diceOf(roll));
      let best = -Infinity;
      if (replies.length === 0) {
        // The opponent cannot move: the position stands as it is for us.
        nodes += 1;
        best = -evaluate(candidate.outcome.board, view.side);
      }
      for (const reply of replies) {
        nodes += 1;
        const value = evaluate(reply.board, opponent);
        if (value > best) best = value;
        if (nodes >= HARD_NODE_LIMIT) break;
      }
      total += weight * -best;
      if (nodes >= HARD_NODE_LIMIT) {
        completed = false;
        exhausted = true;
        break;
      }
    }
    if (completed) expectations.push({ outcome: candidate.outcome, score: total / 36 });
  }
  // Candidates the limit cut short keep their one-ply score; a completed
  // expectation is in the same units (an evaluation of the position after the
  // opponent's reply), so the two compete directly (§5.2).
  const pool = [
    ...expectations,
    ...candidates
      .filter((c) => !expectations.some((e) => e.outcome === c.outcome))
      .map((c) => ({ outcome: c.outcome, score: c.score })),
  ];
  pool.sort((a, b) => b.score - a.score);
  return { turn: pickBest(pool, tieBreak).outcome.steps, nodes };
}

/** Among the top-scored entries (ties within epsilon), one chosen by the tie-break float. */
function pickBest<T extends { score: number }>(sorted: readonly T[], tieBreak: number): T {
  const top = sorted[0]!;
  const ties = sorted.filter((entry) => Math.abs(entry.score - top.score) < 1e-9);
  const index = Math.min(ties.length - 1, Math.floor(tieBreak * ties.length));
  return ties[index]!;
}
