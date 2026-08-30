/**
 * The card itself: what it says, where it can send somebody, and what it must
 * never do. The wording rules in docs/WEB_VERSION.md「アプリへの送客」 are not
 * decoration — a card that implies the web build is the crippled half would
 * contradict the one promise both versions share (identical games), and the
 * card would be worse than not shipping it.
 */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { openExternalMock } = vi.hoisted(() => ({ openExternalMock: vi.fn() }));

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
vi.mock('../openExternal', () => ({ openExternal: openExternalMock }));

import { APP_STORE_URL, PLAY_STORE_URL } from '@simple-games/brand';
import { catalogs, type Locale } from '../../i18n';
import { en } from '../../i18n/locales/en';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import { WebAppPrompt } from './WebAppPrompt';

const stubAgent = (userAgent: string, maxTouchPoints = 0) =>
  vi.stubGlobal('navigator', { userAgent, maxTouchPoints });

function renderCard(onClose = vi.fn()) {
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <WebAppPrompt onClose={onClose} />
    </SettingsProvider>,
  );
  return onClose;
}

beforeEach(() => {
  vi.clearAllMocks();
  stubAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126');
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('what the card says', () => {
  it('names what the app adds, under a heading a screen reader can find', () => {
    renderCard();
    const card = screen.getByRole('region', { name: en.webAppPromptTitle });
    expect(card).toHaveTextContent(en.webAppPromptBody);
  });

  /**
   * The two claims are the app's actual promises (docs/WEB_VERSION.md
   * 「役割分担」/「オフラインの扱い」): offline from the first launch, and a
   * home-screen icon. Everything else the card could have said is either
   * untrue of the app (there are no app-only games, and the banner exists
   * until the one-time purchase) or a statement about the web build being
   * lesser, which it is not.
   */
  it('claims only what the app really adds, in every shipped language', () => {
    for (const locale of Object.keys(catalogs) as Locale[]) {
      const card = `${catalogs[locale].webAppPromptTitle} ${catalogs[locale].webAppPromptBody}`;
      // No urgency, no scarcity, no countdown — the card is a note, not an offer.
      expect(card).not.toMatch(/今すぐ|見逃|残り\d|now only|hurry|limited time/i);
      // Never a claim about advertising: the app ships a banner until the
      // one-time purchase removes it, so "quieter" is as far as this may go.
      // The two lines below carry the forbidden wording in order to forbid it,
      // which is what the marker is for (.github/scripts/check-principles.sh §6).
      // prettier-ignore
      expect(card).not.toMatch(/広告|ad-free|no ads|sin anuncios|sans publicité|werbefrei/i); // [check-principles: allow]
      // Never a price or a purchase: what those cost is Play's and Apple's to
      // state, not a translated string's (docs/I18N_POLICY.md).
      expect(card).not.toMatch(/\$|€|¥|￥/);
    }
  });
});

describe('where it can send somebody', () => {
  it('offers Google Play alone on an Android browser', async () => {
    stubAgent('Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126 Mobile');
    const user = userEvent.setup();
    const onClose = renderCard();
    expect(screen.queryByRole('button', { name: 'App Store' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Google Play' }));
    expect(openExternalMock).toHaveBeenCalledWith(PLAY_STORE_URL);
    expect(onClose).toHaveBeenCalled();
  });

  it('offers the App Store alone on an iPhone', async () => {
    stubAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15');
    const user = userEvent.setup();
    renderCard();
    expect(screen.queryByRole('button', { name: 'Google Play' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'App Store' }));
    expect(openExternalMock).toHaveBeenCalledWith(APP_STORE_URL);
  });

  it('offers both on a desktop browser, which cannot install either', () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Google Play' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'App Store' })).toBeInTheDocument();
  });
});

describe('closing it', () => {
  it('takes the card off the screen without opening anything', async () => {
    const user = userEvent.setup();
    const onClose = renderCard();
    await user.click(screen.getByRole('button', { name: en.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(openExternalMock).not.toHaveBeenCalled();
  });

  /**
   * A dialog would need one; a card must not have one. Nothing here traps
   * focus, covers the page, or has to be answered before the collection is
   * usable again — that is the difference the issue's non-goals name between
   * this and a launch popup.
   */
  it('is a card in the page, never a dialog over it', () => {
    renderCard();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
