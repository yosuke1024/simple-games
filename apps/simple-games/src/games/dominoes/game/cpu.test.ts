import { describe, expect, it } from 'vitest';
import { buildCpuView, chooseCpuMove, tileWeight, type CpuView } from './cpu';
import { hasLegalPlay, legalEnds, sameTile } from './engine';
import { createRng, shuffled } from './rng';
import { applyCpuAction, cpuTieBreak, cpuViewOf, type DominoesSession } from './session';
import { findPosition, playThrough } from './test-helpers';
import { CPU, type Line, type Tile } from './types';

const LINE_3_5: Line = [{ tile: [3, 5], left: 3, right: 5 }];

const view = (hand: Tile[], boneyardCount = 5): CpuView =>
  buildCpuView(hand, LINE_3_5, boneyardCount, 6);

const fixed = (value: number) => () => value;

describe('what the CPU is allowed to see (§6)', () => {
  const session = findPosition('dm-cpu-view', (s) => s.toMove === CPU && s.boneyard.length > 2);
  const seen = cpuViewOf(session);

  it('is exactly these fields — and none of them is the player’s tiles', () => {
    // Written out so that adding a field to CpuView is a decision somebody
    // takes in this test, not a line that slips through in another one.
    expect(Object.keys(seen).sort()).toEqual(
      ['boneyardCount', 'hand', 'line', 'opponentTileCount'].sort(),
    );
    // No seed either: the deal cannot be worked backwards from here.
    expect(Object.keys(seen)).not.toContain('seed');
    expect(chooseCpuMove).toHaveLength(2);
    expect(seen.hand).toEqual(session.cpuHand);
    expect(seen.boneyardCount).toBe(session.boneyard.length);
    expect(seen.opponentTileCount).toBe(session.playerHand.length);
  });

  /**
   * The same position with every tile the CPU cannot see changed: the
   * player's hand and the boneyard are pooled, reshuffled and dealt back in
   * the same counts. Nothing the CPU is entitled to has moved, so neither the
   * view nor its choice may move.
   */
  const reDealt = (): DominoesSession => {
    const hidden = shuffled(
      [...session.playerHand, ...session.boneyard],
      createRng('dm-cpu-view-reshuffle'),
    );
    return {
      ...session,
      playerHand: hidden.slice(0, session.playerHand.length),
      boneyard: hidden.slice(session.playerHand.length),
    };
  };

  it('does not move when every hidden tile is changed', () => {
    const other = reDealt();
    expect(other.playerHand).not.toEqual(session.playerHand);
    expect(other.boneyard).not.toEqual(session.boneyard);
    expect(cpuViewOf(other)).toEqual(seen);
  });

  it('and neither does what the CPU does', () => {
    const other = reDealt();
    expect(chooseCpuMove(cpuViewOf(other), cpuTieBreak(other))).toEqual(
      chooseCpuMove(seen, cpuTieBreak(session)),
    );
  });

  it('copies rather than shares, so a view cannot be walked back to the session', () => {
    expect(seen.hand).not.toBe(session.cpuHand);
    expect(seen.line).not.toBe(session.line);
    expect(seen.line[0]).not.toBe(session.line[0]);
  });
});

describe('the CPU’s choice (§5)', () => {
  it('plays the heaviest tile that fits', () => {
    expect(
      chooseCpuMove(
        view([
          [1, 3],
          [5, 6],
          [0, 0],
        ]),
        fixed(0),
      ),
    ).toEqual({ kind: 'play', tile: [5, 6], end: 'right' });
  });

  it('counts a double three pips heavier than its face', () => {
    expect(tileWeight([5, 5])).toBe(13);
    expect(tileWeight([5, 6])).toBe(11);
    // [3, 3] weighs 6 + 3 = 9 and beats [2, 5] at 7 and [1, 5] at 6.
    expect(
      chooseCpuMove(
        view([
          [2, 5],
          [3, 3],
          [1, 5],
        ]),
        fixed(0.5),
      ),
    ).toEqual({ kind: 'play', tile: [3, 3], end: 'left' });
  });

  it('settles equal weights with its coin, and the same coin the same way', () => {
    // [2, 3] and [0, 5] both weigh 5.
    const tied = view([
      [2, 3],
      [0, 5],
    ]);
    const picks = new Set<string>();
    for (let i = 0; i < 40; i++) {
      const choice = chooseCpuMove(tied, createRng(`dm-tie-${i}`));
      expect(choice).toEqual(chooseCpuMove(tied, createRng(`dm-tie-${i}`)));
      if (choice.kind === 'play') picks.add(choice.tile.join('-'));
    }
    expect([...picks].sort()).toEqual(['0-5', '2-3']);
  });

  it('draws with nothing that fits, and passes when there is nothing to draw', () => {
    expect(chooseCpuMove(view([[0, 1]], 3), fixed(0))).toEqual({ kind: 'draw' });
    expect(chooseCpuMove(view([[0, 1]], 0), fixed(0))).toEqual({ kind: 'pass' });
  });

  it('never asks for an end both sides would make the same', () => {
    const even: Line = [{ tile: [4, 4], left: 4, right: 4 }];
    for (let i = 0; i < 20; i++) {
      const choice = chooseCpuMove(buildCpuView([[4, 6]], even, 3, 7), createRng(`dm-even-${i}`));
      expect(choice).toEqual({ kind: 'play', tile: [4, 6], end: 'right' });
    }
  });

  it('is always legal, over whole games', () => {
    let checked = 0;
    for (let i = 0; i < 80; i++) {
      for (const position of playThrough(`dm-cpu-legal-${i}`)) {
        if (position.status !== 'playing' || position.toMove !== CPU) continue;
        const action = chooseCpuMove(cpuViewOf(position), cpuTieBreak(position));
        const fits = hasLegalPlay(position.line, position.cpuHand);
        if (action.kind === 'play') {
          expect(position.cpuHand.some((tile) => sameTile(tile, action.tile))).toBe(true);
          expect(legalEnds(position.line, action.tile)).toContain(action.end);
        } else if (action.kind === 'draw') {
          expect(fits).toBe(false);
          expect(position.boneyard.length).toBeGreaterThan(0);
        } else {
          expect(fits).toBe(false);
          expect(position.boneyard).toHaveLength(0);
        }
        expect(applyCpuAction(position)).not.toBeNull();
        checked += 1;
      }
    }
    // A scan that checked nothing would pass everything above.
    expect(checked).toBeGreaterThan(500);
  });

  it('gives the same action for the same position, every time', () => {
    const position = findPosition('dm-cpu-same', (s) => s.toMove === CPU && s.moveCount > 3);
    expect(applyCpuAction(position)).toEqual(applyCpuAction(position));
  });
});
