/**
 * Board serialization for local persistence (docs/MANCALA_RULES.md §8).
 *
 * The board is stored as it is held: fourteen whole numbers in index order
 * (types.ts). A count can run past 9 — a store ends the game with up to 48 —
 * so there is no one-character-per-pit string to pack it into, and a plain
 * array is the form a person reading a backup can check by eye.
 *
 * Decoding fails closed: a board that could not exist (a wrong length, a
 * negative or fractional count, seeds made or lost along the way) is
 * discarded and the player goes back to the home screen rather than into an
 * invented position (§8). Whether the position is still in play is the
 * session's question (session.ts `restoreSession`), not this one's.
 */
import { isValidPits, type Pits } from './types';

export function encodePits(pits: Pits): number[] {
  return [...pits];
}

/** Decodes a persisted board, or null when it does not add up to one (§8). */
export function decodePits(value: unknown): Pits | null {
  if (!Array.isArray(value)) return null;
  const pits: unknown[] = [...value];
  return isValidPits(pits) ? pits : null;
}
