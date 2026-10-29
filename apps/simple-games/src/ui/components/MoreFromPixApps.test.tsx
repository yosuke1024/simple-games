/**
 * PixApps' other apps (issue #276): what the section says, where a tap sends
 * somebody, and when it is not there at all. Its place on the home (after
 * every game, never in a search) is pinned in CollectionHomeScreen.test.tsx.
 *
 * The rules come from docs/PRODUCT_PRINCIPLES.md「PixApps の自社アプリの一覧は
 * 広告ではない」 and docs/BRAND.md「PixApps のほかのアプリの書き方」. The list
 * must not read as a game, an ad or a lure, and it must not borrow Simple
 * Games' promises for apps that do not make them.
 */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock, networkMock, openExternalMock } = vi.hoisted(() => ({
  capacitorMock: { native: false, platform: 'web' },
  networkMock: { online: true },
  openExternalMock: vi.fn(),
}));

vi.mock('@capacitor/core', () => ({
  Capacitor: {
    isNativePlatform: () => capacitorMock.native,
    getPlatform: () => capacitorMock.platform,
  },
}));
vi.mock('../../services/network', () => ({ isOnline: () => networkMock.online }));
vi.mock('../openExternal', () => ({ openExternal: openExternalMock }));

import { PIXMEAL, PIXWORK } from '@simple-games/brand';
import { catalogs, type Locale } from '../../i18n';
import { en } from '../../i18n/locales/en';
import { ja } from '../../i18n/locales/ja';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { MoreFromPixApps } from './MoreFromPixApps';

const stubAgent = (userAgent: string, maxTouchPoints = 0) =>
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });

const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 Chrome/126 Mobile';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15';

function renderSection() {
  return render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <MoreFromPixApps />
    </SettingsProvider>,
  );
}

const section = () => screen.queryByRole('region', { name: en.moreFromPixAppsTitle });

// The words this list must never say, so the banned-wording guard is told to
// let the one line that spells them out through.
const LURES =
  /free|install|download|now|today|ad-free|no ads|無料|今すぐ|インストール|ダウンロード|広告なし/i; // [check-principles: allow]

async function tap(name: string) {
  await userEvent.click(screen.getByRole('button', { name }));
  return openExternalMock.mock.calls.at(-1)?.[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  capacitorMock.native = false;
  capacitorMock.platform = 'web';
  networkMock.online = true;
  stubAgent(DESKTOP);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('what the section says', () => {
  it('is a headed region with the sentence saying these are separate apps', () => {
    renderSection();
    expect(section()).toHaveTextContent(en.moreFromPixAppsBody);
  });

  it('names each row by its app and describes it with that app’s own line', () => {
    renderSection();
    expect(screen.getByRole('button', { name: PIXMEAL.name })).toHaveAccessibleDescription(
      en.pixMealTagline,
    );
    expect(screen.getByRole('button', { name: PIXWORK.name })).toHaveAccessibleDescription(
      en.pixWorkTagline,
    );
    expect(within(section()!).getAllByRole('button')).toHaveLength(2);
  });

  /**
   * The issue's own list of what this must never become: an install button,
   * a "FREE!" offer, a game. Checked in the two languages the author reads
   * (the rest go through the high-risk gate, highRiskKeys.ts) and, for the
   * one thing a regex can see in any script, no exclamation mark anywhere.
   */
  it('carries no call to install, no price claim and no urgency', () => {
    for (const catalog of [en, ja]) {
      const text = [
        catalog.moreFromPixAppsTitle,
        catalog.moreFromPixAppsBody,
        catalog.pixMealTagline,
        catalog.pixWorkTagline,
      ].join(' ');
      expect(text).not.toMatch(LURES);
      expect(catalog.moreFromPixAppsTitle).not.toMatch(/game|ゲーム/i);
    }
    for (const locale of Object.keys(catalogs) as Locale[]) {
      const c = catalogs[locale];
      for (const text of [
        c.moreFromPixAppsTitle,
        c.moreFromPixAppsBody,
        c.pixMealTagline,
        c.pixWorkTagline,
      ]) {
        expect(text, locale).not.toMatch(/[!！]/);
      }
      // The brand name stays the brand name in every language.
      expect(c.moreFromPixAppsTitle, locale).toContain('PixApps');
    }
  });
});

describe('where a tap goes', () => {
  it('opens nothing until a row is tapped', () => {
    renderSection();
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  it('opens Google Play on the Android app and the App Store on the iOS app', async () => {
    capacitorMock.native = true;
    capacitorMock.platform = 'android';
    renderSection();
    expect(await tap(PIXMEAL.name)).toBe(PIXMEAL.playStoreUrl);
    expect(await tap(PIXWORK.name)).toBe(PIXWORK.playStoreUrl);
    cleanup();

    capacitorMock.platform = 'ios';
    renderSection();
    expect(await tap(PIXMEAL.name)).toBe(PIXMEAL.appStoreUrl);
    expect(await tap(PIXWORK.name)).toBe(PIXWORK.appStoreUrl);
  });

  it('opens the store a phone browser can install from', async () => {
    stubAgent(ANDROID);
    renderSection();
    expect(await tap(PIXMEAL.name)).toBe(PIXMEAL.playStoreUrl);
    cleanup();

    stubAgent(IPHONE);
    renderSection();
    expect(await tap(PIXWORK.name)).toBe(PIXWORK.appStoreUrl);
    cleanup();

    // iPadOS 13+ says Macintosh; the touch points give it away.
    stubAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15', 5);
    renderSection();
    expect(await tap(PIXMEAL.name)).toBe(PIXMEAL.appStoreUrl);
  });

  it('opens the app’s PixApps page on a desktop browser, which has no store to install from', async () => {
    renderSection();
    expect(await tap(PIXMEAL.name)).toBe(PIXMEAL.landingUrl);
    expect(await tap(PIXWORK.name)).toBe(PIXWORK.landingUrl);
  });
});

describe('offline', () => {
  it('is absent, since no row could open anything', () => {
    networkMock.online = false;
    renderSection();
    expect(section()).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
