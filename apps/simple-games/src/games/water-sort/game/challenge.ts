/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/WATER_SORT_RULES.md §14): the starting tubes, in the string form the
 * golden tests write, through this game's own xmur3. Not a guard against
 * tampering — it travels with a ranking result as the optional `boardDigest`,
 * so a generator that changed between versions is visible to the Club.
 *
 * A session's tubes move with every pour, so the digest is taken from the
 * board rebuilt from the session's own inputs (Restart's board): the same for
 * a fresh deal, a resumed one and a finished one.
 */
import { DAILY_COLORS, DAILY_MIX } from './daily';
import { tubesToString } from './generator';
import { colorsForLevel, FREE_TIER_LEVEL, FREE_TIERS, mixForLevel, type FreeTier } from './levels';
import { hashSeed } from './rng';
import {
  createDailySession,
  createFreeSession,
  createLevelSession,
  type WaterSession,
} from './session';
import type { Tubes } from './types';

/** `ws` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'ws1:';

export function boardDigest(initialTubes: Tubes): string {
  return BOARD_DIGEST_PREFIX + hashSeed(tubesToString(initialTubes)).toString(16).padStart(8, '0');
}

/** What names a board: everything a session carries except the play on it. */
export type BoardIdentity = Pick<
  WaterSession,
  'mode' | 'seed' | 'level' | 'dailyDate' | 'freeTier'
>;

/** The board's starting tubes, dealt again from its identity (Restart's deal). */
function initialTubesOf(board: BoardIdentity): Tubes {
  if (board.mode === 'level' && board.level !== null) return createLevelSession(board.level).tubes;
  if (board.mode === 'daily') return createDailySession(board.dailyDate ?? '').tubes;
  const tier = board.freeTier ?? 'medium';
  return createFreeSession(tier, board.seed).tubes;
}

/** Any board's digest — level, daily or free — from its starting deal. */
export function boardDigestOf(board: BoardIdentity): string {
  return boardDigest(initialTubesOf(board));
}

/**
 * The ranking tier this board's result belongs to (§14), or null when no
 * tier deals it. The ranking is kept per tier (club.md §6-1), and a tier is
 * one level's colour count and starting mix (levels.ts). A free board has its
 * tier. A level board has one only when its colours and mix are exactly a
 * tier's — the tier's own representative level — and the daily's six colours
 * at an even mix match none. Nearest would put a result in a table of a
 * different difficulty — other colours, another mix — so there is no nearest:
 * no tier, nothing sent.
 */
export function challengeTierOf(board: BoardIdentity): FreeTier | null {
  if (board.mode === 'free') return board.freeTier;
  const level = board.mode === 'level' ? board.level : null;
  const colors = level !== null ? colorsForLevel(level) : DAILY_COLORS;
  const mix = level !== null ? mixForLevel(level) : DAILY_MIX;
  return (
    FREE_TIERS.find(
      (tier) =>
        colorsForLevel(FREE_TIER_LEVEL[tier]) === colors &&
        mixForLevel(FREE_TIER_LEVEL[tier]) === mix,
    ) ?? null
  );
}
