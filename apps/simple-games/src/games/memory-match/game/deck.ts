/**
 * Deck generation (docs/MEMORY_MATCH_RULES.md §5).
 *
 * Two seeded shuffles: one picks which symbols this board deals (so two easy
 * games rarely wear the same faces), one lays the pairs out. Everything
 * derives from the seed, so a date — or a retried board (§8) — is the same
 * layout on every device with no content pipeline.
 */
import { createRng, shuffled } from './rng';
import { LAYOUTS, SYMBOL_COUNT, type Deck, type Difficulty } from './types';

export function generateDeck(seed: string, difficulty: Difficulty): Deck {
  const layout = LAYOUTS[difficulty];
  const rng = createRng(seed);

  const pool: number[] = [];
  for (let symbol = 0; symbol < SYMBOL_COUNT; symbol++) pool.push(symbol);
  const dealt = shuffled(pool, rng).slice(0, layout.pairs);

  return shuffled([...dealt, ...dealt], rng);
}

/** Row-major string form, for persistence, golden tests and fixtures. */
export function deckToString(deck: Deck): string {
  return deck.map((value) => value.toString(36)).join('');
}
