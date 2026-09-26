/**
 * The BETA mark and its one sentence (docs/WEB_VERSION.md「先行公開(ベータ)」,
 * issue #194). What is pinned: the sentence exists in exactly the two
 * languages a native reader has checked and in no other; the badge is there
 * for every locale; nothing at all renders for a released title or on the app,
 * where a beta title is never shown in the first place.
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { capacitorMock } = vi.hoisted(() => ({ capacitorMock: { native: false } }));

vi.mock('@capacitor/core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@capacitor/core')>();
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: () => capacitorMock.native,
      getPlatform: () => (capacitorMock.native ? 'android' : 'web'),
    },
  };
});

import { GAMES, type GameId } from '../../app/registry';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema, type Settings } from '../../storage/schemas';
import { GameBetaBadge } from './GameBetaBadge';
import { WebBetaNotice } from './WebBetaNotice';

const beta = GAMES.find((game) => game.channel === 'web-beta')!;
const released = GAMES.find((game) => game.channel !== 'web-beta')!;

function renderNotice(gameId: GameId, language: Settings['language'] = 'en') {
  return render(
    <SettingsProvider initialSettings={{ ...settingsSchema.defaultValue(), language }}>
      <WebBetaNotice gameId={gameId} />
    </SettingsProvider>,
  );
}

beforeEach(() => {
  capacitorMock.native = false;
});

afterEach(cleanup);

describe('WebBetaNotice', () => {
  it('has a beta title to speak about', () => {
    expect(beta).toBeDefined();
  });

  it('shows the badge and the save caveat in English', () => {
    renderNotice(beta.id, 'en');
    expect(screen.getByText('BETA')).toBeInTheDocument();
    expect(screen.getByText(/may be reset/)).toBeInTheDocument();
  });

  it('shows the badge and the save caveat in Japanese', () => {
    renderNotice(beta.id, 'ja');
    expect(screen.getByText('BETA')).toBeInTheDocument();
    expect(screen.getByText(/消えることがあります/)).toBeInTheDocument();
  });

  it('shows the badge alone in every other locale — no machine-written promise about data', () => {
    for (const language of ['de', 'th', 'zh-hans', 'hi'] as const) {
      renderNotice(beta.id, language);
      expect(screen.getByText('BETA')).toBeInTheDocument();
      expect(screen.queryByText(/may be reset/)).not.toBeInTheDocument();
      expect(screen.queryByText(/消えることがあります/)).not.toBeInTheDocument();
      expect(document.querySelector('.web-beta-note')).toBeNull();
      cleanup();
    }
  });

  it('renders nothing for a released title, so promoting a game needs no edit here', () => {
    const { container } = renderNotice(released.id, 'en');
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing on the app build', () => {
    capacitorMock.native = true;
    const { container } = renderNotice(beta.id, 'en');
    expect(container).toBeEmptyDOMElement();
  });
});

describe('GameBetaBadge', () => {
  it('marks a beta card and leaves a released card exactly as it was', () => {
    const { container } = render(
      <>
        <button type="button">
          {beta.title}
          <GameBetaBadge game={beta} />
        </button>
        <button type="button">
          {released.title}
          <GameBetaBadge game={released} />
        </button>
      </>,
    );
    expect(screen.getByRole('button', { name: `${beta.title} BETA` })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: released.title }).textContent).toBe(released.title);
    expect(container.querySelectorAll('.beta-badge')).toHaveLength(1);
  });
});
