/**
 * A Web-only title (registry `channel: 'web-beta'`) is not in the app, so its
 * share stays in the browser: the browser game's address and an invitation to
 * play there. The app's share address would open an install landing for a
 * game the app does not have (docs/architecture/share-links.md).
 *
 * No title is on the early-release channel on 2026-11-08, so this file puts
 * one there. Everything else reads the real registry.
 */
import { describe, expect, it, vi } from 'vitest';
import { SHARE_BASE_URL, WEB_PLAY_URL } from '@simple-games/brand';
import { gameIdFromHref } from '../../app/webRoute';
import { catalogs, translate, type Locale, type MessageKey, type TranslateVars } from '../../i18n';
import { buildShareMessage, gameShareUrl, isWebOnlyGame } from './message';

const WEB_ONLY = 'snake';

vi.mock('../../app/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/registry')>();
  return {
    ...actual,
    GAMES: actual.GAMES.map((game) =>
      game.id === 'snake' ? { ...game, channel: 'web-beta' as const } : game,
    ),
  };
});

const t =
  (locale: Locale) =>
  (key: MessageKey, vars?: TranslateVars): string =>
    translate(locale, key, vars);

const locales = Object.keys(catalogs) as Locale[];

describe('a Web-only game', () => {
  it('links to the browser game, which opens it', () => {
    expect(isWebOnlyGame(WEB_ONLY)).toBe(true);
    expect(isWebOnlyGame('sudoku')).toBe(false);
    const url = gameShareUrl(WEB_ONLY);
    expect(url).toBe(`${WEB_PLAY_URL}?game=${WEB_ONLY}`);
    expect(url.startsWith(SHARE_BASE_URL)).toBe(false);
    expect(gameIdFromHref(url)).toBe(WEB_ONLY);
    // The app's games keep the address that opens the app.
    expect(gameShareUrl('sudoku')).toBe(`${SHARE_BASE_URL}sudoku/`);
  });

  it('invites the reader to the browser, in every language', () => {
    for (const locale of locales) {
      const local = t(locale);
      const invite = buildShareMessage({ gameId: WEB_ONLY, outcome: 'played', details: [] }, local);
      const challenge = buildShareMessage(
        { gameId: WEB_ONLY, outcome: 'completed', details: [{ label: 'Score', value: '120' }] },
        local,
      );
      expect(invite.text.split('\n'), locale).toEqual([
        local('sharePlayed', { game: 'Snake' }),
        local('shareInviteBrowser'),
      ]);
      expect(challenge.text.split('\n')[2], locale).toBe(local('shareChallengeBrowser'));
      expect(invite.url, locale).toBe(gameShareUrl(WEB_ONLY));
      for (const key of ['shareInviteBrowser', 'shareChallengeBrowser'] as const) {
        expect(local(key).trim(), `${locale} ${key}`).not.toBe('');
        expect(local(key), `${locale} ${key}`).not.toBe(local('shareInvite'));
        expect(local(key), `${locale} ${key}`).not.toBe(local('shareChallenge'));
      }

      // An app game in the same build still points at the app.
      const app = buildShareMessage({ gameId: 'sudoku', outcome: 'played', details: [] }, local);
      expect(app.text.split('\n')[1], locale).toBe(local('shareInvite'));
    }

    // The wording shipped before 1.8.4, when every share opened the browser.
    expect(translate('en', 'shareInviteBrowser')).toBe('You can play it right in your browser.');
    expect(translate('en', 'shareChallengeBrowser')).toBe('Your turn. Try it in your browser.');
    expect(translate('ja', 'shareInviteBrowser')).toBe('ブラウザですぐ遊べます。');
    expect(translate('en', 'shareInviteBrowser')).not.toMatch(/\bapp\b/i);
    expect(translate('en', 'shareChallengeBrowser')).not.toMatch(/\bapp\b/i);
  });
});
