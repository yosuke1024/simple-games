/**
 * Where food goes (docs/SNAKE_RULES.md §8): only on cells the snake is not
 * on, decided by (seed, draw number, body) and nothing else, spread evenly
 * over the free cells, and with work fixed by the board's size.
 */
import { describe, expect, it } from 'vitest';
import { FOOD_DRAW_WORK_LIMIT, drawFood, drawFoodCounted, foodSeed } from './food';
import { createRng } from './rng';
import { hamiltonianCycle } from './test-helpers';
import { CELL_COUNT, INITIAL_BODY, cellAt } from './types';

describe('the draw (§8)', () => {
  it('takes its stream from the seed and the draw number', () => {
    expect(foodSeed('snake-x', 0)).toBe('snake-x:food:0');
    expect(foodSeed('snake-x', 12)).toBe('snake-x:food:12');
  });

  it('is the same for the same seed, number and body', () => {
    for (let n = 0; n < 50; n++) {
      expect(drawFood('repeat', n, INITIAL_BODY)).toBe(drawFood('repeat', n, INITIAL_BODY));
    }
  });

  it('changes with the seed and with the draw number', () => {
    const bySeed = new Set<number>();
    const byNumber = new Set<number>();
    for (let n = 0; n < 40; n++) {
      bySeed.add(drawFood(`seed-${n}`, 0, INITIAL_BODY));
      byNumber.add(drawFood('one-seed', n, INITIAL_BODY));
    }
    // 40 draws over 193 free cells: a constant stream would give 1.
    expect(bySeed.size).toBeGreaterThan(25);
    expect(byNumber.size).toBeGreaterThan(25);
  });

  it('never lands on the snake', () => {
    // Bodies of every length along the cycle of §4, many seeds each.
    const order = hamiltonianCycle();
    for (let length = 3; length < CELL_COUNT; length += 7) {
      const body = order.slice(0, length).reverse();
      const occupied = new Set(body);
      for (let n = 0; n < 30; n++) {
        const cell = drawFood(`lengths-${length}`, n, body);
        expect(cell).toBeGreaterThanOrEqual(0);
        expect(cell).toBeLessThan(CELL_COUNT);
        expect(occupied.has(cell)).toBe(false);
      }
    }
  });

  it('picks the one free cell when only one is left', () => {
    const order = hamiltonianCycle();
    for (let missing = 0; missing < CELL_COUNT; missing += 13) {
      const body = order.filter((_, index) => index !== missing);
      for (let n = 0; n < 5; n++) expect(drawFood('last', n, body)).toBe(order[missing]);
    }
  });

  it('has nowhere to go on a full board', () => {
    expect(drawFood('full', 0, hamiltonianCycle())).toBe(-1);
  });

  it('takes the floor(r × free)-th free cell, counting row-major', () => {
    const bodies = [INITIAL_BODY, hamiltonianCycle().slice(40, 140).reverse()];
    for (const body of bodies) {
      const free: number[] = [];
      for (let cell = 0; cell < CELL_COUNT; cell++) if (!body.includes(cell)) free.push(cell);
      for (let n = 0; n < 200; n++) {
        const r = createRng(foodSeed('order', n))();
        expect(drawFood('order', n, body)).toBe(free[Math.floor(r * free.length)]);
      }
    }
  });

  it('puts the first food of a run somewhere other than the opening snake', () => {
    for (let n = 0; n < 100; n++) {
      expect([cellAt(6, 2), cellAt(6, 3), cellAt(6, 4)]).not.toContain(
        drawFood(`first-${n}`, 0, INITIAL_BODY),
      );
    }
  });
});

describe('the spread (§8)', () => {
  it('is even over the free cells (chi-square, 200 draws a cell)', () => {
    const free = CELL_COUNT - INITIAL_BODY.length;
    const perCell = 200;
    const counts = new Array<number>(CELL_COUNT).fill(0);
    for (let n = 0; n < free * perCell; n++) counts[drawFood('spread', n, INITIAL_BODY)]!++;
    for (const cell of INITIAL_BODY) expect(counts[cell]).toBe(0);

    let chiSquare = 0;
    let lowest = Infinity;
    for (let cell = 0; cell < CELL_COUNT; cell++) {
      if (INITIAL_BODY.includes(cell)) continue;
      const count = counts[cell]!;
      lowest = Math.min(lowest, count);
      chiSquare += (count - perCell) ** 2 / perCell;
    }
    // 192 degrees of freedom: mean 192, standard deviation about 19.6. The
    // stream is seeded, so this is a fixed number, not a flaky one; the bound
    // is five deviations out, where a biased draw lands far beyond.
    expect(chiSquare).toBeLessThan(192 + 5 * 19.6);
    expect(lowest).toBeGreaterThan(perCell / 2);
  });
});

describe('the work (§8, §17)', () => {
  it('never exceeds one mark per body cell plus one pass over the board', () => {
    expect(FOOD_DRAW_WORK_LIMIT).toBe(2 * CELL_COUNT - 1);
    const order = hamiltonianCycle();
    let worst = 0;
    for (let length = 3; length <= CELL_COUNT; length++) {
      const body = order.slice(0, length).reverse();
      for (let n = 0; n < 3; n++) {
        const { work } = drawFoodCounted('work', n, body);
        expect(work).toBeLessThanOrEqual(length + CELL_COUNT);
        worst = Math.max(worst, work);
      }
    }
    expect(worst).toBeLessThanOrEqual(FOOD_DRAW_WORK_LIMIT);
  });
});
