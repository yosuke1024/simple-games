/**
 * The board's identity for a Club House challenge (docs/architecture/club.md
 * §6-4, docs/MINESWEEPER_RULES.md §14): the mine bits after the first tap, as
 * the golden tests write them, through this game's own xmur3. Not a guard
 * against tampering — a check that two devices laid the same mines from the
 * same seed and first cell, so a generator that changed between versions
 * cannot pair two different minefields under one challenge.
 */
import type { Board } from './engine';
import { hashSeed } from './rng';
import { encodeBoard } from './serialize';

/** `ms` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'ms1:';

export function boardDigest(board: Board): string {
  return BOARD_DIGEST_PREFIX + hashSeed(encodeBoard(board).mines).toString(16).padStart(8, '0');
}

/**
 * Any session's digest — difficulty, daily or club. The mines never move once
 * the first tap has laid them; a board that has not been tapped yet has none,
 * and no result screen ever shows one.
 */
export function boardDigestOf(session: { readonly board: Board }): string {
  return boardDigest(session.board);
}
