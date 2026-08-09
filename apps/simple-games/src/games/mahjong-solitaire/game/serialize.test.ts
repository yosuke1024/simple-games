/**
 * Persistence encoding of docs/MAHJONG_SOLITAIRE_RULES.md §10: a save is
 * identity plus removal ORDER, verified by O(n) replay — and the negative
 * cases are exactly the corruptions the format was chosen to catch, plus
 * the ones it makes inexpressible checked at the replay gate.
 */
import { describe, expect, it } from 'vitest';
import { freeTiles } from './freeState';
import { generateBoard } from './generator';
import { levelParams } from './layouts';
import { encodeRemovals, replayRemovals, type PersistedPair } from './serialize';
import { createLevelSession, findMatchingPair, removePair } from './session';
import { facesMatch } from './types';

const board = () => generateBoard(levelParams(1), 'mj-level-1');

/** A few honest moves, as the game would persist them. */
function playedPairs(count: number): {
  encoded: PersistedPair[];
  indexPairs: [number, number][];
} {
  let session = createLevelSession(1);
  const indexPairs: [number, number][] = [];
  for (let i = 0; i < count; i++) {
    const pair = findMatchingPair(session);
    if (!pair) break;
    indexPairs.push(pair);
    session = removePair(session, pair[0], pair[1])!;
  }
  return { encoded: encodeRemovals(session.layout, indexPairs), indexPairs };
}

describe('round-trip', () => {
  it('replays what it encoded, in order', () => {
    const { encoded, indexPairs } = playedPairs(3);
    const { layout, faces } = board();
    expect(replayRemovals(layout, faces, encoded)).toEqual(indexPairs);
  });

  it('replays a full winning game', () => {
    const b = board();
    const pairs: [number, number][] = [];
    for (let k = 0; k + 1 < b.solvedOrder.length; k += 2) {
      pairs.push([b.solvedOrder[k]!, b.solvedOrder[k + 1]!]);
    }
    const replayed = replayRemovals(b.layout, b.faces, encodeRemovals(b.layout, pairs));
    expect(replayed).toEqual(pairs);
  });

  it('replays an empty history', () => {
    const { layout, faces } = board();
    expect(replayRemovals(layout, faces, [])).toEqual([]);
  });
});

describe('fail-closed replay (§10 — each case discards the whole record)', () => {
  it('rejects a coordinate outside the layout', () => {
    const { layout, faces } = board();
    const pairs: PersistedPair[] = [[99, 99, 9, 0, 0, 0]];
    expect(replayRemovals(layout, faces, pairs)).toBeNull();
  });

  it('rejects a pair of one tile with itself', () => {
    const { layout, faces } = board();
    const t = layout.tiles[0]!;
    expect(replayRemovals(layout, faces, [[t.x, t.y, t.z, t.x, t.y, t.z]])).toBeNull();
  });

  it('rejects the same tile removed twice across steps', () => {
    const { encoded } = playedPairs(2);
    const { layout, faces } = board();
    const doubled = [encoded[0]!, encoded[0]!];
    expect(replayRemovals(layout, faces, doubled)).toBeNull();
  });

  it('rejects a removal that was not free at its moment', () => {
    const { layout, faces } = board();
    // A raised tile pins the tile below it: taking the buried one first is
    // exactly the impossible geometry a remaining-set encoding lets through.
    const covered = layout.tiles.findIndex(
      (tile) =>
        tile.z === 0 &&
        layout.tiles.some(
          (upper) =>
            upper.z === 1 && Math.abs(upper.x - tile.x) < 2 && Math.abs(upper.y - tile.y) < 2,
        ),
    );
    const partner = faces.findIndex((face, i) => i !== covered && face === faces[covered]);
    const ta = layout.tiles[covered]!;
    const tb = layout.tiles[partner]!;
    expect(replayRemovals(layout, faces, [[ta.x, ta.y, ta.z, tb.x, tb.y, tb.z]])).toBeNull();
  });

  it('rejects a free pair whose faces do not match', () => {
    const { layout, faces } = board();
    // Two free tiles with different faces, straight from the fresh board.
    const free = freeTiles(
      layout,
      layout.tiles.map(() => false),
    );
    const a = free[0]!;
    const b = free.find((i) => !facesMatch(faces[i]!, faces[a]!));
    expect(b).toBeDefined();
    const ta = layout.tiles[a]!;
    const tb = layout.tiles[b!]!;
    expect(replayRemovals(layout, faces, [[ta.x, ta.y, ta.z, tb.x, tb.y, tb.z]])).toBeNull();
  });

  it('rejects more pairs than the layout holds', () => {
    const { layout, faces } = board();
    const t = layout.tiles[0]!;
    const filler: PersistedPair = [t.x, t.y, t.z, t.x, t.y, t.z];
    const tooMany = new Array<PersistedPair>(layout.tiles.length).fill(filler);
    expect(replayRemovals(layout, faces, tooMany)).toBeNull();
  });
});
