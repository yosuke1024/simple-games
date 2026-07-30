import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { SP_STORAGE_KEYS } from '../storage/schemas';
import { SlidingPuzzleRoot } from './SlidingPuzzleRoot';


function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <SlidingPuzzleRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [SP_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

interface Spot {
  readonly row: number;
  readonly col: number;
}

const spotOf = (element: Element): Spot => {
  const match = /row (\d+), column (\d+)/.exec(element.getAttribute('aria-label') ?? '');
  if (!match) throw new Error(`no position in "${element.getAttribute('aria-label')}"`);
  return { row: Number(match[1]), col: Number(match[2]) };
};

const board = () => screen.getByRole('group', { name: 'Sliding puzzle board' });
/** The gap — announced, but never a control (§12). */
const gap = () => within(board()).getByRole('img');
const tiles = () => within(board()).getAllByRole('button');

/** A tile sharing an edge with the gap: the simplest legal move there is. */
function tileBesideGap(): HTMLElement {
  const here = spotOf(gap());
  const found = tiles().find((tile) => {
    const spot = spotOf(tile);
    return Math.abs(spot.row - here.row) + Math.abs(spot.col - here.col) === 1;
  });
  if (!found) throw new Error('no tile beside the gap');
  return found;
}

async function startLevelOne(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: /Level 1/ }));
}

afterEach(cleanup);

describe('first run', () => {
  it('shows Quick Rules and starts level 1 right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Tap next to the gap')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('A whole row moves')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Put 1 to the end in order')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    expect(screen.getByText('Level 1')).toBeInTheDocument();
    // Level 1 is a 3x3: eight tiles plus the gap.
    expect(tiles()).toHaveLength(8);
    expect(gap()).toBeInTheDocument();
    // Undo is there from the first frame, and free — it just has nothing yet.
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('playing', () => {
  it('slides the tapped tile into the gap and counts the move (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const gapWas = spotOf(gap());
    const tile = tileBesideGap();
    const tileWas = spotOf(tile);
    const value = tile.textContent;

    await user.click(tile);

    // The tile is where the gap was, and the gap is where the tile was.
    expect(spotOf(tile)).toEqual(gapWas);
    expect(tile.textContent).toBe(value);
    expect(spotOf(gap())).toEqual(tileWas);
    expect(screen.getByText(/Moves\s*1/)).toBeInTheDocument();
  });

  it('ignores a tap that shares neither the gap’s row nor its column (§3)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const here = spotOf(gap());
    const diagonal = tiles().find((tile) => {
      const spot = spotOf(tile);
      return spot.row !== here.row && spot.col !== here.col;
    })!;
    const before = diagonal.getAttribute('aria-label');

    await user.click(diagonal);

    expect(diagonal.getAttribute('aria-label')).toBe(before);
    expect(spotOf(gap())).toEqual(here);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
  });

  it('undo puts the board and the move count back (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    const gapWas = spotOf(gap());
    const tile = tileBesideGap();
    const tileWas = spotOf(tile);
    await user.click(tile);

    await user.click(screen.getByRole('button', { name: 'Undo' }));

    expect(spotOf(tile)).toEqual(tileWas);
    expect(spotOf(gap())).toEqual(gapWas);
    expect(screen.getByText(/Moves\s*0/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Undo' })).toBeDisabled();
  });
});

describe('what this game deliberately does not have', () => {
  it('offers no hint, at any point in a game (§8)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/hint/i)).not.toBeInTheDocument();

    // Still nothing after playing a move — a hint is not unlocked by progress.
    await user.click(tileBesideGap());
    expect(screen.queryByRole('button', { name: /hint/i })).not.toBeInTheDocument();
  });

  it('shows no clock and no streak while playing (§4, §7)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await startLevelOne(user);

    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
    // Nothing on screen is formatted as a running time.
    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });

  it('reports per-size facts on the statistics screen, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Levels solved')).toBeInTheDocument();
    expect(screen.getByText('3x3')).toBeInTheDocument();
    expect(screen.getByText('4x4')).toBeInTheDocument();
    expect(screen.getByText('5x5')).toBeInTheDocument();
    expect(screen.getAllByText('Fewest moves')).toHaveLength(3);
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('offers both modes and hands control back to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    expect(await screen.findByRole('button', { name: /Level 1/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Daily Challenge/ })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
