import { describe, expect, it } from 'vitest';
import {
  DOWN,
  LEFT,
  RIGHT,
  TILE_TYPES,
  UP,
  hasPipe,
  isValidOrientation,
  opposite,
  orientationMasks,
  periodOf,
  pipeMask,
  rotateCcw,
  rotateCw,
  rotateMaskCw,
  tileOfMask,
} from './tiles';

const bit = (dir: number) => 1 << dir;

describe('tile types and orientations (§1)', () => {
  it('orientation 0 of each type runs the pipes in §1’s table', () => {
    expect(pipeMask('end', 0)).toBe(bit(UP));
    expect(pipeMask('straight', 0)).toBe(bit(UP) | bit(DOWN));
    expect(pipeMask('elbow', 0)).toBe(bit(UP) | bit(RIGHT));
    expect(pipeMask('tee', 0)).toBe(bit(UP) | bit(RIGHT) | bit(DOWN));
  });

  it('a straight has 2 orientations, every other type 4, and no type is a cross or empty', () => {
    expect(periodOf('straight')).toBe(2);
    expect(periodOf('end')).toBe(4);
    expect(periodOf('elbow')).toBe(4);
    expect(periodOf('tee')).toBe(4);
    for (const type of TILE_TYPES) {
      for (const mask of orientationMasks(type)) {
        expect(mask).toBeGreaterThan(0);
        expect(mask).not.toBe(0b1111);
      }
    }
  });

  it('orientation and pipe set are one-to-one within each type', () => {
    for (const type of TILE_TYPES) {
      const masks = orientationMasks(type);
      expect(new Set(masks).size).toBe(masks.length);
    }
  });

  it('orientation k is orientation 0 turned clockwise k times', () => {
    for (const type of TILE_TYPES) {
      let mask = pipeMask(type, 0);
      for (let k = 0; k < periodOf(type); k++) {
        expect(pipeMask(type, k)).toBe(mask);
        mask = rotateMaskCw(mask);
      }
      // One more turn than the period comes back to orientation 0's pipes.
      expect(mask).toBe(pipeMask(type, 0));
    }
  });

  it('a clockwise turn maps up → right → down → left → up', () => {
    expect(rotateMaskCw(bit(UP))).toBe(bit(RIGHT));
    expect(rotateMaskCw(bit(RIGHT))).toBe(bit(DOWN));
    expect(rotateMaskCw(bit(DOWN))).toBe(bit(LEFT));
    expect(rotateMaskCw(bit(LEFT))).toBe(bit(UP));
    // A straight's orientation 1 turned once more is orientation 0's pipe set again.
    expect(rotateMaskCw(pipeMask('straight', 1))).toBe(pipeMask('straight', 0));
  });

  it('rejects orientations outside the period', () => {
    expect(isValidOrientation('straight', 2)).toBe(false);
    expect(isValidOrientation('elbow', 4)).toBe(false);
    expect(isValidOrientation('end', -1)).toBe(false);
    expect(isValidOrientation('tee', 1.5)).toBe(false);
    expect(() => pipeMask('straight', 2)).toThrow(RangeError);
  });

  it('opposite and hasPipe', () => {
    expect([UP, RIGHT, DOWN, LEFT].map(opposite)).toEqual([DOWN, LEFT, UP, RIGHT]);
    expect(hasPipe(pipeMask('elbow', 1), RIGHT)).toBe(true);
    expect(hasPipe(pipeMask('elbow', 1), UP)).toBe(false);
  });
});

describe('rotation periods (§2)', () => {
  it('clockwise turns return to the start after exactly the period, never sooner', () => {
    for (const type of TILE_TYPES) {
      for (let start = 0; start < periodOf(type); start++) {
        let k = start;
        for (let turns = 1; turns <= periodOf(type); turns++) {
          k = rotateCw(type, k);
          if (turns < periodOf(type)) expect(k).not.toBe(start);
        }
        expect(k).toBe(start);
      }
    }
  });

  it('counter-clockwise is the inverse of clockwise for every type and orientation', () => {
    for (const type of TILE_TYPES) {
      for (let k = 0; k < periodOf(type); k++) {
        expect(rotateCcw(type, rotateCw(type, k))).toBe(k);
        expect(rotateCw(type, rotateCcw(type, k))).toBe(k);
      }
    }
  });

  it('a counter-clockwise turn is period − 1 clockwise turns', () => {
    for (const type of TILE_TYPES) {
      for (let k = 0; k < periodOf(type); k++) {
        let cw = k;
        for (let i = 0; i < periodOf(type) - 1; i++) cw = rotateCw(type, cw);
        expect(rotateCcw(type, k)).toBe(cw);
      }
    }
  });
});

describe('tileOfMask', () => {
  it('reads every 1-, 2- and 3-pipe mask (14 of them) back as its type and orientation', () => {
    let read = 0;
    for (let mask = 0; mask < 16; mask++) {
      const tile = tileOfMask(mask);
      const pipes = [0, 1, 2, 3].filter((d) => mask & (1 << d)).length;
      if (pipes === 0 || pipes === 4) {
        expect(tile).toBeNull();
        continue;
      }
      expect(tile).not.toBeNull();
      expect(pipeMask(tile!.type, tile!.orientation)).toBe(mask);
      read++;
    }
    expect(read).toBe(14);
    expect(tileOfMask(16)).toBeNull();
    expect(tileOfMask(-1)).toBeNull();
  });
});
