/**
 * The order of the strengths, measured by self-play
 * (docs/NESTED_TIC_TAC_TOE_RULES.md §4.1, §13).
 *
 * Two pairs — hard against normal, normal against easy — play 40 matches
 * each, 20 with each side opening, seeds `nt-selfplay-<pair>-<n>`. Both CPUs
 * draw their ties from the one match seed and the move count (§4.1), so two
 * seeds can produce the same match: identical move lists count once. A pair
 * with fewer than 20 distinct matches is topped up from `<n>` = 41 (odd n:
 * the stronger side opens), up to 200 seeds.
 *
 * "The order shows" means, per pair, more wins for the stronger side than for
 * the weaker; draws are not counted, and no win-rate threshold is fixed. The
 * literals below are the measured results — deterministic, so this file
 * reproduces them on any machine.
 *
 * Normal against easy is cheap and always runs in full. Hard spends its whole
 * node budget nearly every move, so its 40 matches take over a minute; the
 * default run plays four of them (seeds 1, 2, 21, 22) and checks each
 * against the full run's record, and `NT_SELFPLAY=full` plays all 40:
 *
 *   NT_SELFPLAY=full pnpm exec vitest run src/games/nested-tic-tac-toe/game/cpu.selfplay.test.ts
 */
import { describe, expect, it } from 'vitest';
import { decideCpuMove } from './cpu';
import { isOver, positionFromMoves } from './engine';
import { CROSS, DRAWN, type Difficulty } from './types';

const FULL = process.env.NT_SELFPLAY === 'full';

type Outcome = 'strong' | 'weak' | 'draw';

function selfPlay(
  strong: Difficulty,
  weak: Difficulty,
  n: number,
): { moves: string; outcome: Outcome } {
  const pair = `${strong}-${weak}`;
  const strongFirst = n <= 40 ? n <= 20 : n % 2 === 1;
  const seed = `nt-selfplay-${pair}-${n}`;
  const moves: number[] = [];
  let position = positionFromMoves(moves)!;
  while (!isOver(position)) {
    const crossToMove = moves.length % 2 === 0;
    const difficulty = crossToMove === strongFirst ? strong : weak;
    moves.push(decideCpuMove({ moves, difficulty, seed })!.cell);
    position = positionFromMoves(moves)!;
  }
  const outcome: Outcome =
    position.result === DRAWN
      ? 'draw'
      : (position.result === CROSS) === strongFirst
        ? 'strong'
        : 'weak';
  return { moves: moves.join(','), outcome };
}

interface Tally {
  readonly played: number;
  readonly distinct: number;
  readonly strong: number;
  readonly weak: number;
  readonly draws: number;
}

function tally(strong: Difficulty, weak: Difficulty): Tally {
  const seen = new Set<string>();
  let played = 0;
  let strongWins = 0;
  let weakWins = 0;
  let draws = 0;
  for (let n = 1; n <= 200; n++) {
    if (n > 40 && seen.size >= 20) break;
    const { moves, outcome } = selfPlay(strong, weak, n);
    played += 1;
    if (seen.has(moves)) continue;
    seen.add(moves);
    if (outcome === 'strong') strongWins += 1;
    else if (outcome === 'weak') weakWins += 1;
    else draws += 1;
  }
  const result = { played, distinct: seen.size, strong: strongWins, weak: weakWins, draws };
  console.log(
    `nested self-play ${strong} vs ${weak}: ${played} matches, ${result.distinct} distinct — ` +
      `${strong} ${strongWins}, ${weak} ${weakWins}, drawn ${draws}`,
  );
  return result;
}

describe('the strengths come in order (§4.1, §13)', () => {
  it('normal beats easy more often than it loses to it — 40 matches', () => {
    const result = tally('normal', 'easy');
    expect(result).toEqual({ played: 40, distinct: 40, strong: 39, weak: 1, draws: 0 });
    expect(result.strong).toBeGreaterThan(result.weak);
  }, 60_000);

  it.skipIf(!FULL)(
    'hard beats normal more often than it loses to it — 40 matches (NT_SELFPLAY=full)',
    () => {
      const result = tally('hard', 'normal');
      expect(result).toEqual({ played: 40, distinct: 40, strong: 35, weak: 3, draws: 2 });
      expect(result.strong).toBeGreaterThan(result.weak);
    },
    600_000,
  );

  it.skipIf(FULL)(
    'plays four of the hard–normal matches exactly as the full run did',
    () => {
      const outcomes = [1, 2, 21, 22].map((n) => selfPlay('hard', 'normal', n).outcome);
      console.log(`nested self-play hard vs normal, seeds 1 2 21 22: ${outcomes.join(' ')}`);
      expect(outcomes).toEqual(HARD_NORMAL_SAMPLE);
    },
    60_000,
  );
});

/** The full run's outcomes for seeds 1, 2 (hard opens) and 21, 22 (normal opens). */
const HARD_NORMAL_SAMPLE: Outcome[] = ['strong', 'strong', 'strong', 'draw'];
