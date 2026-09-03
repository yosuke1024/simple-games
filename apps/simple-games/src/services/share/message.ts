/**
 * What a shared game says, and where it points (issue #86; results added
 * 2026-09-03, docs/plans/2026-09-03-share-results-card.md).
 *
 * Pure: it reads the registry's title, the player's catalog and the browser
 * version's address, and returns two strings. Nothing here touches the share
 * sheet, the clipboard, storage or the network — `share.ts` does that, and
 * keeps this side testable as plain data.
 *
 * WHAT A SHARED MESSAGE CARRIES
 *
 * The game's name, the facts of the run the result screen already showed, and
 * a link at that game. The facts arrive from the result screen as short,
 * already-translated, already-formatted pairs (`details`) — the same strings
 * the player is looking at, never a second set computed here. That is what
 * keeps thirty games on one message shape without thirty formatters, and it
 * is also the honesty rule in code: a share can only repeat what the screen
 * said. Nothing about the player leaves the device except by this button, and
 * only what the button was handed.
 *
 * The one thing the sentence itself varies is whether it says "cleared" or
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

/**
 * One fact of the run, as the result screen showed it: `label` is the
 * translated caption ("Time", "Mistakes"), `value` the formatted figure
 * ("4:32", "0"). A detail with no label is a bare value, for a word that
 * needs no caption ("Expert", "Daily · 2026-09-03").
 *
 * Both halves are strings on purpose. The game formats them with the same
 * helpers its result card uses (ui/format.ts), so the share and the screen
 * cannot disagree, and this module never needs to know what a "move" is.
 */
export interface ShareDetail {
  label?: string;
  value: string;
}

/**
 * How many details a share may carry. Three fits one line of text and one row
 * on the picture card; a result screen with more facts than that passes the
 * ones that summarise the run — the headline figure first.
 */
export const MAX_SHARE_DETAILS = 3;

export interface ShareInput {
  gameId: GameId;
  outcome: ShareOutcome;
  /** The facts of the run, headline first. Empty when the run has none worth sending. */
  details: readonly ShareDetail[];
}

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
export function shareTitleOf(gameId: GameId): string {
  return GAMES.find((game) => game.id === gameId)?.title ?? gameId;
}

/** Trims to the allowed count and drops entries with nothing to say. */
export function usableDetails(details: readonly ShareDetail[]): ShareDetail[] {
  return details
    .filter((detail) => detail.value.trim() !== '')
    .slice(0, MAX_SHARE_DETAILS)
    .map((detail) => {
      const label = detail.label?.trim();
      return label ? { label, value: detail.value.trim() } : { value: detail.value.trim() };
    });
}

/** "Time 4:32" — or just "4:32" when there is nothing to caption it with. */
export function formatDetail({ label, value }: ShareDetail): string {
  return label ? `${label} ${value}` : value;
}

/** The details as one line: "Time 4:32 · Mistakes 0 · Hints 0". */
export function formatDetailLine(details: readonly ShareDetail[]): string {
  return usableDetails(details).map(formatDetail).join(' · ');
}

export function buildShareMessage(
  { gameId, outcome, details }: ShareInput,
  t: Translate,
): ShareMessage {
  const game = shareTitleOf(gameId);
  const line = outcome === 'completed' ? t('shareCleared', { game }) : t('sharePlayed', { game });
  const facts = formatDetailLine(details);
  // With a result to look at, the closing line is a nudge to try; without
  // one it stays the plain invitation, since there is nothing to beat.
  const closing = facts ? t('shareChallenge') : t('shareInvite');
  const text = facts ? `${line}\n${facts}\n${closing}` : `${line}\n${closing}`;
  return { text, url: gamePlayUrl(gameId) };
}

/**
 * The message as one block of text, for targets that take no separate link —
 * the clipboard fallback. The share sheet gets `text` and `url` apart, because
 * an app that knows what a URL is can then make a preview out of it.
 */
export function shareMessageAsText({ text, url }: ShareMessage): string {
  return `${text}\n${url}`;
}
