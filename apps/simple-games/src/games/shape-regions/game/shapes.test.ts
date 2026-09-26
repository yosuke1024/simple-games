/**
 * The five categories of docs/SHAPE_REGIONS_RULES.md §2, pinned two ways: by
 * example, one shape at a time, and by exhaustion — every fixed polyomino of
 * sizes 2–6 lands in at most one category, and the catalog is exactly the
 * ones that land in one. The exclusivity is what makes a symbol a clue: a
 * shape that answered to two symbols could not be named by either.
 */
import { describe, expect, it } from 'vitest';
import {
  SHAPE_CATALOG,
  catalogFor,
  categoriesOf,
  classifyCells,
  classifyShape,
  fixedPolyominoes,
  normalize,
  type Offset,
} from './shapes';
import { SHAPE_CATEGORIES } from './types';

/** Rows of '#' and '.', top to bottom, as a set of offsets. */
const shape = (...rows: string[]): Offset[] =>
  normalize(
    rows.flatMap((row, r) =>
      [...row].flatMap((character, c) => (character === '#' ? [{ r, c }] : [])),
    ),
  );

describe('line (§2)', () => {
  it('is any run in one row or one column, two to six long', () => {
    expect(classifyShape(shape('##'))).toBe('line');
    expect(classifyShape(shape('#', '#'))).toBe('line');
    expect(classifyShape(shape('######'))).toBe('line');
  });

  it('is not a single cell', () => {
    expect(classifyShape(shape('#'))).toBeNull();
  });
});

describe('block (§2)', () => {
  it('is a filled rectangle with both sides at least two', () => {
    expect(classifyShape(shape('##', '##'))).toBe('block');
    expect(classifyShape(shape('###', '###'))).toBe('block');
    expect(classifyShape(shape('##', '##', '##'))).toBe('block');
  });

  it('is not a rectangle with a corner missing', () => {
    expect(classifyShape(shape('###', '##.'))).not.toBe('block');
  });
});

describe('corner (§2)', () => {
  it('is one corner cell with a horizontal and a vertical arm', () => {
    expect(classifyShape(shape('#.', '##'))).toBe('corner');
    expect(classifyShape(shape('#..', '###'))).toBe('corner');
    expect(classifyShape(shape('###', '#..', '#..'))).toBe('corner');
    expect(classifyShape(shape('....#', '#####'))).toBe('corner');
  });

  it('is not the three-cell L read as a step, nor a T', () => {
    expect(categoriesOf(shape('#.', '##'))).toEqual(['corner']);
    expect(classifyShape(shape('###', '.#.'))).not.toBe('corner');
  });
});

describe('tee (§2)', () => {
  it('is a bar of three or more with one cell on a non-end cell', () => {
    expect(classifyShape(shape('###', '.#.'))).toBe('tee');
    expect(classifyShape(shape('.#.', '###'))).toBe('tee');
    expect(classifyShape(shape('#.', '##', '#.'))).toBe('tee');
    // Lopsided: the stem on the second cell of a bar of four.
    expect(classifyShape(shape('####', '.#..'))).toBe('tee');
    expect(classifyShape(shape('#####', '...#.'))).toBe('tee');
  });

  it('is not a stem on the end of the bar, nor a stem two cells long', () => {
    expect(classifyShape(shape('###', '#..'))).toBe('corner');
    // The T-pentomino: bar of three, stem of two. Outside the five (§14).
    expect(classifyShape(shape('###', '.#.', '.#.'))).toBeNull();
  });
});

describe('step (§2)', () => {
  it('is two adjacent runs of two or more overlapping in exactly one cell', () => {
    expect(classifyShape(shape('##.', '.##'))).toBe('step');
    expect(classifyShape(shape('.##', '##.'))).toBe('step');
    expect(classifyShape(shape('#.', '##', '.#'))).toBe('step');
    expect(classifyShape(shape('##..', '.###'))).toBe('step');
    // Geometry alone: seven cells still read as a step; the size cap of §1
    // is the catalog's business, not the classifier's.
    expect(classifyShape(shape('###...', '..####'))).toBe('step');
    expect(classifyShape(shape('###.', '..##'))).toBe('step');
  });

  it('is not two runs overlapping in two cells, nor a run of one', () => {
    expect(classifyShape(shape('###', '.##'))).toBeNull();
    // A run of one on either row would make this the L or the domino.
    expect(classifyShape(shape('#..', '###'))).toBe('corner');
    expect(classifyShape(shape('#', '#'))).toBe('line');
  });
});

describe('shapes outside the five (§2, §14)', () => {
  it.each([
    ['plus', shape('.#.', '###', '.#.')],
    ['U', shape('#.#', '###')],
    ['W', shape('#..', '##.', '.##')],
    ['F', shape('.##', '##.', '.#.')],
    ['P', shape('##', '##', '#.')],
    ['X hexomino-ish', shape('.#.', '###', '.#.', '.#.')],
    ['Z pentomino', shape('##.', '.#.', '.##')],
  ])('%s is in no category', (_name, cells) => {
    expect(classifyShape(cells)).toBeNull();
    expect(categoriesOf(cells)).toEqual([]);
  });
});

describe('the catalog (§2)', () => {
  it('holds every fixed polyomino of sizes 2–6 that has a category, and each has exactly one', () => {
    let total = 0;
    let listed = 0;
    for (let size = 2; size <= 6; size++) {
      for (const cells of fixedPolyominoes(size)) {
        total++;
        const categories = categoriesOf(cells);
        expect(
          categories.length,
          `${JSON.stringify(cells)} fits ${categories.join('+')}`,
        ).toBeLessThanOrEqual(1);
        if (categories.length === 1) {
          listed++;
          expect(classifyShape(cells)).toBe(categories[0]);
        }
      }
    }
    // 2 + 6 + 19 + 63 + 216 fixed polyominoes; 101 of them are shapes here.
    expect(total).toBe(306);
    expect(listed).toBe(101);
    expect(SHAPE_CATALOG).toHaveLength(101);
  });

  it('counts the table of §2: 10 lines, 3 blocks, 40 corners, 24 tees, 24 steps', () => {
    const count = (category: string) =>
      SHAPE_CATALOG.filter((entry) => entry.category === category).length;
    expect(SHAPE_CATEGORIES.map(count)).toEqual([10, 3, 40, 24, 24]);
  });

  it('holds every tromino and every tetromino', () => {
    expect(SHAPE_CATALOG.filter((entry) => entry.size === 2)).toHaveLength(2);
    expect(SHAPE_CATALOG.filter((entry) => entry.size === 3)).toHaveLength(6);
    expect(SHAPE_CATALOG.filter((entry) => entry.size === 4)).toHaveLength(19);
    expect(SHAPE_CATALOG.filter((entry) => entry.size === 5)).toHaveLength(30);
    expect(SHAPE_CATALOG.filter((entry) => entry.size === 6)).toHaveLength(44);
  });

  it('narrows by size, by category, or both', () => {
    expect(catalogFor(4, null)).toHaveLength(19);
    expect(catalogFor(null, 'corner')).toHaveLength(40);
    expect(catalogFor(5, 'tee')).toHaveLength(8);
    expect(catalogFor(2, 'block')).toHaveLength(0);
    expect(catalogFor(null, null)).toHaveLength(101);
  });

  it('classifies board indices the same way as offsets', () => {
    // A 3-wide board: cells 0, 1 and 4 are the L in the top-left 2×2.
    expect(classifyCells([0, 1, 4], 3)).toBe('corner');
    expect(classifyCells([0, 1, 2], 3)).toBe('line');
    expect(classifyCells([0, 1, 3, 4], 3)).toBe('block');
  });
});
