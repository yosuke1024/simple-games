/**
 * Deck generation (docs/MEMORY_MATCH_RULES.md §5) and the fail-closed
 * serialization behind §10.
 */
import { describe, expect, it } from 'vitest';
import { generateDeck } from './deck';
import { decodeDeck, decodeMatched, encodeDeck, encodeMatched } from './serialize';
import { isValidDeck, LAYOUTS } from './types';

describe('generateDeck', () => {
  it('deals every symbol exactly twice at every difficulty', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const deck = generateDeck(`t-${difficulty}`, difficulty);
      expect(isValidDeck(deck, LAYOUTS[difficulty])).toBe(true);
    }
  });

  it('is deterministic per seed and varies across seeds', () => {
    expect(generateDeck('seed-a', 'medium')).toEqual(generateDeck('seed-a', 'medium'));
    expect(generateDeck('seed-a', 'medium')).not.toEqual(generateDeck('seed-b', 'medium'));
  });

  it('varies which symbols the smaller boards deal', () => {
    // Ten easy decks should not all agree on their six symbols; symbol choice
    // is part of the shuffle (§5).
    const draws = new Set<string>();
    for (let i = 0; i < 10; i++) {
      const symbols = [...new Set(generateDeck(`vary-${i}`, 'easy'))].sort((a, b) => a - b);
      draws.add(symbols.join(','));
    }
    expect(draws.size).toBeGreaterThan(1);
  });
});

describe('deck serialization', () => {
  it('round-trips a deck', () => {
    const deck = generateDeck('round-trip', 'hard');
    expect(decodeDeck(encodeDeck(deck), 'hard')).toEqual(deck);
  });

  it('fails closed on wrong length, bad characters, and broken pairings', () => {
    const deck = generateDeck('closed', 'easy');
    const text = encodeDeck(deck);
    expect(decodeDeck(text.slice(1), 'easy')).toBeNull();
    expect(decodeDeck(`!${text.slice(1)}`, 'easy')).toBeNull();
    // Two cells swapped to the same symbol: counts break, must not load.
    const uneven = [...deck];
    const other = uneven.findIndex((value) => value !== uneven[0]);
    uneven[other] = uneven[0]!;
    expect(decodeDeck(encodeDeck(uneven), 'easy')).toBeNull();
  });
});

describe('matched serialization', () => {
  it('round-trips matched flags', () => {
    const deck = generateDeck('matched', 'easy');
    const matched = deck.map(() => false);
    const symbol = deck[0]!;
    for (let i = 0; i < deck.length; i++) if (deck[i] === symbol) matched[i] = true;
    expect(decodeMatched(encodeMatched(matched), deck)).toEqual(matched);
  });

  it('rejects a half-matched pair (§3: pairs are found together)', () => {
    const deck = generateDeck('half', 'easy');
    const matched = deck.map(() => false);
    matched[0] = true;
    expect(decodeMatched(encodeMatched(matched), deck)).toBeNull();
  });

  it('rejects wrong length and foreign characters', () => {
    const deck = generateDeck('reject', 'easy');
    expect(decodeMatched('01', deck)).toBeNull();
    expect(decodeMatched('2'.repeat(deck.length), deck)).toBeNull();
  });
});
