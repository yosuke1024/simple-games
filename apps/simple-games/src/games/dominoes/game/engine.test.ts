import { describe, expect, it } from 'vitest';
import {
  ALL_TILES,
  dealFromSeed,
  distinctEnds,
  findOpening,
  hasLegalPlay,
  isConnected,
  isDouble,
  isTile,
  legalEnds,
  lineEnds,
  makeTile,
  needsEndChoice,
  pipTotal,
  placeTile,
  tileId,
  withoutTile,
} from './engine';
import { BONEYARD_SIZE, CPU, HAND_SIZE, PLAYER, TILE_COUNT, type Line, type Tile } from './types';

/** A line built by placing tiles on the right, one after another. */
function lineOf(...tiles: Tile[]): Line {
  let line: Line = [];
  for (const tile of tiles) line = placeTile(line, tile, 'right')!;
  return line;
}

describe('the set (§1)', () => {
  it('has 28 tiles, each once, each written smaller first', () => {
    expect(ALL_TILES).toHaveLength(TILE_COUNT);
    expect(new Set(ALL_TILES.map(tileId)).size).toBe(TILE_COUNT);
    for (const tile of ALL_TILES) expect(isTile(tile)).toBe(true);
    expect(ALL_TILES.filter(isDouble)).toHaveLength(7);
  });

  it('normalises a tile whichever way round it is named', () => {
    expect(makeTile(5, 3)).toEqual([3, 5]);
    expect(makeTile(3, 5)).toEqual([3, 5]);
    expect(isTile([5, 3])).toBe(false);
    expect(isTile([0, 7])).toBe(false);
    expect(isTile([1.5, 2])).toBe(false);
  });

  it('counts pips', () => {
    expect(
      pipTotal([
        [6, 6],
        [0, 1],
        [2, 3],
      ]),
    ).toBe(18);
    expect(pipTotal([])).toBe(0);
  });
});

describe('the deal (§1)', () => {
  it('gives seven to each hand and fourteen to the boneyard, all disjoint', () => {
    const deal = dealFromSeed('dm-deal');
    expect(deal.playerHand).toHaveLength(HAND_SIZE);
    expect(deal.cpuHand).toHaveLength(HAND_SIZE);
    expect(deal.boneyard).toHaveLength(BONEYARD_SIZE);
    const ids = [...deal.playerHand, ...deal.cpuHand, ...deal.boneyard].map(tileId);
    expect(new Set(ids).size).toBe(TILE_COUNT);
  });

  it('is the same deal for the same seed, and another for another', () => {
    expect(dealFromSeed('dm-same')).toEqual(dealFromSeed('dm-same'));
    expect(dealFromSeed('dm-same')).not.toEqual(dealFromSeed('dm-other'));
  });

  it('sorts the hands for reading and leaves the boneyard in drawing order', () => {
    const deal = dealFromSeed('dm-sorted');
    const sorted = (tiles: readonly Tile[]) =>
      tiles.every((tile, i) => i === 0 || tileId(tiles[i - 1]!) < tileId(tile));
    expect(sorted(deal.playerHand)).toBe(true);
    expect(sorted(deal.cpuHand)).toBe(true);
  });
});

describe('the opening (§2)', () => {
  it('goes to the highest double in either hand', () => {
    expect(
      findOpening(
        [
          [2, 2],
          [5, 6],
        ],
        [
          [4, 4],
          [1, 3],
        ],
      ),
    ).toEqual({ by: CPU, tile: [4, 4] });
    expect(findOpening([[0, 0]], [[6, 5]])).toEqual({ by: PLAYER, tile: [0, 0] });
  });

  it('goes to the heaviest tile when no double was dealt', () => {
    expect(
      findOpening(
        [
          [2, 6],
          [2, 3],
        ],
        [
          [3, 4],
          [0, 4],
        ],
      ),
    ).toEqual({ by: PLAYER, tile: [2, 6] });
  });

  it('breaks an equal pip sum by the larger pip', () => {
    // 3+4 and 2+5 and 1+6 all weigh seven; the six is the larger pip.
    expect(
      findOpening(
        [
          [3, 4],
          [2, 5],
        ],
        [[1, 6]],
      ),
    ).toEqual({ by: CPU, tile: [1, 6] });
  });
});

describe('placing tiles (§3)', () => {
  const line = lineOf([3, 5]);

  it('accepts a tile on the end it matches, and only there', () => {
    expect(legalEnds(line, [1, 3])).toEqual(['left']);
    expect(legalEnds(line, [5, 6])).toEqual(['right']);
    expect(legalEnds(line, [3, 5])).toEqual(['left', 'right']);
    expect(legalEnds(line, [0, 1])).toEqual([]);
    expect(placeTile(line, [0, 1], 'left')).toBeNull();
    expect(placeTile(line, [5, 6], 'left')).toBeNull();
  });

  it('turns the tile so the matching pips touch', () => {
    // [1, 3] on the left: 1 outward, 3 against the 3.
    expect(placeTile(line, [1, 3], 'left')![0]).toEqual({ tile: [1, 3], left: 1, right: 3 });
    // [3, 6] on the left must flip: 6 outward, 3 against the 3.
    expect(placeTile(line, [3, 6], 'left')![0]).toEqual({ tile: [3, 6], left: 6, right: 3 });
    // [2, 5] on the right must flip: 5 against the 5, 2 outward.
    const right = placeTile(line, [2, 5], 'right')!;
    expect(right[right.length - 1]).toEqual({ tile: [2, 5], left: 5, right: 2 });
    expect(isConnected(right)).toBe(true);
    expect(lineEnds(right)).toEqual({ left: 3, right: 2 });
  });

  it('plays a double across the end it matches, leaving the same end value', () => {
    const next = placeTile(line, [5, 5], 'right')!;
    expect(lineEnds(next)).toEqual({ left: 3, right: 5 });
    expect(legalEnds(line, [3, 3])).toEqual(['left']);
  });

  it('asks for an end only when both fit and the ends differ', () => {
    expect(needsEndChoice(line, [3, 5])).toBe(true);
    expect(needsEndChoice(line, [1, 3])).toBe(false);
    // Both ends showing a 4: either placement leaves the same ends, so the
    // tile simply goes on the right.
    const even = lineOf([4, 4]);
    expect(legalEnds(even, [4, 6])).toEqual(['left', 'right']);
    expect(distinctEnds(even, [4, 6])).toEqual(['right']);
    expect(needsEndChoice(even, [4, 6])).toBe(false);
  });

  it('knows whether a hand has anything that fits', () => {
    expect(
      hasLegalPlay(line, [
        [0, 0],
        [1, 5],
      ]),
    ).toBe(true);
    expect(
      hasLegalPlay(line, [
        [0, 0],
        [1, 2],
      ]),
    ).toBe(false);
  });

  it('detects a line that does not join', () => {
    expect(isConnected(lineOf([3, 5], [5, 6]))).toBe(true);
    expect(
      isConnected([
        { tile: [3, 5], left: 3, right: 5 },
        { tile: [4, 6], left: 4, right: 6 },
      ]),
    ).toBe(false);
  });

  it('takes one tile out of a hand', () => {
    expect(
      withoutTile(
        [
          [1, 2],
          [3, 4],
        ],
        [3, 4],
      ),
    ).toEqual([[1, 2]]);
    expect(withoutTile([[1, 2]], [3, 4])).toBeNull();
  });
});
