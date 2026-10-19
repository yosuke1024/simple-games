/**
 * What a tap on an island means, and where an arrow moves the focus
 * (docs/BRIDGES_RULES.md §4), on the hand-drawn board of ./test-helpers.ts.
 */
import { describe, expect, it } from 'vitest';
import { isSolved, isUnique } from '../game';
import { HAND_ANSWER, HAND_GRAPH, HAND_LAYOUT, handSession } from './test-helpers';
import { islandToward, isPartner, tapOutcome } from './tapLogic';

describe('the board the tests stand on', () => {
  it('has the six edges, and the two middle ones cross', () => {
    expect(HAND_GRAPH.edges.map((edge) => [edge.a, edge.b])).toEqual([
      [0, 4],
      [1, 2],
      [1, 3],
      [2, 5],
      [3, 4],
      [4, 5],
    ]);
    expect(HAND_GRAPH.crossings[0]).toEqual([1]);
  });

  it('has the one answer the helper says', () => {
    expect(isSolved(HAND_GRAPH, [...HAND_ANSWER])).toBe(true);
    expect(isUnique(HAND_LAYOUT)).toBe(true);
  });
});

describe('a tap (§4)', () => {
  const session = handSession();

  it('selects with nothing selected, and clears on the selected island', () => {
    expect(tapOutcome(session, null, 3)).toEqual({ kind: 'select', island: 3 });
    expect(tapOutcome(session, 3, 3)).toEqual({ kind: 'deselect' });
  });

  it('steps the bridge to a partner, keeping the selection', () => {
    expect(tapOutcome(session, 3, 4)).toEqual({ kind: 'connect', from: 3, to: 4 });
    expect(tapOutcome(session, 1, 2)).toEqual({ kind: 'connect', from: 1, to: 2 });
  });

  it('moves the selection to an island out of sight', () => {
    // 0 and 5 do not see each other: nothing is built, the selection moves.
    expect(isPartner(session, 0, 5)).toBe(false);
    expect(tapOutcome(session, 0, 5)).toEqual({ kind: 'select', island: 5 });
  });

  it('moves the selection, building nothing, across a blocked way', () => {
    // A bridge down the middle blocks the way across it (§2).
    const blocked = handSession([1, 0, 0, 0, 0, 0]);
    expect(isPartner(blocked, 1, 2)).toBe(false);
    expect(tapOutcome(blocked, 1, 2)).toEqual({ kind: 'select', island: 2 });
    // The way down is still open, and an edge with bridges stays a partner.
    expect(isPartner(blocked, 0, 4)).toBe(true);
    expect(isPartner(blocked, 1, 3)).toBe(true);
  });
});

describe('arrow keys (§4)', () => {
  const session = handSession();

  it('go first to the island in sight that way', () => {
    expect(islandToward(session, 0, 'down')).toBe(4);
    expect(islandToward(session, 4, 'left')).toBe(3);
    expect(islandToward(session, 3, 'up')).toBe(1);
    expect(islandToward(session, 1, 'right')).toBe(2);
  });

  it('still go to the partner behind a blocked way: the focus is not a bridge', () => {
    expect(islandToward(handSession([1, 0, 0, 0, 0, 0]), 1, 'right')).toBe(2);
  });

  it('fall back to the nearest island on that side when none is in sight', () => {
    // From 0, nothing in sight left or right: the nearest down-left / down-right.
    expect(islandToward(session, 0, 'left')).toBe(1);
    expect(islandToward(session, 0, 'right')).toBe(2);
    // From 2 (right edge), nothing further right; up reaches 0.
    expect(islandToward(session, 2, 'right')).toBeNull();
    expect(islandToward(session, 2, 'up')).toBe(0);
  });

  it('reach every island from every other', () => {
    const count = session.islands.length;
    for (let start = 0; start < count; start++) {
      const seen = new Set([start]);
      const queue = [start];
      while (queue.length > 0) {
        const from = queue.shift()!;
        for (const direction of ['up', 'down', 'left', 'right'] as const) {
          const next = islandToward(session, from, direction);
          if (next !== null && !seen.has(next)) {
            seen.add(next);
            queue.push(next);
          }
        }
      }
      expect(seen.size).toBe(count);
    }
  });
});
