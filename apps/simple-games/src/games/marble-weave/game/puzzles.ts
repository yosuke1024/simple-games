import type { Action, Mode } from './legacy';
export interface Puzzle {
  id: string;
  mode: Mode;
  size: number;
  target: number;
  board: number[];
  moveLimit: number;
  solution: Action[];
}
// Authored offline by reverse construction; each stored solution is replayed in tests.
// IDs and boards are immutable once published: saves replay against them.
export const PUZZLES: Puzzle[] = [
  {
    id: 'easy-1',
    mode: 'easy',
    size: 5,
    target: 3,
    board: [1, 1, 0, 0, 0, 0, 0, 2, 0, 0, 2, 0, 1, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    solution: [
      {
        to: 5,
        from: 7,
      },
      {
        to: 2,
        from: 12,
      },
    ],
    moveLimit: 2,
  },
  {
    id: 'easy-2',
    mode: 'easy',
    size: 5,
    target: 3,
    board: [1, 0, 1, 0, 0, 2, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 1, 2, 0, 0, 0, 0, 0, 0, 0],
    solution: [
      {
        to: 1,
        from: 16,
      },
      {
        to: 11,
        from: 10,
      },
    ],
    moveLimit: 2,
  },
  {
    id: 'easy-3',
    mode: 'easy',
    size: 5,
    target: 3,
    board: [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 1, 0, 2, 0, 0, 0, 1, 1, 0],
    solution: [
      {
        to: 8,
        from: 0,
      },
      {
        to: 24,
        from: 16,
      },
    ],
    moveLimit: 2,
  },
  {
    id: 'easy-4',
    mode: 'easy',
    size: 5,
    target: 3,
    board: [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1, 2, 0, 0, 0, 2, 0, 2, 0, 0, 0, 0, 0],
    solution: [
      {
        to: 18,
        from: 13,
      },
      {
        to: 0,
        from: 7,
      },
    ],
    moveLimit: 2,
  },
  {
    id: 'normal-1',
    mode: 'normal',
    size: 5,
    target: 3,
    board: [0, 0, 0, 0, 2, 0, 1, 0, 0, 1, 2, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, 2],
    solution: [
      {
        to: 22,
        from: 24,
      },
      {
        to: 16,
        from: 4,
      },
      {
        to: 1,
        from: 15,
      },
      {
        to: 14,
        from: 12,
      },
    ],
    moveLimit: 4,
  },
  {
    id: 'normal-2',
    mode: 'normal',
    size: 5,
    target: 3,
    board: [0, 2, 0, 0, 0, 0, 0, 0, 2, 0, 2, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 1, 1, 0],
    solution: [
      {
        to: 2,
        from: 8,
      },
      {
        to: 21,
        from: 15,
      },
      {
        to: 3,
        from: 10,
      },
      {
        to: 11,
        from: 16,
      },
    ],
    moveLimit: 4,
  },
  {
    id: 'normal-3',
    mode: 'normal',
    size: 5,
    target: 3,
    board: [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 2, 0, 1, 1, 0, 0, 0, 2, 0, 2, 1, 0, 0],
    solution: [
      {
        to: 6,
        from: 21,
      },
      {
        to: 2,
        from: 0,
      },
      {
        to: 0,
        from: 19,
      },
      {
        to: 10,
        from: 22,
      },
    ],
    moveLimit: 4,
  },
  {
    id: 'normal-4',
    mode: 'normal',
    size: 5,
    target: 3,
    board: [2, 0, 1, 0, 0, 1, 0, 0, 0, 2, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 2, 0, 0, 0, 1],
    solution: [
      {
        to: 8,
        from: 20,
      },
      {
        to: 7,
        from: 0,
      },
      {
        to: 18,
        from: 2,
      },
      {
        to: 11,
        from: 15,
      },
    ],
    moveLimit: 4,
  },
  {
    id: 'hard-1',
    mode: 'hard',
    size: 6,
    target: 4,
    board: [
      0, 0, 1, 2, 0, 0, 2, 0, 2, 0, 2, 0, 0, 2, 1, 2, 1, 1, 0, 0, 2, 1, 0, 0, 0, 0, 0, 0, 1, 0, 2,
      1, 0, 1, 0, 0,
    ],
    solution: [
      {
        to: 23,
        from: 17,
      },
      {
        to: 18,
        from: 30,
      },
      {
        to: 9,
        from: 31,
      },
      {
        to: 7,
        from: 33,
      },
      {
        to: 5,
        from: 6,
      },
    ],
    moveLimit: 5,
  },
  {
    id: 'hard-2',
    mode: 'hard',
    size: 6,
    target: 4,
    board: [
      2, 2, 1, 0, 0, 2, 2, 2, 0, 0, 1, 2, 2, 0, 0, 0, 1, 0, 0, 2, 1, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0,
      1, 0, 0, 1, 0,
    ],
    solution: [
      {
        to: 14,
        from: 21,
      },
      {
        to: 18,
        from: 5,
      },
      {
        to: 22,
        from: 34,
      },
      {
        to: 8,
        from: 31,
      },
      {
        to: 13,
        from: 11,
      },
    ],
    moveLimit: 5,
  },
  {
    id: 'hard-3',
    mode: 'hard',
    size: 6,
    target: 4,
    board: [
      0, 2, 0, 0, 1, 0, 0, 2, 1, 1, 0, 1, 0, 0, 2, 1, 0, 2, 0, 0, 0, 0, 1, 0, 2, 2, 0, 1, 2, 0, 0,
      0, 2, 1, 0, 0,
    ],
    solution: [
      {
        to: 26,
        from: 1,
      },
      {
        to: 10,
        from: 4,
      },
      {
        to: 21,
        from: 17,
      },
      {
        to: 21,
        from: 22,
      },
      {
        to: 27,
        from: 32,
      },
    ],
    moveLimit: 5,
  },
  {
    id: 'hard-4',
    mode: 'hard',
    size: 6,
    target: 4,
    board: [
      2, 2, 2, 0, 0, 0, 1, 2, 0, 2, 2, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 2, 0, 0, 1, 0, 0, 0, 1,
      0, 2, 0, 0, 1,
    ],
    solution: [
      {
        to: 21,
        from: 30,
      },
      {
        to: 3,
        from: 23,
      },
      {
        to: 8,
        from: 32,
      },
      {
        to: 31,
        from: 22,
      },
      {
        to: 0,
        from: 35,
      },
    ],
    moveLimit: 5,
  },
];
export const puzzleById = (id: string) => PUZZLES.find((p) => p.id === id);
