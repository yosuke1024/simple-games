/**
 * Mine placement (docs/MINESWEEPER_RULES.md §4, §5).
 *
 * Mines are placed *after* the first tap, never before. The tapped cell and its
 * eight neighbours are excluded, so the first tap always reads 0 and always
 * opens a region — the opening the solver then works from. Everything else
 * derives from the seed, so a date or a retry rebuilds the identical board with
 * no content pipeline and no download.
 *
 * The loop is generate-check-retry: lay mines down at random, ask the solver of
 * §5 whether its two rules finish the board, and derive a new seed if they do
 * not. That is deliberately the naive shape. A repair-based generator (move the
 * mines the solver choked on) would accept a layout faster, but it biases where
 * mines end up in a way nobody can describe in one sentence — and this game's
 * promise, "played correctly you always win", is worth keeping legible.
 *
 * The cap and the fallback are the price of that choice: after MAX_ATTEMPTS the
 * best layout seen is used even if it needs a guess somewhere (§5.4). It is
 * better than handing the player nothing, and `noGuess` says plainly when it
 * happened, so the tests can watch how often it does.
 */
import { cellAndNeighbours, fieldFromMines, type MineField } from './board';
import { createRng } from './rng';
import { solveFrom } from './solver';
import { PRESETS, type Difficulty } from './types';

/** Derived-seed attempts before the best layout so far is accepted (§5.3). */
export const MAX_ATTEMPTS = 200;

export interface GeneratedField {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly field: MineField;
  /** The cell the player tapped first — guaranteed mine-free and 0 (§4). */
  readonly firstIndex: number;
  /** Attempts taken; 1 means the first layout was accepted. */
  readonly attempts: number;
  /** False only when the cap was reached and the best attempt was used. */
  readonly noGuess: boolean;
}

/**
 * Picks `count` distinct cells from `candidates` using a partial Fisher-Yates:
 * only the prefix that is actually drawn gets shuffled, which matters because
 * this runs up to MAX_ATTEMPTS times inside one first tap.
 */
function sample(candidates: readonly number[], count: number, rng: () => number): number[] {
  const pool = [...candidates];
  const draw = Math.min(count, pool.length);
  for (let i = 0; i < draw; i++) {
    const j = i + Math.floor(rng() * (pool.length - i));
    const swap = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = swap;
  }
  return pool.slice(0, draw);
}

/** One random layout for the given attempt seed. */
function layoutFor(difficulty: Difficulty, firstIndex: number, attemptSeed: string): MineField {
  const preset = PRESETS[difficulty];
  const cells = preset.width * preset.height;
  const forbidden = new Set(cellAndNeighbours(preset.width, preset.height, firstIndex));

  const candidates: number[] = [];
  for (let i = 0; i < cells; i++) if (!forbidden.has(i)) candidates.push(i);

  const mines = new Array<boolean>(cells).fill(false);
  for (const cell of sample(candidates, preset.mines, createRng(attemptSeed))) {
    mines[cell] = true;
  }
  return fieldFromMines(preset.width, preset.height, mines);
}

/**
 * A board for this seed and this first tap. Same seed plus same first tap
 * always yields the same mines, which is what makes "retry the same board"
 * free and instant (§2) and what makes a daily the same for everybody (§8).
 */
export function generateField(
  seed: string,
  difficulty: Difficulty,
  firstIndex: number,
): GeneratedField {
  let best: MineField | null = null;
  let bestRemaining = Number.POSITIVE_INFINITY;
  // The layout is a function of the seed *and* the first tap, so the random
  // stream is seeded with both. Without the tap in there, two taps that
  // exclude the same number of low cells draw from pools that agree further
  // up and can land on the identical layout — true of the candidate pools by
  // construction, and surprising to anyone reading the board.
  const base = `${seed}@${firstIndex}`;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    // Derived seeds are `#2`, `#3`, … as §5 describes.
    const field = layoutFor(difficulty, firstIndex, attempt === 1 ? base : `${base}#${attempt}`);
    const outcome = solveFrom(field, firstIndex);
    if (outcome.solved) {
      return { seed, difficulty, field, firstIndex, attempts: attempt, noGuess: true };
    }
    if (outcome.remaining < bestRemaining) {
      bestRemaining = outcome.remaining;
      best = field;
    }
  }

  // Playable beats perfect, and only here (§5.4). In practice unreachable —
  // generator.test.ts measures how often this branch is taken.
  return {
    seed,
    difficulty,
    field: best!,
    firstIndex,
    attempts: MAX_ATTEMPTS,
    noGuess: false,
  };
}
