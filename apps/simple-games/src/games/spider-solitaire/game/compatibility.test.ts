/**
 * Golden deals — the v2 (Spiderette) contract for Spider's generator.
 *
 * These strings pin the whole chain at once: the PRNG, the exact shape of the
 * seed strings, the shuffle of 52 cards, and the order they are laid into the
 * seven columns. Any change to any of them shows up here.
 *
 * The 2026-11-07 change deliberately starts a separate layout and record namespace.
 * The old 104-card records remain archived and are never replayed by this generator.
 *
 * If this test fails, the thing to fix is the implementation, not the
 * expectation. Regenerating these strings changes which deal a date produces
 * and which deal a saved seed replays — it silently rewrites games players
 * have already recorded a best against. Doing it anyway is a decision to make
 * deliberately and to state in the commit message, including what it costs
 * them.
 */
import { describe, expect, it } from 'vitest';
import { dailySeed } from './daily';
import { boardToString, dealBoard } from './deal';
import type { SuitCount } from './types';

/** The free deal at one suit. The leading field is the difficulty. */
const GOLDEN_FREE =
  '1/020f15070a0o160j1706130n0g0u090r190d0t0z0h1a180b//!1e.0v!08.110y!0i.0k011c!14.1b030p1d!0e.0s0l0x0w0m!00.100q120c0504!1f';

const GOLDEN_DAILY =
  '4/0o1f06170n0x190q180u0s0l140f0w020a0r010d0v110e0y//!12.0t!1a.071b!0p.0m0g1d!0c.08091e04!0k.0j03130i05!15.10160h000z1c!0b';

describe('deal compatibility (v2 (Spiderette))', () => {
  it('pins a fixed free deal', () => {
    expect(boardToString(dealBoard('ss-spiderette-free-golden', 1))).toBe(GOLDEN_FREE);
  });

  it('pins the daily deal for a fixed date', () => {
    expect(boardToString(dealBoard(dailySeed('2026-08-07'), 4))).toBe(GOLDEN_DAILY);
  });

  /**
   * The unique-card encoding's whole purpose, stated as a contract: the
   * difficulty changes what a card reads as, never where it lies. Break this
   * and one daily deal stops serving all three settings — and every recorded
   * best at two or four suits starts referring to a different game.
   */
  it('lays identical cards at every difficulty, changing only the suits they read as', () => {
    for (const suitCount of [2, 4] as SuitCount[]) {
      expect(boardToString(dealBoard('ss-spiderette-free-golden', suitCount))).toBe(
        `${suitCount}${GOLDEN_FREE.slice(1)}`,
      );
    }
  });
});
