/**
 * Which of packages/brand's `titleAccents` a game wears, looked up by id.
 *
 * The kebab-case game id to the camelCase key `titleAccents` uses
 * ('number-match' -> 'numberMatch', 'freecell' -> 'freecell'). '2048' is the
 * one id that cannot camel-case itself — not a legal identifier fragment —
 * so its accent is named 'game2048'.
 *
 * This lived in services/share/card.ts until the Android home-screen
 * shortcut (issue #110) needed the same answer to draw its icon. Two drawings
 * of one tile must agree on the colour, so the lookup sits beside the
 * registry now and both draw from it. ui/styles.css maps the same ids to the
 * same values by hand (`.accent-<id>`); services/share/card.test.ts checks
 * that every game in the registry has an entry here.
 */
import { titleAccents, type TitleAccent } from '@simple-games/brand';
import type { GameId } from './registry';

export type TitleAccentKey = keyof typeof titleAccents;

export function accentKeyOf(gameId: GameId): TitleAccentKey {
  if (gameId === '2048') return 'game2048';
  return gameId.replace(/-([a-z0-9])/g, (_match, ch: string) => ch.toUpperCase()) as TitleAccentKey;
}

/** The accent itself: the six colours a title is painted with. */
export function titleAccentOf(gameId: GameId): TitleAccent {
  return titleAccents[accentKeyOf(gameId)];
}
