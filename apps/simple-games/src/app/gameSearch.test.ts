/**
 * The filter behind the collection home's search (issue #122). What is worth
 * pinning here is not that `includes` works — it is the four decisions the
 * function makes on top of it: which strings it looks at, how it folds case,
 * what an empty query means, and what order the survivors come back in.
 */
import { describe, expect, it } from 'vitest';
import { GAMES, GAME_CATEGORIES } from './registry';
import { searchGames } from './gameSearch';

const titles = (query: string) => searchGames(query).map((game) => game.title);

describe('searching the collection by name', () => {
  it('matches a whole title', () => {
    expect(titles('Sudoku')).toEqual(['Sudoku']);
  });

  it('matches part of a title, anywhere in it', () => {
    // The three patiences are exactly why the match is not anchored at the
    // front: two of them wear the word somebody is looking for in second
    // place.
    expect(titles('Solitaire')).toEqual(['Solitaire', 'Spider Solitaire', 'Mahjong Solitaire']);
    expect(titles('sweep')).toEqual(['Minesweeper']);
  });

  it('ignores case in either direction', () => {
    expect(titles('SPIDER')).toEqual(['Spider Solitaire']);
    expect(titles('freecell')).toEqual(['FreeCell']);
    expect(titles('fReEcElL')).toEqual(['FreeCell']);
  });

  it('matches a title that is a number', () => {
    expect(titles('2048')).toEqual(['2048']);
  });

  it('ignores the whitespace around the query, and the query that is only whitespace', () => {
    expect(titles('  hearts ')).toEqual(['Hearts']);
    expect(searchGames('   ')).toHaveLength(GAMES.length);
  });

  it('returns nothing for a name no game has', () => {
    expect(searchGames('chess')).toEqual([]);
  });

  /**
   * The screen opens on this list and narrows it as somebody types, so an
   * empty query has to be every game rather than an empty state. It is also
   * the check that no game falls out of search entirely: a game whose
   * `category` is missing from GAME_CATEGORIES would be absent here, exactly
   * as it would be absent from the home.
   */
  it('returns every game, once, while nothing is typed', () => {
    const all = searchGames('');
    expect(all).toHaveLength(GAMES.length);
    expect(new Set(all.map((game) => game.id)).size).toBe(GAMES.length);
  });

  it('keeps the order the home lists them in: categories, then registry order', () => {
    const homeOrder = GAME_CATEGORIES.flatMap((category) =>
      GAMES.filter((game) => game.category === category.id).map((game) => game.title),
    );
    expect(titles('')).toEqual(homeOrder);
    // And a filtered list is that same order with the misses removed — never
    // re-ranked by where the match landed in the title.
    expect(titles('e')).toEqual(homeOrder.filter((title) => title.toLowerCase().includes('e')));
  });

  /**
   * Turkish is the one locale where case folding is not a detail: its own
   * rules map `I` to `ı`, which would leave somebody who typed in capitals
   * with no Minesweeper at all. Titles are Latin proper nouns, so the
   * locale-invariant fold is the correct one — and this is the test that
   * fails if `toLocaleLowerCase` is ever "fixed" back in.
   */
  it('folds case the same way whatever the device language is', () => {
    expect(titles('MINESWEEPER')).toEqual(['Minesweeper']);
    expect(titles('LUDO')).toEqual(['Ludo']);
  });
});
