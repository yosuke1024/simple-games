/**
 * Golden deals: one daily and one pinned seed, exactly.
 *
 * A seed is a promise. The daily is the same deal for every player, and §5's
 * "retry the same deal" only means anything if the seed keeps producing the
 * deal the player was learning. Any change to the rng or the dealing order
 * will fail here, which is the point: it costs players their recorded bests
 * and their remembered deals, so it has to be a decision rather than a side
 * effect.
 *
 * If a change here is intended, regenerate the strings and say so in the
 * commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { boardToString, dealBoard } from './deal';
import { dailySeed } from './daily';

describe('deals that must never change', () => {
  it('the daily for 2026-08-01 is unchanged', () => {
    // stock/waste/foundations/tableau; piles joined by '.', down!up.
    expect(boardToString(dealBoard(dailySeed('2026-08-01')))).toBe(
      '0a1b1c1d0g0e191f0z090m0q150f0n0i0s0l0j0d0k0u050r//.../!0o.11!01.0c0y!0x.12020t!10.14170400!0b.0w0h03131a!0p.08060v1e0716!18',
    );
  });

  it('a pinned free seed is unchanged', () => {
    expect(boardToString(dealBoard('sol-free-golden'))).toBe(
      '0c080b0z160f0r1c19131f0w0q140m1b0d0n0j1a030h0u09//.../!1d.1e!11.0i0l!05.150602!0x.0k040a0e!12.0v100y0g0o!01.18000t070s17!0p',
    );
  });
});
