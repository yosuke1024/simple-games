/**
 * Persistence encoding of docs/NUMBER_PATH_RULES.md §9: exact round-trips,
 * and everything else fails closed.
 *
 * The malformed table is the point of the file. A save that decodes into a
 * board with no road, or a path that broke a rule, is worse than no save at
 * all: the player is handed a board they cannot finish and nothing to tell
 * them why. Every row below is a record play could not have written, and
 * every one of them has to come back null.
 */
import { describe, expect, it } from 'vitest';
import { buildBoard } from './engine';
import { decodeBoard, decodeGame, decodePath, decodeSolution, encodeNumbers } from './serialize';
import { createDifficultySession, doTrace } from './session';

const NUMBERS = [
  [0, 1],
  [4, 2],
  [8, 3],
] as const;
const WALLED = buildBoard({ width: 3, height: 3, numbers: NUMBERS, walls: ['h1', 'h4'] })!;
const ROAD = [0, 1, 2, 5, 4, 3, 6, 7, 8];

const record = (over: Record<string, unknown> = {}) => ({
  width: 3,
  height: 3,
  numbers: [
    [0, 1],
    [4, 2],
    [8, 3],
  ],
  walls: ['h1', 'h4'],
  solution: ROAD,
  path: [0, 1, 2],
  ...over,
});

describe('serialize (§9)', () => {
  it('writes the numbers as [cell, number] pairs in order', () => {
    expect(encodeNumbers(WALLED)).toEqual([
      [0, 1],
      [4, 2],
      [8, 3],
    ]);
  });

  it('round-trips a whole saved game', () => {
    const session = doTrace(
      createDifficultySession('easy', 'number-path-easy-roundtrip'),
      [1],
      true,
    );
    const played = session ?? createDifficultySession('easy', 'number-path-easy-roundtrip');
    const decoded = decodeGame({
      width: played.board.width,
      height: played.board.height,
      numbers: encodeNumbers(played.board),
      walls: [...played.board.walls],
      solution: [...played.solution],
      path: [...played.path],
    });
    expect(decoded).not.toBeNull();
    expect(decoded!.board.numbers).toEqual(played.board.numbers);
    expect(decoded!.board.open).toEqual(played.board.open);
    expect(decoded!.board.walls).toEqual(played.board.walls);
    expect(decoded!.solution).toEqual(played.solution);
    expect(decoded!.path).toEqual(played.path);
  });

  it('reads back the hand-made board and its road', () => {
    const decoded = decodeGame(record());
    expect(decoded?.board.walls).toEqual(['h1', 'h4']);
    expect(decoded?.solution).toEqual(ROAD);
    expect(decoded?.path).toEqual([0, 1, 2]);
    // A path that has strayed from the road is still a legal game in progress.
    expect(decodeGame(record({ path: [0, 3, 6] }))?.path).toEqual([0, 3, 6]);
  });

  const malformed: Array<[string, () => unknown]> = [
    ['a width that is not a number', () => decodeBoard(record({ width: '3' }))],
    ['a board too big', () => decodeBoard(record({ width: 9, height: 9 }))],
    ['numbers that are not pairs', () => decodeBoard(record({ numbers: [0, 4, 8] }))],
    [
      'a pair with a string in it',
      () =>
        decodeBoard(
          record({
            numbers: [
              [0, '1'],
              [4, 2],
            ],
          }),
        ),
    ],
    [
      'a number missing from the run',
      () =>
        decodeBoard(
          record({
            numbers: [
              [0, 1],
              [8, 3],
            ],
          }),
        ),
    ],
    ['walls that are not strings', () => decodeBoard(record({ walls: [1] }))],
    ['a wall on no edge', () => decodeBoard(record({ walls: ['v2'] }))],
    ['a solution that is not a list', () => decodeSolution('012543678', WALLED)],
    ['a solution short of the board', () => decodeSolution(ROAD.slice(0, 8), WALLED)],
    ['a solution that crosses a wall', () => decodeSolution([0, 3, 6, 7, 4, 1, 2, 5, 8], WALLED)],
    ['a solution out of number order', () => decodeSolution([0, 1, 2, 5, 8, 7, 6, 3, 4], WALLED)],
    ['a solution with a repeat', () => decodeSolution([0, 1, 2, 5, 4, 3, 6, 7, 7], WALLED)],
    ['a solution not ending on K', () => decodeSolution([8, 7, 6, 3, 4, 5, 2, 1, 0], WALLED)],
    ['a path that does not start on 1', () => decodePath([1, 2], WALLED)],
    ['a path with a diagonal step', () => decodePath([0, 4], WALLED)],
    ['a path through a wall', () => decodePath([0, 1, 4], WALLED)],
    ['a path that repeats a cell', () => decodePath([0, 1, 0], WALLED)],
    ['a path entering a number early', () => decodePath([0, 3, 6, 7, 8], WALLED)],
    ['a path past K', () => decodePath([...ROAD, 5], WALLED)],
    ['a path with a cell off the grid', () => decodePath([0, 1, 12], WALLED)],
    ['a path that is not a list', () => decodePath({ length: 2 }, WALLED)],
    [
      'a record whose solution breaks a wall',
      () => decodeGame(record({ walls: ['h1', 'h4', 'v1'] })),
    ],
    ['a record whose path breaks a wall', () => decodeGame(record({ path: [0, 1, 4] }))],
    ['a record missing its path', () => decodeGame(record({ path: undefined }))],
  ];

  for (const [name, decode] of malformed) {
    it(`refuses ${name}`, () => {
      expect(decode()).toBeNull();
    });
  }
});
