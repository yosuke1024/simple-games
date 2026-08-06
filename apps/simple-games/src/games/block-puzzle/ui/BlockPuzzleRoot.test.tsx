import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { createMemoryKV } from '@/storage/kv';
import { settingsSchema } from '@/storage/schemas';
import { createSession, pieceById } from '../game';
import { toPersisted } from '../storage/gamePersistence';
import { BP_STORAGE_KEYS } from '../storage/schemas';
import { BlockPuzzleRoot } from './BlockPuzzleRoot';

/**
 * A stand-in for the device store. The `kv` prop below is a load-side seam
 * only — saves always go to Capacitor Preferences — so a test that has to read
 * back what a save actually wrote has to stand behind both.
 */
const { deviceStore } = vi.hoisted(() => ({ deviceStore: new Map<string, string>() }));
vi.mock('@capacitor/preferences', () => ({
  Preferences: {
    get: ({ key }: { key: string }) => Promise.resolve({ value: deviceStore.get(key) ?? null }),
    set: ({ key, value }: { key: string; value: string }) => {
      deviceStore.set(key, value);
      return Promise.resolve();
    },
    remove: ({ key }: { key: string }) => {
      deviceStore.delete(key);
      return Promise.resolve();
    },
  },
}));

function renderGame(initial: Record<string, string> = {}) {
  const onExit = vi.fn();
  const kv = createMemoryKV(initial);
  render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <BlockPuzzleRoot onExit={onExit} kv={kv} />
    </SettingsProvider>,
  );
  return { onExit, kv };
}

const tutorialDone = {
  [BP_STORAGE_KEYS.flags]: JSON.stringify({ schemaVersion: 1, tutorialCompleted: true }),
};

/** A pinned board, so the test knows exactly which three pieces are on offer. */
const SEED = 'block-uitest';
const PINNED = createSession(SEED);

const savedGame = {
  ...tutorialDone,
  [BP_STORAGE_KEYS.game]: JSON.stringify(toPersisted(PINNED, 1)),
};

const board = () => screen.getByRole('group', { name: 'Block board, 8 by 8' });
const tray = () => screen.getByRole('group', { name: 'Pieces' });

const cell = (row: number, col: number) =>
  within(board()).getByRole('button', { name: `Row ${row}, column ${col}: empty` });

/** How many squares the piece in a slot covers — its score if nothing clears. */
const cellsInSlot = (slot: number) => pieceById(PINNED.tray[slot])!.cells.length;

/** A cell of the pretend board below, in CSS pixels. */
const CELL_PX = 40;

/**
 * jsdom lays nothing out, so the drag is measured against a rectangle handed
 * to the board by force. Everything else about the gesture is real.
 */
function giveBoardALayout(): void {
  vi.spyOn(board(), 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: CELL_PX * 8,
    height: CELL_PX * 8,
    right: CELL_PX * 8,
    bottom: CELL_PX * 8,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect);
}

/**
 * Where a finger has to be for the piece in `slot` to land with its top-left
 * corner on (row, col): the board's own arithmetic run backwards, including
 * the 1.5-cell lift that keeps the piece clear of the finger (§3).
 */
function pointerFor(slot: number, row: number, col: number) {
  const piece = pieceById(PINNED.tray[slot])!;
  return {
    clientX: CELL_PX * (col + piece.width / 2),
    clientY: CELL_PX * (row + piece.height / 2 + 1.5),
  };
}

async function resume(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Resume' }));
}

afterEach(() => {
  cleanup();
  deviceStore.clear();
  vi.restoreAllMocks();
});

describe('first run', () => {
  it('shows Quick Rules and starts a board right after (§11)', async () => {
    const user = userEvent.setup();
    renderGame();

    expect(await screen.findByText('Drag a piece in')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Fill a row or column')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('Play until nothing fits')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Start Playing' }));

    // An empty 8×8 board and three pieces on offer (§1).
    expect(within(board()).getAllByRole('button')).toHaveLength(64);
    expect(within(tray()).getAllByRole('button')).toHaveLength(3);
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
  });
});

describe('playing', () => {
  it('places a piece by tapping it and then a cell, and scores it (§3, §5)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await resume(user);

    const piece = within(tray()).getByRole('button', { name: /^Piece 1,/ });
    await user.click(piece);
    expect(within(tray()).getByRole('button', { name: 'Piece 1 selected' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    // The piece's first filled cell lands on the tapped cell (§3).
    await user.click(cell(3, 3));

    const placed = cellsInSlot(0);
    expect(screen.getByText(new RegExp(`Score\\s*${placed}`))).toBeInTheDocument();
    expect(board().querySelectorAll('.bp-cell-filled')).toHaveLength(placed);
    // The slot is spent, and the tray keeps its three places (§1).
    expect(within(tray()).getByRole('button', { name: 'Piece 1, already placed' })).toBeDisabled();
    expect(within(tray()).getAllByRole('button')).toHaveLength(3);
  });

  it('takes the placement back, whole and for nothing (§7)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await resume(user);

    const undo = () => screen.getByRole('button', { name: 'Undo' });
    expect(undo()).toBeDisabled();

    await user.click(within(tray()).getByRole('button', { name: /^Piece 1,/ }));
    await user.click(cell(3, 3));
    expect(board().querySelectorAll('.bp-cell-filled')).toHaveLength(cellsInSlot(0));
    expect(undo()).toBeEnabled();

    await user.click(undo());
    expect(board().querySelectorAll('.bp-cell-filled')).toHaveLength(0);
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    expect(within(tray()).getByRole('button', { name: /^Piece 1,/ })).toBeInTheDocument();
    expect(undo()).toBeDisabled();
  });

  it('shows a ghost while dragging and places the piece on release (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await resume(user);
    giveBoardALayout();

    const piece = within(tray()).getByRole('button', { name: /^Piece 1,/ });
    const target = pointerFor(0, 2, 2);
    // The press starts on the piece, well away from where it will be let go.
    fireEvent.pointerDown(piece, { pointerId: 1, clientX: 40, clientY: 600 });
    fireEvent.pointerMove(piece, { pointerId: 1, ...target });

    // The landing is legal, so the board shows where the piece would go, and
    // nothing has been placed yet.
    expect(board().querySelectorAll('.bp-cell-ghost')).toHaveLength(cellsInSlot(0));
    expect(board().querySelectorAll('.bp-cell-filled')).toHaveLength(0);

    fireEvent.pointerUp(piece, { pointerId: 1, ...target });
    expect(board().querySelectorAll('.bp-cell-ghost')).toHaveLength(0);
    expect(board().querySelectorAll('.bp-cell-filled')).toHaveLength(cellsInSlot(0));
    expect(screen.getByText(new RegExp(`Score\\s*${cellsInSlot(0)}`))).toBeInTheDocument();
  });

  it('returns a piece dropped off the board to the tray, silently (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await resume(user);
    giveBoardALayout();

    const piece = within(tray()).getByRole('button', { name: /^Piece 1,/ });
    fireEvent.pointerDown(piece, { pointerId: 1, clientX: 40, clientY: 600 });
    // Far below the board: no cell there, so no ghost and nothing to commit.
    fireEvent.pointerMove(piece, { pointerId: 1, clientX: 40, clientY: 900 });
    expect(board().querySelectorAll('.bp-cell-ghost')).toHaveLength(0);

    fireEvent.pointerUp(piece, { pointerId: 1, clientX: 40, clientY: 900 });
    expect(board().querySelectorAll('.bp-cell-filled')).toHaveLength(0);
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
    // The piece is still on offer, and the drag did not select it either.
    expect(within(tray()).getByRole('button', { name: /^Piece 1,/ })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });

  it('does nothing at all when the tap has no piece selected (§3)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await resume(user);

    await user.click(cell(4, 4));
    expect(board().querySelectorAll('.bp-cell-filled')).toHaveLength(0);
    expect(screen.getByText(/Score\s*0/)).toBeInTheDocument();
  });

  it('shows no clock while playing (§12)', async () => {
    const user = userEvent.setup();
    renderGame(savedGame);
    await resume(user);

    expect(screen.queryByText(/\d+:\d\d/)).not.toBeInTheDocument();
  });
});

describe('home', () => {
  it('exits to the collection', async () => {
    const user = userEvent.setup();
    const { onExit } = renderGame(tutorialDone);

    await user.click(await screen.findByRole('button', { name: 'All games' }));
    expect(onExit).toHaveBeenCalledTimes(1);
  });

  it('reports the local record, and no streak (§9)', async () => {
    const user = userEvent.setup();
    renderGame(tutorialDone);
    await user.click(await screen.findByRole('button', { name: 'Statistics' }));

    expect(screen.getByText('Best score')).toBeInTheDocument();
    expect(screen.getByText('Lines cleared')).toBeInTheDocument();
    expect(screen.getByText('Total play time')).toBeInTheDocument();
    expect(screen.queryByText(/streak/i)).not.toBeInTheDocument();
  });
});
