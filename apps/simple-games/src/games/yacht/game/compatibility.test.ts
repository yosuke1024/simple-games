/**
 * Golden throws: what the dice show, for two fixed seeds, on the first three
 * throws of a game (docs/YACHT_RULES.md §4). And a golden match: what the
 * CPU does with a fixed seed against a fixed, simple player (§5).
 *
 * A saved game resumes on its seed and its throw count, and the throws still
 * to come are drawn from those two alone. If the draw changed, a sheet left
 * half-played would come back to different dice than the ones it was going to
 * get — and "the same seed gives the same dice" is the whole of what §4
 * promises.
 *
 * The middle throw keeps dice 1 and 4 (indices 0 and 3), so the case also
 * pins that a kept die keeps its face and that unkept dice take the draw's
 * face for their own position.
 *
 * This pins released behaviour; do not edit these arrays (or the CPU's
 * pinned sheet, below) to go green. If a change to the draw or the CPU is
 * intended, regenerate them and say so in the commit message, along with
 * what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import {
  applyCpuStep,
  createSession,
  cpuTotalOf,
  outcomeOf,
  roll,
  score,
  statusOf,
  toggleHold,
  toMove,
  totalOf,
  type YachtSession,
} from './session';
import { CATEGORIES } from './types';

function firstThrows(seed: string): number[][] {
  const throws: number[][] = [];
  let session: YachtSession = roll(createSession(seed), 'player')!;
  throws.push([...session.dice]);
  session = toggleHold(toggleHold(session, 'player', 0)!, 'player', 3)!;
  session = roll(session, 'player')!;
  throws.push([...session.dice]);
  session = roll(session, 'player')!;
  throws.push([...session.dice]);
  return throws;
}

describe('throws that must never change', () => {
  it('gives the same first three throws for one seed', () => {
    expect(firstThrows('yacht-golden-a')).toEqual([
      [6, 1, 4, 4, 1],
      [6, 2, 5, 4, 4],
      [6, 3, 3, 4, 3],
    ]);
  });

  it('gives the same first three throws for another seed', () => {
    expect(firstThrows('yacht-golden-b')).toEqual([
      [6, 2, 1, 4, 3],
      [6, 5, 5, 4, 4],
      [6, 1, 2, 4, 4],
    ]);
  });
});

/**
 * Plays a whole match on `seed`: the player keeps nothing, throws exactly
 * once a turn, and takes the first open box in `CATEGORIES` order whatever
 * the dice say — a fixed, simple opponent that puts the CPU through every
 * kind of turn (a full house early, a forced dump late) without itself
 * having any decision worth pinning. The CPU plays its own turns through
 * `applyCpuStep`, one beat at a time, exactly as `state/GameContext.tsx`
 * will drive it.
 */
function playGoldenMatch(seed: string): YachtSession {
  let session: YachtSession = createSession(seed);
  for (const category of CATEGORIES) {
    session = score(roll(session, 'player')!, 'player', category)!;
    while (statusOf(session) === 'playing' && toMove(session) === 'cpu') {
      session = applyCpuStep(session)!;
    }
  }
  return session;
}

describe('a match the CPU must always play the same way (§5)', () => {
  it('reaches the same finished sheet for both seats, from a fixed seed and a fixed player', () => {
    const session = playGoldenMatch('yacht-golden-cpu-1');
    expect(statusOf(session)).toBe('finished');
    // The player's sheet, taking the first open box every turn off one throw.
    expect(session.scores).toEqual([1, 2, 3, 4, 10, 12, 17, 0, 0, 0, 13, 0]);
    expect(totalOf(session)).toBe(62);
    // The CPU's sheet — this is the golden the CPU's own play is pinned by.
    expect(session.cpuScores).toEqual([1, 4, 6, 8, 20, 18, 17, 20, 0, 0, 22, 0]);
    expect(cpuTotalOf(session)).toBe(116);
    expect(outcomeOf(session)).toBe('lost');
    // Throws by both seats together, across the whole match (§4).
    expect(session.rollIndex).toBe(48);
  });
});
