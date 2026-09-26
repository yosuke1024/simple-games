/**
 * Golden games: the deal and the CPU's first actions, for two seeds.
 *
 * The seed is the whole game (docs/DOMINOES_RULES.md §1, §5): which tiles are
 * dealt, the order the boneyard is drawn in, and how the CPU settles a tie.
 * A saved game is resumed from its seed and its position (§9) — the loader
 * even checks the boneyard against the seed's deal — so if the shuffle, the
 * set's order or the CPU's weighting changed, every game suspended on a
 * player's device would come back as a game it never was, or not at all.
 *
 * The stand-in player (game/test-helpers.ts) plays the first tile that fits;
 * it is deterministic, so the first actions below are fixed without a
 * hand-written move list.
 *
 * This pins released behaviour; do not edit these values to go green. If a
 * change to the deal or the CPU is intended, regenerate them and say so in
 * the commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { ALL_TILES, dealFromSeed } from './engine';
import { createSession } from './session';
import { playThrough } from './test-helpers';
import { CPU, PLAYER, type Tile } from './types';

const text = (tiles: readonly Tile[]) => tiles.map((tile) => tile.join('')).join(' ');

/** The CPU's first actions, written as `play 45 right` / `draw` / `pass`. */
function cpuActions(seed: string, count: number): string[] {
  const game = playThrough(seed);
  const out: string[] = [];
  for (let i = 0; i + 1 < game.length && out.length < count; i++) {
    const before = game[i]!;
    const after = game[i + 1]!;
    if (before.toMove !== CPU) continue;
    if (after.line.length > before.line.length) {
      const end = after.line[0] === before.line[0] ? 'right' : 'left';
      const placed = end === 'right' ? after.line[after.line.length - 1]! : after.line[0]!;
      out.push(`play ${placed.tile.join('')} ${end}`);
    } else if (after.boneyard.length < before.boneyard.length) {
      out.push('draw');
    } else {
      out.push('pass');
    }
  }
  return out;
}

describe('games that must never change', () => {
  it('keeps the set in its fixed order', () => {
    expect(text(ALL_TILES)).toBe(
      '00 01 02 03 04 05 06 11 12 13 14 15 16 22 23 24 25 26 33 34 35 36 44 45 46 55 56 66',
    );
  });

  it('deals the same way for the first seed', () => {
    const deal = dealFromSeed('dominoes-golden-a');
    expect({
      player: text(deal.playerHand),
      cpu: text(deal.cpuHand),
      boneyard: text(deal.boneyard),
    }).toEqual({
      player: '01 04 05 12 15 23 44',
      cpu: '00 13 14 16 35 36 56',
      boneyard: '22 06 25 33 11 34 02 45 55 03 66 24 26 46',
    });
    // The player holds the highest double, so the player opens and the CPU
    // moves first (§2).
    const session = createSession('dominoes-golden-a');
    expect(session.opening).toEqual({ by: PLAYER, tile: [4, 4] });
    expect(session.toMove).toBe(CPU);
  });

  it('answers the same way for the first seed', () => {
    expect(cpuActions('dominoes-golden-a', 6)).toEqual([
      'play 14 right',
      'play 00 right',
      'draw',
      'draw',
      'play 06 right',
      'play 56 right',
    ]);
  });

  it('deals the same way for the second seed', () => {
    const deal = dealFromSeed('dominoes-golden-b');
    expect({
      player: text(deal.playerHand),
      cpu: text(deal.cpuHand),
      boneyard: text(deal.boneyard),
    }).toEqual({
      player: '00 01 24 25 26 34 36',
      cpu: '02 12 14 33 35 45 66',
      boneyard: '55 05 15 16 04 44 03 13 11 06 23 22 56 46',
    });
    const session = createSession('dominoes-golden-b');
    expect(session.opening).toEqual({ by: CPU, tile: [6, 6] });
    expect(session.toMove).toBe(PLAYER);
  });

  it('answers the same way for the second seed', () => {
    expect(cpuActions('dominoes-golden-b', 6)).toEqual([
      'play 12 left',
      'play 02 left',
      'play 45 left',
      'draw',
      'draw',
      'draw',
    ]);
  });

  it('finishes both games the same way', () => {
    const ends = ['dominoes-golden-a', 'dominoes-golden-b'].map((seed) => {
      const game = playThrough(seed);
      const last = game[game.length - 1]!;
      return `${last.status} ${last.ending} ${last.score} after ${last.moveCount} moves`;
    });
    expect(ends).toEqual(['won out 15 after 15 moves', 'lost out 18 after 32 moves']);
  });
});
