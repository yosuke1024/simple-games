/**
 * The order of the strengths, measured by self-play (docs/CHESS_RULES.md
 * §5.1, §13).
 *
 * Two pairs — normal against easy, hard against normal — play 40 games each
 * from the starting position, 20 with the stronger side on White, seeds
 * `chess-selfplay-<pair>-<n>`. Both CPUs draw their order from the one game
 * seed and the move count (§5.4), so two seeds can produce the same game:
 * identical move lists count once. Every game is played to its end under the
 * rules (§3) — there is no move cap to adjudicate.
 *
 * "The order shows" means, per pair, more wins for the stronger side than
 * for the weaker; draws are not counted, and no win-rate threshold is fixed.
 * The literals below are the measured results — deterministic, so this file
 * reproduces them on any machine.
 *
 * Normal against easy is cheap and always runs in full. Hard spends its whole
 * node budget nearly every move — about a second a reply inside vitest on the
 * machine this was written on (§13) — so its 40 games take far longer than a
 * default run can spend. The default run replays the first eight plies of two
 * of them (seeds 1 and 21, one with each colour) against the recorded
 * openings; `CHESS_SELFPLAY=full` plays all 40 to the end and checks that
 * those two games begin with the same recorded openings, which is what ties
 * the samples to the full run's tally:
 *
 *   CHESS_SELFPLAY=full pnpm exec vitest run src/games/chess/game/cpu.selfplay.test.ts
 */
import { describe, expect, it } from 'vitest';
import { decideCpuMove } from './cpu';
import { createGame, playMove } from './record';
import { moveToUci } from './serialize';
import { WHITE, type Difficulty, type EndReason } from './types';

const FULL = process.env.CHESS_SELFPLAY === 'full';

type Result = 'strong' | 'weak' | 'draw';

interface Played {
  readonly moves: string;
  readonly result: Result;
  readonly reason: EndReason;
  readonly plies: number;
}

/** How much of a hard–normal game the default run replays (see the file comment). */
const SAMPLE_PLIES = 8;

function selfPlay(strong: Difficulty, weak: Difficulty, n: number, plies = Infinity) {
  const strongWhite = n <= 20;
  const seed = `chess-selfplay-${strong}-${weak}-${n}`;
  const game = createGame();
  while (game.outcome === null && game.moves.length < plies) {
    const whiteToMove = game.position.side === WHITE;
    const difficulty = whiteToMove === strongWhite ? strong : weak;
    const decision = decideCpuMove({
      position: game.position,
      history: game.history,
      difficulty,
      seed,
      moveCount: game.moves.length,
    })!;
    // §5.1 states that depth 1 finished inside the limit in every self-play
    // position: a searched reply that fell back to the static look would be
    // depth 0.
    if (decision.kind === 'search') expect(decision.completedDepth).toBeGreaterThanOrEqual(1);
    playMove(game, decision.move);
  }
  return { game, strongWhite };
}

/** The first `plies` moves of a game, in UCI. */
function selfPlayOpening(strong: Difficulty, weak: Difficulty, n: number, plies: number): string {
  return selfPlay(strong, weak, n, plies).game.moves.map(moveToUci).join(' ');
}

function playToEnd(strong: Difficulty, weak: Difficulty, n: number): Played {
  const { game, strongWhite } = selfPlay(strong, weak, n);
  const outcome = game.outcome!;
  const result: Result =
    outcome.winner === null
      ? 'draw'
      : (outcome.winner === WHITE) === strongWhite
        ? 'strong'
        : 'weak';
  return {
    moves: game.moves.map(moveToUci).join(' '),
    result,
    reason: outcome.reason,
    plies: game.moves.length,
  };
}

interface Tally {
  readonly played: number;
  readonly distinct: number;
  readonly strong: number;
  readonly weak: number;
  readonly draws: number;
  readonly reasons: Partial<Record<EndReason, number>>;
}

/**
 * Plays the pair's 40 games to the end and counts them. `openings` ties the
 * default run's samples to the full run: each listed game must begin with
 * the recorded plies, so a re-recorded sample cannot drift from the games
 * the tally counts.
 */
function tally(strong: Difficulty, weak: Difficulty, openings: Record<number, string> = {}): Tally {
  const seen = new Set<string>();
  let strongWins = 0;
  let weakWins = 0;
  let draws = 0;
  const reasons: Partial<Record<EndReason, number>> = {};
  const lengths: number[] = [];
  for (let n = 1; n <= 40; n++) {
    const played = playToEnd(strong, weak, n);
    const opening = openings[n];
    if (opening !== undefined) expect(`${played.moves} `.startsWith(`${opening} `)).toBe(true);
    if (seen.has(played.moves)) continue;
    seen.add(played.moves);
    lengths.push(played.plies);
    reasons[played.reason] = (reasons[played.reason] ?? 0) + 1;
    if (played.result === 'strong') strongWins += 1;
    else if (played.result === 'weak') weakWins += 1;
    else draws += 1;
  }
  lengths.sort((a, b) => a - b);
  const result = {
    played: 40,
    distinct: seen.size,
    strong: strongWins,
    weak: weakWins,
    draws,
    reasons,
  };
  console.log(
    `chess self-play ${strong} vs ${weak}: 40 games, ${result.distinct} distinct — ` +
      `${strong} ${strongWins}, ${weak} ${weakWins}, drawn ${draws}; endings ${JSON.stringify(reasons)}; ` +
      `plies min ${lengths[0]} median ${lengths[Math.floor(lengths.length / 2)]} max ${lengths[lengths.length - 1]}`,
  );
  return result;
}

describe('the strengths come in order (§5.1, §13)', () => {
  it('normal beats easy more often than it loses to it — 40 games', () => {
    const result = tally('normal', 'easy');
    expect(result).toEqual(NORMAL_EASY);
    expect(result.strong).toBeGreaterThan(result.weak);
  }, 120_000);

  it.skipIf(!FULL)(
    'hard beats normal more often than it loses to it — 40 games (CHESS_SELFPLAY=full)',
    () => {
      const result = tally('hard', 'normal', HARD_NORMAL_SAMPLE);
      expect(result).toEqual(HARD_NORMAL);
      expect(result.strong).toBeGreaterThan(result.weak);
    },
    3_600_000,
  );

  for (const n of [1, 21]) {
    it.skipIf(FULL)(
      `opens hard–normal game ${n} exactly as the full run did`,
      () => {
        const opening = selfPlayOpening('hard', 'normal', n, SAMPLE_PLIES);
        console.log(
          `chess self-play hard vs normal, seed ${n}, first ${SAMPLE_PLIES} plies: ${opening}`,
        );
        expect(opening).toBe(HARD_NORMAL_SAMPLE[n]);
      },
      120_000,
    );
  }
});

/* The full run's records (§13). */
const NORMAL_EASY: Tally = {
  played: 40,
  distinct: 40,
  strong: 40,
  weak: 0,
  draws: 0,
  reasons: { checkmate: 40 },
};
const HARD_NORMAL: Tally = {
  played: 40,
  distinct: 39,
  strong: 39,
  weak: 0,
  draws: 0,
  reasons: { checkmate: 39 },
};
const HARD_NORMAL_SAMPLE: Record<number, string> = {
  1: 'e2e4 d7d5 e4d5 d8d5 b1c3 d5d4 g1f3 d4f4',
  21: 'e2e4 e7e5 d2d4 d7d5 e4d5 d8d5 g1f3 e5d4',
};
