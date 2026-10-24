/**
 * Shared by the UI tests (not part of the game): rounds built through the
 * rules, and the cells a test can find on the screen. Every board here is one
 * game/ produced, so a test never plays a position the game could not reach.
 */
import { toPersisted } from '../storage/gamePersistence';
import type { PersistedGame } from '../storage/schemas';
import type { Round } from '../game';

export {
  cascadingRound,
  firstValid,
  invalidAdjacent,
  playFirst,
  roundAfter,
} from '../game/play-helpers';

/** The suspended record of `round`, as the game writes it. */
export function recordOf(round: Round, elapsedSeconds = 0): PersistedGame {
  const record = toPersisted({ round, elapsedSeconds }, 1);
  if (record === null) throw new Error('a finished round is never saved');
  return record;
}

/** The cell button for an index (0–63, row-major). */
export function cell(index: number): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(`[data-cell="${index}"]`);
  if (!element) throw new Error(`no cell ${index} on screen`);
  return element;
}

/** The kinds drawn on the board, row-major. */
export function shownBoard(): number[] {
  return Array.from(document.querySelectorAll<HTMLElement>('[data-cell]'), (element) =>
    Number(element.dataset.kind),
  );
}
