/**
 * `cellView`'s `isNext` (docs/NUMBER_PATH_RULES.md §11), on the same 3×3
 * board the Quick Rules figures draw (`TutorialScreen.tsx`'s `OPEN`): the
 * figures reuse `cellView` unchanged, so proving it here proves the ring
 * they show is correct without needing to render the tutorial itself.
 */
import { describe, expect, it } from 'vitest';
import { buildBoard, type Path } from '../../game';
import { cellView, pathPositions } from './cellView';

/** A road across a 3×3: 1 at a corner, 2 in the middle, 3 at the far corner. */
const ROAD: Path = [0, 1, 2, 5, 4, 3, 6, 7, 8];
const OPEN = buildBoard({
  width: 3,
  height: 3,
  numbers: [
    [0, 1],
    [4, 2],
    [8, 3],
  ],
  walls: [],
})!;

function isNextMap(path: Path): boolean[] {
  const positions = pathPositions(OPEN, path);
  return OPEN.numbers.map((_, index) => cellView(OPEN, path, positions, index).isNext);
}

describe('cellView isNext (§11)', () => {
  it('rings the number the path is next due to reach', () => {
    // The road has reached 2 (cell 4): 3's cell (8) is next, and no other.
    const map = isNextMap(ROAD.slice(0, 5));
    expect(map[8]).toBe(true);
    expect(map.filter(Boolean)).toHaveLength(1);
  });

  it('rings nothing once the path has reached the last number', () => {
    const map = isNextMap(ROAD);
    expect(map.every((next) => next === false)).toBe(true);
  });

  it('rings only 1 when the path has not started', () => {
    const map = isNextMap([]);
    expect(map[0]).toBe(true);
    expect(map.filter(Boolean)).toHaveLength(1);
  });
});
