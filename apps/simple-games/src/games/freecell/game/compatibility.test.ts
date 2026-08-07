/**
 * Golden deals — the v1 contract for FreeCell's generator.
 *
 * These two strings pin the whole chain at once: the PRNG, the exact shape of
 * the seed strings, the shuffle, and the order cards are laid into the eight
 * columns. Any change to any of them shows up here.
 *
 * If this test fails, the thing to fix is the implementation, not the
 * expectation. Regenerating these strings changes which deal a date produces
 * and which deal a saved seed replays — it silently rewrites games players
 * have already recorded a best time against. Doing it anyway is a decision to
 * make deliberately and to state in the commit message, including what it
 * costs them.
 */
import { describe, expect, it } from 'vitest';
import { dailySeed } from './daily';
import { boardToString, dealBoard } from './deal';

describe('deal compatibility (v1)', () => {
  it('pins the daily deal for a fixed date', () => {
    expect(boardToString(dealBoard(dailySeed('2026-08-07')))).toBe(
      '--.--.--.--/.../0o06110v0l0u0b.1f0m160g0y0f17.0p010d02070j0a.0t0x1e0k0r030n.05150w140908.0c0i0q191c1a.0h0413181d0e.000s120z1b10',
    );
  });

  it('pins a fixed free deal', () => {
    expect(boardToString(dealBoard('fc-free-golden'))).toBe(
      '--.--.--.--/.../080p0s040i0f0v.060o13160l0a02.1119150j0m1209.031e010g0z180y.051f0c140h0b.0u1d000t0n0r.0x0d1c10071b.0q0w0k171a0e',
    );
  });
});
