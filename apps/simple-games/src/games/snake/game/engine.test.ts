/**
 * One move of the snake (docs/SNAKE_RULES.md §1, §3): stepping, the walls,
 * growing, and the collision order — above all the case the plan names, the
 * head entering the cell the tail leaves on a tick without food.
 */
import { describe, expect, it } from 'vitest';
import { directionBetween, headingOf, isValidBody, moveSnake, neighbour } from './engine';
import { BOARD_SIZE, CELL_COUNT, DIRECTIONS, cellAt, type Direction } from './types';

const NO_FOOD = -1;

/** A body written as [row, col] pairs, head first. */
const at = (...pairs: readonly (readonly [number, number])[]): number[] =>
  pairs.map(([row, col]) => cellAt(row, col));

describe('the board (§1)', () => {
  it('numbers cells row-major from the top-left', () => {
    expect(BOARD_SIZE).toBe(14);
    expect(CELL_COUNT).toBe(196);
    expect(cellAt(0, 0)).toBe(0);
    expect(cellAt(0, 13)).toBe(13);
    expect(cellAt(1, 0)).toBe(14);
    expect(cellAt(13, 13)).toBe(195);
  });

  it('steps to the four neighbours inside the board', () => {
    const middle = cellAt(5, 5);
    expect(neighbour(middle, 'up')).toBe(cellAt(4, 5));
    expect(neighbour(middle, 'down')).toBe(cellAt(6, 5));
    expect(neighbour(middle, 'left')).toBe(cellAt(5, 4));
    expect(neighbour(middle, 'right')).toBe(cellAt(5, 6));
  });

  it('has walls on all four sides, and the edges do not wrap', () => {
    expect(neighbour(cellAt(0, 7), 'up')).toBeNull();
    expect(neighbour(cellAt(13, 7), 'down')).toBeNull();
    expect(neighbour(cellAt(7, 0), 'left')).toBeNull();
    expect(neighbour(cellAt(7, 13), 'right')).toBeNull();
    // The cell after a row's last is the next row's first — but not its neighbour.
    expect(neighbour(cellAt(3, 13), 'right')).not.toBe(cellAt(4, 0));
    expect(directionBetween(cellAt(3, 13), cellAt(4, 0))).toBeNull();
    expect(directionBetween(cellAt(4, 0), cellAt(3, 13))).toBeNull();
  });

  it('names the step between neighbours and nothing else', () => {
    const middle = cellAt(5, 5);
    for (const direction of DIRECTIONS) {
      expect(directionBetween(middle, neighbour(middle, direction)!)).toBe(direction);
    }
    expect(directionBetween(middle, middle)).toBeNull();
    expect(directionBetween(middle, cellAt(6, 6))).toBeNull();
    expect(directionBetween(middle, cellAt(5, 7))).toBeNull();
    expect(directionBetween(-1, 0)).toBeNull();
    expect(directionBetween(0, CELL_COUNT)).toBeNull();
  });
});

describe('moving (§3)', () => {
  const snake = at([5, 5], [5, 4], [5, 3]);

  it('adds a head and drops the tail, keeping the length', () => {
    const result = moveSnake(snake, 'right', NO_FOOD);
    expect(result).toEqual({ kind: 'move', body: at([5, 6], [5, 5], [5, 4]) });
  });

  it('turns by entering the neighbour that way', () => {
    expect(moveSnake(snake, 'up', NO_FOOD)).toEqual({
      kind: 'move',
      body: at([4, 5], [5, 5], [5, 4]),
    });
    expect(moveSnake(snake, 'down', NO_FOOD)).toEqual({
      kind: 'move',
      body: at([6, 5], [5, 5], [5, 4]),
    });
  });

  it('does not change the body it was given', () => {
    const before = [...snake];
    moveSnake(snake, 'right', NO_FOOD);
    moveSnake(snake, 'right', cellAt(5, 6));
    expect(snake).toEqual(before);
  });

  it('grows by one on the food, keeping the tail where it was', () => {
    const result = moveSnake(snake, 'right', cellAt(5, 6));
    expect(result).toEqual({ kind: 'eat', body: at([5, 6], [5, 5], [5, 4], [5, 3]) });
  });

  it('does not eat food that is not where the head goes', () => {
    expect(moveSnake(snake, 'up', cellAt(5, 6)).kind).toBe('move');
  });
});

describe('the walls (§3 step 2)', () => {
  const cases: readonly [string, number[], Direction][] = [
    ['top', at([0, 5], [1, 5], [2, 5]), 'up'],
    ['bottom', at([13, 5], [12, 5], [11, 5]), 'down'],
    ['left', at([5, 0], [5, 1], [5, 2]), 'left'],
    ['right', at([5, 13], [5, 12], [5, 11]), 'right'],
  ];

  it.each(cases)('stops the run at the %s wall', (_side, body, direction) => {
    expect(moveSnake(body, direction, NO_FOOD)).toEqual({ kind: 'wall' });
  });

  it('is the wall even when the food sits on the far side of the board', () => {
    // A board without wrap-around: (5, 0) is not one step right of (4, 13).
    const body = at([4, 13], [4, 12], [4, 11]);
    expect(moveSnake(body, 'right', cellAt(5, 0))).toEqual({ kind: 'wall' });
  });

  it('lets the snake run along a wall', () => {
    const body = at([0, 5], [1, 5], [2, 5]);
    expect(moveSnake(body, 'left', NO_FOOD).kind).toBe('move');
    expect(moveSnake(body, 'right', NO_FOOD).kind).toBe('move');
  });
});

describe('the snake itself (§3 step 4)', () => {
  /**
   * A 2×2 loop: head (5,5) → (6,5) → (6,6) → tail (5,6). Moving right puts
   * the head on the tail's cell — which the tail is leaving this very tick.
   */
  const loop = at([5, 5], [6, 5], [6, 6], [5, 6]);

  it('lets the head take the cell the tail leaves, on a tick without food', () => {
    const result = moveSnake(loop, 'right', NO_FOOD);
    expect(result).toEqual({ kind: 'move', body: at([5, 6], [5, 5], [6, 5], [6, 6]) });
  });

  it('can chase its own tail round that loop for as long as it likes', () => {
    let body: readonly number[] = loop;
    const turns: readonly Direction[] = ['right', 'down', 'left', 'up'];
    for (let lap = 0; lap < 25; lap++) {
      for (const direction of turns) {
        const result = moveSnake(body, direction, NO_FOOD);
        expect(result.kind).toBe('move');
        if (result.kind === 'move') body = result.body;
      }
    }
    expect(body).toEqual(loop);
  });

  it('keeps the tail when eating, so its cell then blocks the head', () => {
    // Play never puts food under the snake (§8); a hand-made position does,
    // to show the order: eating, nothing leaves, and the tail is body.
    expect(moveSnake(loop, 'right', cellAt(5, 6))).toEqual({ kind: 'self', cell: cellAt(5, 6) });
  });

  it('crashes into any other part of the body', () => {
    // A hook: the head at (5,5) moving down runs into (6,5), two cells back.
    const hook = at([5, 5], [5, 6], [6, 6], [6, 5], [6, 4]);
    expect(moveSnake(hook, 'down', NO_FOOD)).toEqual({ kind: 'self', cell: cellAt(6, 5) });
  });

  it('crashes into the neck when sent straight back (input never asks for this, §5)', () => {
    const straight = at([5, 5], [5, 4], [5, 3]);
    expect(moveSnake(straight, 'left', NO_FOOD)).toEqual({ kind: 'self', cell: cellAt(5, 4) });
  });
});

describe('bodies that could be on the board', () => {
  it('accepts a path of orthogonal steps', () => {
    expect(isValidBody(at([5, 5], [5, 4], [5, 3]))).toBe(true);
    expect(isValidBody(at([5, 5], [6, 5], [6, 6], [5, 6]))).toBe(true);
  });

  it('refuses gaps, diagonals, repeats, wraps and cells off the board', () => {
    expect(isValidBody(at([5, 5], [5, 3]))).toBe(false);
    expect(isValidBody(at([5, 5], [6, 6]))).toBe(false);
    expect(isValidBody(at([5, 5], [5, 4], [5, 5]))).toBe(false);
    expect(isValidBody([cellAt(3, 13), cellAt(4, 0)])).toBe(false);
    expect(isValidBody([cellAt(0, 0), -1])).toBe(false);
    expect(isValidBody([CELL_COUNT - 1, CELL_COUNT])).toBe(false);
    expect(isValidBody([1.5, 2.5])).toBe(false);
    expect(isValidBody([cellAt(5, 5)])).toBe(false);
    expect(isValidBody([])).toBe(false);
  });

  it('reads the heading from the neck to the head', () => {
    expect(headingOf(at([5, 5], [5, 4], [5, 3]))).toBe('right');
    expect(headingOf(at([4, 5], [5, 5], [5, 4]))).toBe('up');
    expect(headingOf(at([5, 5]))).toBeNull();
    expect(headingOf(at([5, 5], [6, 6]))).toBeNull();
  });
});
