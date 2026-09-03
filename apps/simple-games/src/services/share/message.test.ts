/**
 * What a shared message is allowed to say (issue #86).
 *
 * Two of these tests are the feature's promises rather than its behaviour: a
 * link must open the game it names (#83), and a message must never carry the
 * run's numbers. Both are the kind of thing that breaks by someone helpfully
 * adding a score to the sentence, so they are pinned here.
 */
import { describe, expect, it } from 'vitest';
import { WEB_PLAY_URL } from '@simple-games/brand';
import { GAMES, type GameId } from '../../app/registry';
import { gameIdFromHref } from '../../app/webRoute';
import { translate, type MessageKey, type TranslateVars } from '../../i18n';
import { catalogs, type Locale } from '../../i18n';
import { buildShareMessage, gamePlayUrl, shareMessageAsText } from './message';

const t =
  (locale: Locale) =>
  (key: MessageKey, vars?: TranslateVars): string =>
    translate(locale, key, vars);

const en = t('en');

describe('the link', () => {
  it('is the browser version opened at that game', () => {
    expect(gamePlayUrl('sudoku')).toBe(`${WEB_PLAY_URL}?game=sudoku`);
  });

  it('round-trips through the router for every game in the collection', () => {
    // The shell reads arriving links with gameIdFromHref; a link this builder
    // makes has to be one of those, for all thirty titles and whatever comes
    // after them.
    for (const game of GAMES) {
      expect(gameIdFromHref(gamePlayUrl(game.id)), game.id).toBe(game.id);
    }
  });
});

describe('the message', () => {
  it('says "cleared" only for a result that was actually a clear', () => {
    const cleared = buildShareMessage('sudoku', 'completed', en);
    const played = buildShareMessage('sudoku', 'played', en);
    expect(cleared.text).toContain('cleared');
    expect(played.text).not.toContain('cleared');
    expect(played.text).toContain('played');
  });

  it('names the game by its registry title, in every language', () => {
    for (const locale of Object.keys(catalogs) as Locale[]) {
      const message = buildShareMessage('mahjong-solitaire', 'played', t(locale));
      expect(message.text, locale).toContain('Mahjong Solitaire');
    }
  });

  it('carries no number from the run, in any language', () => {
    // Score, time, mistakes, hints, streak: none of them is passed in, so none
    // of them can appear. The only digits allowed are the ones in a title.
    const numeric = new Set<GameId>(['2048']);
    for (const locale of Object.keys(catalogs) as Locale[]) {
      for (const game of GAMES) {
        if (numeric.has(game.id)) continue;
        for (const outcome of ['completed', 'played'] as const) {
          const message = buildShareMessage(game.id, outcome, t(locale));
          expect(message.text, `${locale}/${game.id}/${outcome}`).not.toMatch(/\d/);
        }
      }
    }
  });

  it('is two sentences and a link, and the link is separate', () => {
    const message = buildShareMessage('sudoku', 'played', en);
    expect(message.text.split('\n')).toHaveLength(2);
    // The share sheet gets text and url apart so a target can preview the
    // link; the clipboard fallback needs them as one block.
    expect(message.text).not.toContain(message.url);
    expect(shareMessageAsText(message)).toBe(`${message.text}\n${message.url}`);
  });
});
