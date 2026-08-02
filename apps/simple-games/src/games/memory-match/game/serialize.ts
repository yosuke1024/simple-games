/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/MEMORY_MATCH_RULES.md §10).
 *
 * The deck is one base-36 character per cell (symbol indices stop well short
 * of 36); the matched cells are one '0'/'1' per cell. A whole hard board is
 * therefore 30 + 30 characters.
 *
 * Decoding fails closed: the deck must be a true pairing (§1) and the matched
 * cells must cover whole pairs — a record where half a pair is "found" cannot
 * have come from play (§3), so it is corrupt rather than merely odd.
 */
import { cellCount, isValidDeck, LAYOUTS, type Deck, type Difficulty } from './types';

export function encodeDeck(deck: Deck): string {
  return deck.map((value) => value.toString(36)).join('');
}

/** Decodes a persisted deck. Returns null when anything does not add up. */
export function decodeDeck(text: string, difficulty: Difficulty): Deck | null {
  const layout = LAYOUTS[difficulty];
  if (typeof text !== 'string' || text.length !== cellCount(layout)) return null;

  const deck: number[] = [];
  for (const character of text) {
    const value = parseInt(character, 36);
    if (!Number.isInteger(value)) return null;
    deck.push(value);
  }
  return isValidDeck(deck, layout) ? deck : null;
}

export function encodeMatched(matched: readonly boolean[]): string {
  return matched.map((flag) => (flag ? '1' : '0')).join('');
}

/** Decodes matched flags against their deck. Null when they cannot be real. */
export function decodeMatched(text: string, deck: Deck): readonly boolean[] | null {
  if (typeof text !== 'string' || text.length !== deck.length) return null;

  const matched: boolean[] = [];
  for (const character of text) {
    if (character !== '0' && character !== '1') return null;
    matched.push(character === '1');
  }

  // Pairs are found together (§3): a symbol's two cells are matched both or
  // neither. One without the other is corruption, not history.
  const matchedBySymbol = new Map<number, number>();
  for (let i = 0; i < deck.length; i++) {
    if (matched[i]) {
      const symbol = deck[i]!;
      matchedBySymbol.set(symbol, (matchedBySymbol.get(symbol) ?? 0) + 1);
    }
  }
  for (const count of matchedBySymbol.values()) if (count !== 2) return null;
  return matched;
}
