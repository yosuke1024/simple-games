import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { CELLS, encodeBoard } from '../game';
import { G2048_STORAGE_KEYS } from '../storage/schemas';
import { Game2048Root } from './Game2048Root';


function render2048(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <Game2048Root onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [G2048_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

const board = () => screen.getByRole('group', { name: '2048 board' });

/** The board as the screen reader hears it — the game's own view of itself. */
const cellLabels = (): string[] =>
  within(board())
    .getAllByRole('img')
    .map((cell) => cell.getAttribute('aria-label') ?? '');

const boardText = (): string => cellLabels().join(' | ');

/** Plays the first arrow key that actually changes the board. */
async function moveOnce(user: ReturnType<typeof userEvent.setup>): Promise<string> {
  const before = boardText();
  for (const key of ['{ArrowLeft}', '{ArrowUp}', '{ArrowRight}', '{ArrowDown}']) {
    await user.keyboard(key);
    if (boardText() !== before) break;
  }
  return before;
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/**
 * jsdom has no matchMedia, so useReducedMotion reports "reduce" by default and
 * every test above exercises the instant path. This turns motion back on.
 */
function allowMotion() {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  }));
}

describe('first run', () => {
  it('shows Quick Rules and starts a classic game right after (§9)', async () => {
    const user = userEvent.setup();
    render2048();

    expect(await screen.findByText('Swipe to move')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Equal numbers join')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Make 2048')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Classic')).toBeInTheDocument();
    expect(within(board()).getAllByRole('img')).toHaveLength(CELLS);
    // A new board opens on two tiles and nothing to undo yet.
    expect(cellLabels().filter((label) => !label.startsWith('Empty'))).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('draws Quick Rules figures out of real tiles, never a value 2048 cannot hold', async () => {
    const user = userEvent.setup();
    render2048();
    await screen.findByText('Swipe to move');

    for (const step of [0, 1, 2]) {
      const tiles = [...document.querySelectorAll('.g2048-strip-tile')];
      expect(tiles.length, `step ${step} has no figure`).toBeGreaterThan(0);
      for (const tile of tiles) {
        const value = Number(tile.textContent);
        // Every tile in a figure is a power of two of at least 2 — a figure
        // showing an impossible tile would teach the wrong game.
        expect(Number.isInteger(Math.log2(value)), `step ${step} shows ${value}`).toBe(true);
        expect(value).toBeGreaterThanOrEqual(2);
      }
      if (step < 2) await user.click(screen.getByRole('button', { name: 'Next' }));
    }
  });
});

describe('home', () => {
  it('offers both modes, no level list, and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = render2048(tutorialDone);

    expect(await screen.findByRole('button', { name: /Classic/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    // 2048 has no stages, so nothing here offers to pick one (§6).
    expect(screen.queryByRole('button', { name: /Level/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});

describe('playing', () => {
  it('moves the whole board with an arrow key (§2, §10)', async () => {
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Classic/ }));

    const before = await moveOnce(user);
    expect(boardText()).not.toBe(before);
    // A move that changed the board is paid for with exactly one new tile (§2.4).
    const filled = cellLabels().filter((label) => !label.startsWith('Empty')).length;
    expect(filled).toBeGreaterThanOrEqual(2);
    expect(filled).toBeLessThanOrEqual(3);
  });

  it('undoes that move, free and with nothing asked for it (§5)', async () => {
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Classic/ }));

    const before = await moveOnce(user);
    const undo = screen.getByRole('button', { name: 'Undo' });
    expect(undo).toBeEnabled();
    await user.click(undo);
    expect(boardText()).toBe(before);
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });

  it('names every square by value and position (§10)', async () => {
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Classic/ }));

    for (const label of cellLabels()) {
      expect(label).toMatch(/^(Empty|\d+), row [1-4], column [1-4]$/);
    }
  });

  it('offers Undo and nothing else — no direction buttons on screen (§10)', async () => {
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Classic/ }));

    const actions = document.querySelector('.action-bar')!;
    expect(within(actions as HTMLElement).getAllByRole('button')).toHaveLength(1);
    for (const name of [/^up$/i, /^down$/i, /^left$/i, /^right$/i]) {
      expect(screen.queryByRole('button', { name })).not.toBeInTheDocument();
    }
  });

  it('carries tiles across the move, and still shows exactly the board it played (§10)', async () => {
    allowMotion();
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Classic/ }));

    const before = new Set(document.querySelectorAll('.g2048-tile'));
    expect(before.size).toBe(2);
    await moveOnce(user);

    // The same DOM nodes travel: that is what makes a tile slide rather than
    // blink out and back. A rebuild would have replaced every one of them.
    const tiles = [...document.querySelectorAll('.g2048-tile')];
    expect(tiles.filter((tile) => before.has(tile)).length).toBeGreaterThan(0);

    // And the visible tiles spell out the board, exactly — an animation is
    // never worth showing a number the game does not hold.
    const shown = tiles
      .filter((tile) => !tile.className.includes('g2048-tile-leaving'))
      .map((tile) => Number(tile.textContent))
      .sort((a, b) => a - b);
    const held = cellLabels()
      .filter((label) => !label.startsWith('Empty'))
      .map((label) => Number(label.split(',')[0]))
      .sort((a, b) => a - b);
    expect(shown).toEqual(held);
  });

  it('resumes a suspended game and shows a merge as two tiles becoming one (§6, §10)', async () => {
    allowMotion();
    const user = userEvent.setup();
    render2048({
      ...tutorialDone,
      [G2048_STORAGE_KEYS.game]: JSON.stringify({
        schemaVersion: 1,
        mode: 'classic',
        seed: 'merge-me',
        dailyDate: null,
        board: encodeBoard([2, 2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]),
        score: 0,
        moveCount: 0,
        spawnCount: 2,
        won: false,
        winAcknowledged: false,
        elapsedSeconds: 0,
        savedAt: 0,
      }),
    });

    // The saved board came back exactly as it was left.
    await user.click(await screen.findByRole('button', { name: /Resume/ }));
    expect(cellLabels()[0]).toBe('2, row 1, column 1');
    expect(cellLabels()[1]).toBe('2, row 1, column 2');

    await user.keyboard('{ArrowLeft}');
    expect(cellLabels()[0]).toBe('4, row 1, column 1');

    // The tile the merge made lands with its own mark, and the half it
    // absorbed is still on its way there rather than gone from where it was.
    const merged = document.querySelector('.g2048-tile-merged');
    expect(merged?.textContent).toBe('4');
    expect(document.querySelector('.g2048-tile-leaving')).not.toBeNull();
  });

  it('shows the score and the score to beat, and never a clock or a streak (§4)', async () => {
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: /Classic/ }));

    expect(screen.getByText('Score')).toBeInTheDocument();
    // Nothing ticks and nothing counts days: no clock, no streak (§4, §11).
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Time/i)).not.toBeInTheDocument();

    // Still true after playing a move.
    await moveOnce(user);
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('statistics', () => {
  it('reports per-mode facts and no streak (§8)', async () => {
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Classic')).toBeInTheDocument();
    expect(screen.getByText('Daily')).toBeInTheDocument();
    expect(screen.getAllByText('Best score')).toHaveLength(2);
    expect(screen.getAllByText('Highest tile')).toHaveLength(2);
    expect(screen.getAllByText('Times you reached 2048')).toHaveLength(2);
    expect(screen.getByText('Days played')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('the daily backlog', () => {
  it('lists today and only the days already unlocked, with no chain to keep (§6)', async () => {
    const user = userEvent.setup();
    render2048(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Past Dailies' }));

    const rows = screen.getAllByRole('button').filter((b) => b.className.includes('daily-row'));
    expect(rows).toHaveLength(1);
    expect(within(rows[0]!).getByText('Today')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
