/**
 * The jump list as it is persisted (docs/PEG_SOLITAIRE_RULES.md §11).
 *
 * A saved game is its problem plus the jumps played, each jump stored as the
 * pair [from, to] of hole indices — the hole jumped over is implied by the
 * two (the middle of a straight line). A plain array of small whole numbers
 * is the form a person reading a backup can check by eye, and it is also the
 * strongest validation there is: restoring replays every jump through the
 * rules (session.ts `restoreSession`), so a position that play could not
 * have produced cannot be restored at all.
 *
 * Decoding here checks only the shape — an array of at most
 * `holes − 2` pairs of hole indices (a game that starts with `holes − 1` pegs
 * and ends with at least one has no room for more jumps). Whether each jump
 * was legal where it was played is the replay's question, not this one's.
 */
import { isHole, type BoardGeometry } from './boards';
import type { Jump } from './types';

export type StoredJump = readonly [from: number, to: number];

export function encodeJumps(jumps: readonly Jump[]): [number, number][] {
  return jumps.map((jump) => [jump.from, jump.to]);
}

/** The most jumps one game on this board can hold. */
export const maxJumps = (geometry: BoardGeometry): number => geometry.holes.length - 2;

/** Decodes a persisted jump list's shape, or null when it is not one (§11). */
export function decodeJumps(value: unknown, geometry: BoardGeometry): StoredJump[] | null {
  if (!Array.isArray(value) || value.length > maxJumps(geometry)) return null;
  const jumps: StoredJump[] = [];
  for (const entry of value as unknown[]) {
    if (!Array.isArray(entry) || entry.length !== 2) return null;
    const [from, to] = entry as unknown[];
    if (!isHole(geometry, from) || !isHole(geometry, to)) return null;
    jumps.push([from, to]);
  }
  return jumps;
}
