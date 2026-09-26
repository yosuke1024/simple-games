/**
 * Golden throws: what the dice show, for two fixed seeds, on the first three
 * throws of a game (docs/YACHT_RULES.md §4).
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
 * This pins released behaviour; do not edit these arrays to go green. If a
 * change to the draw is intended, regenerate them and say so in the commit
 * message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { createSession, roll, toggleHold, type YachtSession } from './session';

function firstThrows(seed: string): number[][] {
  const throws: number[][] = [];
  let session: YachtSession = roll(createSession(seed))!;
  throws.push([...session.dice]);
  session = toggleHold(toggleHold(session, 0)!, 3)!;
  session = roll(session)!;
  throws.push([...session.dice]);
  session = roll(session)!;
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
