/**
 * The BETA mark and its one sentence (docs/WEB_VERSION.md「先行公開(ベータ)」,
 * issue #194). What is pinned: the sentence exists in exactly the two
 * languages a native reader has checked and in no other; the badge is there
 * for every locale; nothing at all renders for a released title or on the app,
 * where a beta title is never shown in the first place.
 *
 * The registry this file sees carries one synthetic beta entry besides the
 * real ones (today the five of docs/plans/2026-10-17-unblock-snake-loop-
 * bridges-peg.md and the five of docs/plans/2026-10-20-overtake-
 * make-the-target-nested-tic-tac-toe-scopa-tangram.md), and one synthetic
 * in-development entry (the scaffolds of
 * docs/plans/2026-10-19-chess-gem-swap-pipe-link-bounce-up-echo-pads.md are
 * the real ones): the tests below speak about the synthetic
 * ones, so they keep testing the mechanism on any day no registry title is on
 * a channel (as from 2026-10-02 until the 2026-10-17 five arrived), and the
 * real ones are checked on top.
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

// The registry plus one synthetic web-beta title, a released game's shape under
// an id and title of its own. Every importer in this file sees the same list.
vi.mock('../../app/registry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../app/registry')>();
  const synthetic = {
    ...actual.GAMES.find((game) => game.id === 'sudoku')!,
    id: 'synthetic-beta',
    title: 'Synthetic Beta',
    channel: 'web-beta',
  } as unknown as (typeof actual.GAMES)[number];
  const syntheticInDevelopment = {
    ...actual.GAMES.find((game) => game.id === 'sudoku')!,
    id: 'synthetic-in-development',
    title: 'Synthetic In Development',
    channel: 'in-development',
  } as unknown as (typeof actual.GAMES)[number];
  return { ...actual, GAMES: [...actual.GAMES, synthetic, syntheticInDevelopment] };
});

import { GAMES, type GameId } from '../../app/registry';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema, type Settings } from '../../storage/schemas';
import { GameBetaBadge } from './GameBetaBadge';
import { WebBetaNotice } from './WebBetaNotice';

const beta = GAMES.find((game) => game.id === ('synthetic-beta' as GameId))!;
const realBeta = GAMES.filter((game) => game.channel === 'web-beta' && game !== beta);
const released = GAMES.find((game) => !game.channel)!;
const inDevelopment = GAMES.find((game) => game.id === ('synthetic-in-development' as GameId))!;
const realInDevelopment = GAMES.filter(
  (game) => game.channel === 'in-development' && game !== inDevelopment,
);

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
  it('has a beta title to speak about — the synthetic one, whatever ships', () => {
    expect(beta).toBeDefined();
    expect(beta.id).toBe('synthetic-beta');
    expect(beta.channel).toBe('web-beta');
    expect(released).toBeDefined();
  });

  it('shows the badge and the save caveat for every real beta title too', () => {
    expect(realBeta.length).toBeGreaterThan(0);
    for (const game of realBeta) {
      renderNotice(game.id, 'en');
      expect(screen.getByText('BETA')).toBeInTheDocument();
      expect(screen.getByText(/may be reset/)).toBeInTheDocument();
      cleanup();
    }
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

  it('renders nothing for a title in development, in the browser too — it is no beta yet', () => {
    // A title in development is offered on no build (app/gameChannel.ts); the mark it
    // carries from scripts/new-game.mjs waits for the channel to turn 'web-beta'.
    expect(inDevelopment.channel).toBe('in-development');
    for (const game of [inDevelopment, ...realInDevelopment]) {
      const { container } = renderNotice(game.id, 'en');
      expect(container, game.id).toBeEmptyDOMElement();
      cleanup();
    }
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

  it('leaves a card in development exactly as it was, like a released one', () => {
    const { container } = render(
      <button type="button">
        {inDevelopment.title}
        <GameBetaBadge game={inDevelopment} />
      </button>,
    );
    expect(screen.getByRole('button', { name: inDevelopment.title }).textContent).toBe(
      inDevelopment.title,
    );
    expect(container.querySelectorAll('.beta-badge')).toHaveLength(0);
  });
});
