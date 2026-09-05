/**
 * What counts as a match when somebody is looking for a game by name
 * (issue #122). The whole of it is a case-insensitive substring test against
 * the title the home is already showing.
 *
 * Deliberately no more than that: no fuzzy matching, no romaji/kana folding,
 * no tag or description index, no history, no ranking, and nothing asked of
 * the network. Somebody who types a name they already know should reach it;
 * that is the entire job, and every one of those additions would turn a
 * static filter over thirty short strings into something that has to be kept
 * current — which is exactly what the collection home refuses to be.
 *
 * **Language does not enter into it.** Game titles are proper nouns, identical
 * in every locale (registry.ts), so "the localized title" and "the title" are
 * the same string and nothing here has to know which language is on screen.
 * That is also why the folding is `toLowerCase` and not `toLocaleLowerCase`:
 * under a Turkish locale the latter maps `I` to `ı`, and a player typing
 * "MINESWEEPER" would stop matching Minesweeper. The titles are Latin proper
 * nouns; the locale-invariant mapping is the correct one for them.
 */
import { GAMES, GAME_CATEGORIES, type GameDefinition } from './registry';

/**
 * Every game in the order the collection home lists them — categories in
 * GAME_CATEGORIES order, registry order within each. Results keep that order
 * rather than ranking by where the match landed, so searching narrows the
 * list the player was just looking at instead of rearranging it. Derived from
 * the same two constants the home renders from, so it cannot drift from them.
 *
 * A game whose `category` is missing from GAME_CATEGORIES would be absent
 * here, exactly as it would be absent from the home; `gameSearch.test.ts`
 * pins the count against GAMES so that vanishing is loud.
 */
const HOME_ORDER: readonly GameDefinition[] = GAME_CATEGORIES.flatMap((category) =>
  GAMES.filter((game) => game.category === category.id),
);

/**
 * The games whose titles contain `query`, in home order. An empty query (or
 * one that is all whitespace) matches everything: the search screen opens on
 * the full list and typing narrows it, so clearing the field goes back to
 * every game rather than to an empty state.
 */
export function searchGames(query: string): readonly GameDefinition[] {
  const needle = query.trim().toLowerCase();
  if (needle === '') return HOME_ORDER;
  return HOME_ORDER.filter((game) => game.title.toLowerCase().includes(needle));
}
