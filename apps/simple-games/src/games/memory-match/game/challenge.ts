/**
 * The board's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/MEMORY_MATCH_RULES.md §14): the layout and the deck, in the string form
 * the golden tests write, through this game's own xmur3. Not a guard against
 * tampering — a check that two devices dealt the same cards, so a generator
 * that changed between versions cannot pair two different boards under one
 * Today challenge.
 */
import { deckToString } from './deck';
import { hashSeed } from './rng';
import type { Deck, Difficulty } from './types';

/** `mm` + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'mm1:';

export function boardDigest(difficulty: Difficulty, deck: Deck): string {
  return (
    BOARD_DIGEST_PREFIX +
    hashSeed(`${difficulty}:${deckToString(deck)}`)
      .toString(16)
      .padStart(8, '0')
  );
}

/**
 * Any session's digest. The deck is dealt once and never moves — what is
 * matched and face up are separate fields — so this is the starting board
 * however far the game has gone.
 */
export function boardDigestOf(session: {
  readonly difficulty: Difficulty;
  readonly deck: Deck;
}): string {
  return boardDigest(session.difficulty, session.deck);
}
