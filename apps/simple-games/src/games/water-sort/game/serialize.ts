/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/WATER_SORT_RULES.md §10).
 *
 * One base-36 character per unit, bottom-to-top, tubes joined by '.'; an
 * empty tube is an empty segment. A nine-color board is therefore at most
 * 36 + 10 characters.
 *
 * Decoding fails closed: the board must hold exactly a tube's worth of every
 * color in the right number of tubes (types.ts) — anything else cannot have
 * come from play, and loading it would hand the player a board with no
 * ending.
 */
import { isValidTubes, type Tube, type Tubes } from './types';

export function encodeTubes(tubes: Tubes): string {
  return tubes.map((tube) => tube.map((color) => color.toString(36)).join('')).join('.');
}

/** Decodes a persisted board. Returns null when anything does not add up. */
export function decodeTubes(text: string, colors: number): Tubes | null {
  if (typeof text !== 'string') return null;

  const tubes: Tube[] = [];
  for (const segment of text.split('.')) {
    const tube: number[] = [];
    for (const character of segment) {
      const value = parseInt(character, 36);
      if (!Number.isInteger(value)) return null;
      tube.push(value);
    }
    tubes.push(tube);
  }
  return isValidTubes(tubes, colors) ? tubes : null;
}
