/**
 * What a shared message is allowed to say (issue #86).
 *
 * A link must open the game it names (#83) — the kind of thing that breaks
 * quietly if the route or the query param ever drifts, so it is pinned here
 * for every title rather than trusted from one example.
 */
import { describe, expect, it } from 'vitest';
import { WEB_PLAY_URL } from '@simple-games/brand';
import { GAMES } from '../../app/registry';
import { gameIdFromHref } from '../../app/webRoute';
import { translate, type MessageKey, type TranslateVars } from '../../i18n';
import { catalogs, type Locale } from '../../i18n';
import { buildShareMessage, gamePlayUrl, MAX_SHARE_DETAILS, shareMessageAsText } from './message';

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
    const cleared = buildShareMessage({ gameId: 'sudoku', outcome: 'completed', details: [] }, en);
    const played = buildShareMessage({ gameId: 'sudoku', outcome: 'played', details: [] }, en);
    expect(cleared.text).toContain('cleared');
    expect(played.text).not.toContain('cleared');
    expect(played.text).toContain('played');
  });

  it('names the game by its registry title, in every language', () => {
    for (const locale of Object.keys(catalogs) as Locale[]) {
      const message = buildShareMessage(
        { gameId: 'mahjong-solitaire', outcome: 'played', details: [] },
        t(locale),
      );
      expect(message.text, locale).toContain('Mahjong Solitaire');
    }
  });

  it('is two lines and ends with the invite when there are no details', () => {
    const message = buildShareMessage({ gameId: 'sudoku', outcome: 'played', details: [] }, en);
    const lines = message.text.split('\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe(en('shareInvite'));
  });

  it('is three lines and ends with the challenge when there are details', () => {
    const message = buildShareMessage(
      { gameId: 'sudoku', outcome: 'played', details: [{ label: 'Time', value: '4:32' }] },
      en,
    );
    const lines = message.text.split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toBe(en('shareChallenge'));
  });

  it('puts the details on their own line, joined by " · "', () => {
    const message = buildShareMessage(
      {
        gameId: 'sudoku',
        outcome: 'completed',
        details: [{ label: 'Time', value: '4:32' }, { value: 'Expert' }],
      },
      en,
    );
    expect(message.text.split('\n')[1]).toBe('Time 4:32 · Expert');
  });

  it('trims to MAX_SHARE_DETAILS and drops entries with an empty value', () => {
    const message = buildShareMessage(
      {
        gameId: 'sudoku',
        outcome: 'completed',
        details: [
          { label: 'A', value: '1' },
          { label: 'B', value: '' },
          { label: 'C', value: '2' },
          { label: 'D', value: '3' },
          { label: 'E', value: '4' },
        ],
      },
      en,
    );
    const facts = message.text.split('\n')[1];
    expect(facts).toBe('A 1 · C 2 · D 3');
    expect(facts?.split(' · ')).toHaveLength(MAX_SHARE_DETAILS);
  });

  it('is two sentences and a link, and the link is separate', () => {
    const message = buildShareMessage({ gameId: 'sudoku', outcome: 'played', details: [] }, en);
    expect(message.text.split('\n')).toHaveLength(2);
    // The share sheet gets text and url apart so a target can preview the
    // link; the clipboard fallback needs them as one block.
    expect(message.text).not.toContain(message.url);
    expect(shareMessageAsText(message)).toBe(`${message.text}\n${message.url}`);
  });
});
