/**
 * Golden deals — the v1 contract for Spider's generator.
 *
 * These strings pin the whole chain at once: the PRNG, the exact shape of the
 * seed strings, the shuffle of 104 cards, and the order they are laid into the
 * ten columns. Any change to any of them shows up here.
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
  '1/2e010p1t071c1i1s0g2n0i0d1z1a0b0n1b2u271v0e251e0q1h261l242d1y0v1228292k1w0l0o1f0r2g2a182r05130a1q170f//1j2v2l1p1n!0t.1r2c0c211x!1g.2m031u2i02!09.0u2j1k0x1m!2p.1d0s2q0j!16.2f0k200m!1o.150z2t2h!2o.2s041022!0w.2b061923!14.000y080h!11';

const GOLDEN_DAILY =
  '4/012o2s222n2820182d0x2p150q1u2r0e1p172j060s140k08260w0t1s1v100j240b0m1l190z0p092v210l2k020n232m1y0f1f//2c1x0o0g2q!13.071h0y2h2u!1n.0r1c1r1k1j!2a.2i272t1g0d!2b.1a11041e!03.0c160i00!1d.1b0v120u!2f.1t2l051i!1z.291q2g0h!1m.251w2e1o!0a';

describe('deal compatibility (v1)', () => {
  it('pins a fixed free deal', () => {
    expect(boardToString(dealBoard('ss-free-golden', 1))).toBe(GOLDEN_FREE);
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
      expect(boardToString(dealBoard('ss-free-golden', suitCount))).toBe(
        `${suitCount}${GOLDEN_FREE.slice(1)}`,
      );
    }
  });
});
