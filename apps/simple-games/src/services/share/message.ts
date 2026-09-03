/**
 * What a shared game says, and where it points (issue #86).
 *
 * Pure: it reads the registry's title, the player's catalog and the browser
 * version's address, and returns two strings. Nothing here touches the share
 * sheet, the clipboard, storage or the network — `share.ts` does that, and
 * keeps this side testable as plain data.
 *
 * WHAT A SHARED MESSAGE MAY CARRY, AND WHY IT IS SO LITTLE
 *
 * The game's name and a link at that game. That is the whole of it. No score,
 * no time, no hint count, no streak, no board — a share is a player handing a
 * game to somebody, not a scoreboard, and none of those numbers make the link
 * more useful to the person receiving it. Leaving them out is also the only
 * version of this feature that cannot leak a player's own record to a group
 * chat, so the restraint is a privacy property rather than a preference
 * (docs/PRIVACY_POLICY.md: nothing about a player leaves the device).
 *
 * The one thing the message does vary is whether it says "cleared" or
 * "played", and it may only say "cleared" when the game actually ended in a
 * win. A loss, a draw and the end of an endless run all say "played": a
 * message that let a player look like they had won something they had not
 * would be a small lie told in the product's voice.
 */
import { WEB_PLAY_URL } from '@simple-games/brand';
import type { MessageKey, TranslateVars } from '../../i18n';
import { GAMES, type GameId } from '../../app/registry';
import { GAME_PARAM } from '../../app/webRoute';

/**
 * How the run ended, as far as the sentence is concerned.
 *
 * `completed` is for results that are unambiguously a win or a clear;
 * `played` covers everything else — losses, draws, and the endless games that
 * simply stop. A result screen passes what actually happened, never the
 * flattering reading of it.
 */
export type ShareOutcome = 'completed' | 'played';

export interface ShareMessage {
  /** The sentences, in the player's language. */
  text: string;
  /** The link they are about: the browser version, opened at this game. */
  url: string;
}

/** A translate function — `useSettings().t`, or `translate` bound to a locale. */
export type Translate = (key: MessageKey, vars?: TranslateVars) => string;

/**
 * The browser version, opened straight at one game (issue #83): the same
 * `?game=<id>` contract `app/webRoute.ts` reads on arrival, so a shared link
 * lands on the game rather than on the collection.
 */
export function gamePlayUrl(gameId: GameId): string {
  const url = new URL(WEB_PLAY_URL);
  url.searchParams.set(GAME_PARAM, gameId);
  return url.toString();
}

/**
 * The title as the collection spells it. Titles are proper nouns and identical
 * in every language (app/registry.ts), which is what lets one pair of
 * sentences serve all fourteen locales instead of thirty per-game formatters.
 */
function titleOf(gameId: GameId): string {
  return GAMES.find((game) => game.id === gameId)?.title ?? gameId;
}

export function buildShareMessage(
  gameId: GameId,
  outcome: ShareOutcome,
  t: Translate,
): ShareMessage {
  const game = titleOf(gameId);
  const line = outcome === 'completed' ? t('shareCleared', { game }) : t('sharePlayed', { game });
  return { text: `${line}\n${t('shareInvite')}`, url: gamePlayUrl(gameId) };
}

/**
 * The message as one block of text, for targets that take no separate link —
 * the clipboard fallback. The share sheet gets `text` and `url` apart, because
 * an app that knows what a URL is can then make a preview out of it.
 */
export function shareMessageAsText({ text, url }: ShareMessage): string {
  return `${text}\n${url}`;
}
