import { describe, expect, it } from 'vitest';
import { dealFromSeed, findOpening, hasLegalPlay, legalEnds, pipTotal, tileId } from './engine';
import {
  applyCpuAction,
  canDraw,
  canPass,
  createSession,
  draw,
  pass,
  play,
  type DominoesSession,
} from './session';
import { findPosition, playThrough } from './test-helpers';
import { CPU, opponentOf, PLAYER, TILE_COUNT, type Line, type Tile } from './types';

const allTiles = (s: DominoesSession) =>
  [...s.line.map((p) => p.tile), ...s.playerHand, ...s.cpuHand, ...s.boneyard].map(tileId);

/** A session at an arbitrary position — for the resolution rules, not for loading. */
function at(overrides: Partial<DominoesSession>): DominoesSession {
  return { ...createSession('dm-session-base'), ...overrides };
}

const lineOf = (...pairs: [number, number][]): Line =>
  pairs.map(([left, right]) => ({
    tile: (left <= right ? [left, right] : [right, left]) as Tile,
    left,
    right,
  }));

describe('a new game (§1, §2)', () => {
  it('puts the opening tile down and hands the first action to the other side', () => {
    const session = createSession('dm-new');
    const deal = dealFromSeed('dm-new');
    const opening = findOpening(deal.playerHand, deal.cpuHand);
    expect(session.opening).toEqual(opening);
    expect(session.line).toEqual([
      { tile: opening.tile, left: opening.tile[0], right: opening.tile[1] },
    ]);
    expect(session.toMove).toBe(opponentOf(opening.by));
    expect(session.moveCount).toBe(1);
    expect(session.passes).toBe(0);
    expect(session.status).toBe('playing');
    expect(session.boneyard).toEqual(deal.boneyard);
    expect(allTiles(session)).toHaveLength(TILE_COUNT);
    expect(new Set(allTiles(session)).size).toBe(TILE_COUNT);
  });

  it('opens from either hand, depending on the deal', () => {
    const openers = new Set<number>();
    for (let i = 0; i < 20; i++) openers.add(createSession(`dm-opener-${i}`).opening.by);
    expect([...openers].sort()).toEqual([PLAYER, CPU]);
  });
});

describe('an action (§3)', () => {
  it('must be a play when a tile fits: drawing and passing are refused', () => {
    const session = findPosition(
      'dm-must-play',
      (s) => s.toMove === PLAYER && hasLegalPlay(s.line, s.playerHand) && s.boneyard.length > 0,
    );
    expect(canDraw(session, PLAYER)).toBe(false);
    expect(draw(session, PLAYER)).toBeNull();
    expect(pass(session, PLAYER)).toBeNull();
  });

  it('places a fitting tile, hands the turn over and counts one move', () => {
    const session = findPosition(
      'dm-play',
      (s) => s.toMove === PLAYER && hasLegalPlay(s.line, s.playerHand),
    );
    const tile = session.playerHand.find((t) => legalEnds(session.line, t).length > 0)!;
    const end = legalEnds(session.line, tile)[0]!;
    const next = play(session, PLAYER, tile, end)!;
    expect(next.line).toHaveLength(session.line.length + 1);
    expect(next.playerHand).toHaveLength(session.playerHand.length - 1);
    expect(next.toMove).toBe(CPU);
    expect(next.moveCount).toBe(session.moveCount + 1);
    expect(allTiles(next)).toHaveLength(TILE_COUNT);
  });

  it('refuses a tile that does not fit, one not held, and play out of turn', () => {
    const session = findPosition('dm-refuse', (s) => s.toMove === PLAYER);
    const misfit = session.playerHand.find((t) => legalEnds(session.line, t).length === 0);
    if (misfit) expect(play(session, PLAYER, misfit, 'right')).toBeNull();
    const cpuTile = session.cpuHand[0]!;
    expect(play(session, PLAYER, cpuTile, 'right')).toBeNull();
    const fit = session.cpuHand.find((t) => legalEnds(session.line, t).length > 0);
    if (fit) expect(play(session, CPU, fit, legalEnds(session.line, fit)[0]!)).toBeNull();
  });

  it('draws the front tile only when stuck, and keeps the turn', () => {
    const session = findPosition(
      'dm-draw',
      (s) => s.toMove === PLAYER && !hasLegalPlay(s.line, s.playerHand) && s.boneyard.length > 0,
    );
    expect(canDraw(session, PLAYER)).toBe(true);
    expect(canPass(session, PLAYER)).toBe(false);
    expect(pass(session, PLAYER)).toBeNull();
    const next = draw(session, PLAYER)!;
    expect(next.playerHand[next.playerHand.length - 1]).toEqual(session.boneyard[0]);
    expect(next.boneyard).toEqual(session.boneyard.slice(1));
    expect(next.toMove).toBe(PLAYER);
    expect(next.moveCount).toBe(session.moveCount + 1);
  });

  it('passes only when stuck with the boneyard empty', () => {
    const session = findPosition(
      'dm-pass',
      (s) => s.toMove === PLAYER && !hasLegalPlay(s.line, s.playerHand) && s.boneyard.length === 0,
    );
    expect(canPass(session, PLAYER)).toBe(true);
    expect(draw(session, PLAYER)).toBeNull();
    const next = pass(session, PLAYER)!;
    expect(next.toMove).toBe(CPU);
    expect(next.passes).toBe(session.passes + 1);
  });
});

describe('the end of a game (§4)', () => {
  it('goes to the side that plays its last tile, scoring the other hand’s pips', () => {
    const session = at({
      line: lineOf([3, 5]),
      playerHand: [[5, 6]],
      cpuHand: [
        [0, 1],
        [2, 4],
      ],
      toMove: PLAYER,
    });
    const next = play(session, PLAYER, [5, 6], 'right')!;
    expect(next.status).toBe('won');
    expect(next.ending).toBe('out');
    expect(next.score).toBe(7);
    expect(next.cpuPips).toBe(7);
    expect(next.playerPips).toBe(0);

    const cpuOut = play({ ...session, toMove: CPU, cpuHand: [[1, 3]] }, CPU, [1, 3], 'left')!;
    expect(cpuOut.status).toBe('lost');
    expect(cpuOut.score).toBe(11);
  });

  it('resets the pass count on any play', () => {
    const session = at({
      line: lineOf([3, 5]),
      playerHand: [
        [5, 6],
        [0, 0],
      ],
      cpuHand: [[1, 2]],
      boneyard: [],
      toMove: PLAYER,
      passes: 1,
    });
    expect(play(session, PLAYER, [5, 6], 'right')!.passes).toBe(0);
  });

  it('is blocked by two passes in a row: the lower pip total wins the difference', () => {
    const stuck = at({
      line: lineOf([3, 5]),
      playerHand: [[0, 1]],
      cpuHand: [
        [0, 2],
        [4, 6],
      ],
      boneyard: [],
      toMove: PLAYER,
      passes: 0,
    });
    const once = pass(stuck, PLAYER)!;
    expect(once.status).toBe('playing');
    const blocked = pass(once, CPU)!;
    expect(blocked.status).toBe('won');
    expect(blocked.ending).toBe('blocked');
    expect(blocked.score).toBe(12 - 1);

    const heavier = pass(
      pass(
        {
          ...stuck,
          playerHand: [
            [6, 6],
            [4, 4],
          ],
        },
        PLAYER,
      )!,
      CPU,
    )!;
    expect(heavier.status).toBe('lost');
    expect(heavier.score).toBe(20 - 12);
  });

  it('is a draw when a blocked game leaves equal pips', () => {
    const level = at({
      line: lineOf([3, 5]),
      playerHand: [[1, 1]],
      cpuHand: [[0, 2]],
      boneyard: [],
      toMove: PLAYER,
    });
    const blocked = pass(pass(level, PLAYER)!, CPU)!;
    expect(blocked.status).toBe('draw');
    expect(blocked.ending).toBe('blocked');
    expect(blocked.score).toBe(0);
    expect(blocked.playerPips).toBe(2);
    expect(blocked.cpuPips).toBe(2);
  });

  it('accepts nothing once the game has ended', () => {
    const game = playThrough('dm-finished');
    const last = game[game.length - 1]!;
    expect(last.status).not.toBe('playing');
    expect(applyCpuAction(last)).toBeNull();
    expect(draw(last, last.toMove)).toBeNull();
    expect(pass(last, last.toMove)).toBeNull();
  });

  it('always ends, with every tile accounted for and the right score', () => {
    for (let i = 0; i < 60; i++) {
      const game = playThrough(`dm-end-${i}`);
      const last = game[game.length - 1]!;
      expect(last.status, `dm-end-${i}`).not.toBe('playing');
      expect(allTiles(last)).toHaveLength(TILE_COUNT);
      expect(new Set(allTiles(last)).size).toBe(TILE_COUNT);
      const pips = [pipTotal(last.playerHand), pipTotal(last.cpuHand)] as const;
      if (last.ending === 'out') {
        expect(last.score).toBe(last.status === 'won' ? pips[1] : pips[0]);
      } else {
        expect(last.passes).toBe(2);
        expect(last.boneyard).toHaveLength(0);
        expect(last.score).toBe(Math.abs(pips[0] - pips[1]));
      }
    }
  });
});
