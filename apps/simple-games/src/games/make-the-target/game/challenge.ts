/**
 * The problem's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/MAKE_THE_TARGET_RULES.md §16): the numbers as dealt (ascending, the
 * order the problem keeps them in) and the target, written
 * `<numbers joined by ,>=<target>` — `1,3,5,10=47` for the 2026-10-21 daily,
 * the pair compatibility.test.ts pins — through this game's own xmur3. Not a
 * guard against tampering: a check that two devices dealt the same problem,
 * so a generator that changed between versions cannot pair two different
 * problems under one Today challenge.
 *
 * Only the dealt problem is read. The slots move with every merge; the
 * problem's numbers and target never do, so the digest is the same in play,
 * after a restore and after the clear. The kept solution stays out (any
 * solution makes the same problem, and a bundled fallback may keep another
 * one), and so does the difficulty (the count and the range of the numbers
 * already say it; a daily is always Medium, §8).
 */
import { hashSeed } from './rng';
import type { Problem } from './types';

/** `tg` (the game's storage prefix, §10) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'tg1:';

/** The digest of a problem as dealt. */
export function boardDigest(problem: Pick<Problem, 'numbers' | 'target'>): string {
  const board = `${problem.numbers.join(',')}=${problem.target}`;
  return BOARD_DIGEST_PREFIX + hashSeed(board).toString(16).padStart(8, '0');
}

/** A session's digest — daily or Free Play: the dealt problem, never the slots in play. */
export function boardDigestOf(session: {
  readonly problem: Pick<Problem, 'numbers' | 'target'>;
}): string {
  return boardDigest(session.problem);
}
