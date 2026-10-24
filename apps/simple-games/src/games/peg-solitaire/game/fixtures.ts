/**
 * Test fixtures for docs/PEG_SOLITAIRE_RULES.md §8 and §14, kept apart from
 * the rules so that no game code imports them. Nothing here is dealt to a
 * player.
 *
 * The cross's jumps are written in the usual board notation: columns a–g
 * from the left, rows 1–7 from the top, `from-to` for one jump — `d2-d4` is
 * the peg at column d, row 2 jumping down into the middle hole d4.
 */
import { ENGLISH, holeIndex } from './boards';

/**
 * A solution to the cross's standard problem (middle empty → one peg in the
 * middle), 31 jumps. It was found once by this game's own solver
 * (solver.ts) and written down here, so that the tests can replay a fixed,
 * known solution through the rules independently of whatever the solver
 * finds today. It is not taken from any book or product.
 */
export const ENGLISH_SOLUTION =
  'd2-d4 b3-d3 c1-c3 e1-c1 d3-b3 a3-c3 e3-e1 g3-e3 c4-c2 c1-c3 a4-c4 c4-c2 e4-e2 e1-e3 g4-e4 ' +
  'e4-e2 c6-c4 a5-c5 c5-c3 c2-c4 c4-e4 e5-e3 e2-e4 g5-e5 d5-f5 e7-e5 e4-e6 c7-e7 e7-e5 f5-d5 d6-d4';

/** The hole a square like `d4` names on the cross, or −1 when it is not a hole. */
export function englishSquare(square: string): number {
  const col = square.charCodeAt(0) - 'a'.charCodeAt(0);
  const row = Number(square.slice(1)) - 1;
  return holeIndex(ENGLISH, row, col);
}

/** `d2-d4 b3-d3 …` as [from, to] hole pairs. */
export function parseEnglishJumps(text: string): [number, number][] {
  return text
    .trim()
    .split(/\s+/)
    .map((jump) => {
      const [from, to] = jump.split('-');
      return [englishSquare(from!), englishSquare(to!)];
    });
}

/** The inverse of `parseEnglishJumps`, for readable failures. */
export function englishNotation(jumps: readonly { from: number; to: number }[]): string {
  const square = (hole: number) => {
    const { row, col } = ENGLISH.holes[hole]!;
    return `${String.fromCharCode(97 + col)}${row + 1}`;
  };
  return jumps.map((jump) => `${square(jump.from)}-${square(jump.to)}`).join(' ');
}

/**
 * Positions for the screen's tests (ui/PegSolitaireRoot.test.tsx), each a
 * list of [from, to] jumps from the opening of a problem this game deals. A
 * saved game is exactly such a list (§11), so a test can put any of these on
 * screen through the save slot, the way a player's own game comes back.
 *
 * They were found by a throwaway script outside the game (a plain depth-first
 * search and a "first legal jump" walk over the boards' own coordinates), and
 * fixtures.test.ts replays every one through the rules — nothing here is
 * trusted for being written down.
 */
export type JumpList = readonly (readonly [from: number, to: number])[];

/**
 * Triangle, problem 1 → 1 (indices 0 → 0): twelve jumps after which two pegs
 * remain and each can finish — `TRIANGLE_APEX_PERFECT_LAST` leaves one peg in
 * the ringed apex, `TRIANGLE_APEX_SINGLE_LAST` leaves one peg in hole 7
 * (index 6), outside the ring (§3).
 */
export const TRIANGLE_APEX_PREFIX: JumpList = [
  [3, 0],
  [5, 3],
  [0, 5],
  [6, 1],
  [9, 2],
  [11, 4],
  [13, 11],
  [10, 12],
  [12, 5],
  [2, 9],
  [14, 5],
  [5, 3],
];
export const TRIANGLE_APEX_PERFECT_LAST = [3, 0] as const;
export const TRIANGLE_APEX_SINGLE_LAST = [1, 6] as const;

/** Triangle, problem 1 → 1: eleven jumps that end with three pegs and no jump. */
export const TRIANGLE_APEX_STUCK: JumpList = [
  [3, 0],
  [5, 3],
  [0, 5],
  [6, 1],
  [8, 6],
  [9, 2],
  [10, 3],
  [1, 6],
  [12, 10],
  [10, 3],
  [14, 12],
];

/** The cross's standard problem: 25 jumps that end with seven pegs and no jump. */
export const ENGLISH_STUCK =
  'd2-d4 b3-d3 c1-c3 e1-c1 d3-b3 a3-c3 e3-e1 g3-e3 c4-c2 c1-c3 a4-c4 c4-c2 e4-e2 e1-e3 g4-e4 ' +
  'd4-f4 f5-f3 e3-g3 d5-f5 b5-d5 g5-e5 d5-f5 c7-c5 e6-c6 c5-c7';
