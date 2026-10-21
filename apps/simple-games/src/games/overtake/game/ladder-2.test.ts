// @vitest-environment node
/**
 * The skill ladder (docs/OVERTAKE_RULES.md §6, §16), blocks 4, 5, 6, 7 — split
 * across three files only so the runs spread over the test workers.
 * A smoke test: every tier wins 200 of 200 in every block (§6, §16), so the
 * monotonicity holds only as a tie and separates nothing — B is nearly A. Per
 * block, win rates must not rise as skill falls (advanced ≥ intermediate ≥
 * novice).
 */
import { expect, it } from 'vitest';
import { LADDER_SEEDS, ladderWins, report } from './test-helpers';

const BLOCKS = [4, 5, 6, 7];

it('smoke (saturated, not evidence of skill sensitivity): ladder monotone in blocks 4, 5, 6, 7', async () => {
  const wins = await ladderWins(BLOCKS);
  BLOCKS.forEach((block, i) => {
    const a = wins.advanced[i]!;
    const m = wins.intermediate[i]!;
    const n = wins.novice[i]!;
    report(
      `ladder block ${block} (Lv${block * 10 - 9}–${block * 10}), wins of ${LADDER_SEEDS * 10}`,
      `advanced ${a}`,
      `intermediate ${m}`,
      `novice ${n}`,
    );
    expect(a, `block ${block}`).toBeGreaterThanOrEqual(m);
    expect(m, `block ${block}`).toBeGreaterThanOrEqual(n);
  });
}, 120_000);
