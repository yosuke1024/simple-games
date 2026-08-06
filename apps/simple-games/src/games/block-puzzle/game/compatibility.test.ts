/**
 * Golden batches: one pinned seed, exactly.
 *
 * A seed is a promise. A suspended game stores its seed and its refill
 * counter (§10) and reads the tray back from them, and undo is only a step
 * back rather than a reroll because the same pair always draws the same three
 * pieces (§7). Any change to the rng, to the catalogue's order, or to the way
 * the batch key is built will fail here, which is the point: it costs players
 * the game they left open, so it has to be a decision rather than a side
 * effect.
 *
 * This pins released behaviour; do not edit it to go green. If a change here
 * is intended, regenerate the ids and say so in the commit message, along
 * with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { drawBatch, PIECES } from './pieces';
import { createSession } from './session';

describe('batches that must never change', () => {
  it('deals the pinned seed the same first two batches', () => {
    // Catalogue ids (pieces.ts), in slot order.
    expect(drawBatch('block-golden', 0)).toEqual([6, 3, 0]);
    expect(drawBatch('block-golden', 1)).toEqual([11, 1, 14]);
  });

  it('starts the pinned seed on that first batch', () => {
    const session = createSession('block-golden');
    expect(session.tray).toEqual([6, 3, 0]);
  });

  it('still has nineteen shapes to draw from', () => {
    // The ids above are indices into this list; a shape inserted anywhere but
    // the end re-deals every board the seed has ever produced (§6).
    expect(PIECES).toHaveLength(19);
  });
});
