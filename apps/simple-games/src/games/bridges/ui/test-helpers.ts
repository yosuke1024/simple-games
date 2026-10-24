/**
 * A hand-drawn board for the UI tests — never imported by the game itself.
 * Five by five, six islands, every cell where the tests say it is:
 *
 *     . . 1 . .      island 0 at row 1, column 3
 *     . . . . .
 *     1 . . . 2      islands 1 (row 3, column 1) and 2 (row 3, column 5)
 *     . . . . .
 *     2 . 3 . 3      islands 3 (row 5, column 1), 4 (row 5, column 3), 5 (row 5, column 5)
 *
 * Edges, in the board's own order (docs/BRIDGES_RULES.md §2): 0 = 0–4 (down
 * the middle), 1 = 1–2 (across the middle — the two cross), 2 = 1–3,
 * 3 = 2–5, 4 = 3–4, 5 = 4–5. The one answer is 1 0 1 2 1 1: island 0 has
 * only the way down, which shuts the way across.
 */
import { buildGraph, type BridgesSession } from '../game';

export const HAND_LAYOUT = {
  width: 5,
  height: 5,
  islands: [
    { index: 2, value: 1 },
    { index: 10, value: 1 },
    { index: 14, value: 2 },
    { index: 20, value: 2 },
    { index: 22, value: 3 },
    { index: 24, value: 3 },
  ],
};

export const HAND_GRAPH = buildGraph(HAND_LAYOUT);

export const HAND_ANSWER = [1, 0, 1, 2, 1, 1] as const;

export const handSession = (
  bridges: readonly number[] = [0, 0, 0, 0, 0, 0],
  status: BridgesSession['status'] = 'playing',
): BridgesSession => ({
  mode: 'difficulty',
  seed: 'bridges-hand',
  difficulty: 'easy',
  dailyDate: null,
  ...HAND_LAYOUT,
  graph: HAND_GRAPH,
  solution: HAND_ANSWER,
  bridges,
  history: [],
  status,
  elapsedSeconds: 0,
  hintCount: 0,
});
