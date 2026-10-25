import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { initialPits } from '../../games/mancala/game/types';
import { claim } from '../../games/dots-and-boxes/game/engine';
import { emptyBoard } from '../../games/dots-and-boxes/game/types';
import type { NearbyMatch } from '../gameTypes';
import MancalaView from './mancalaView';
import DotsView from './dots-and-boxesView';
import ChessView from './chessView';
import NestedView from './nested-tic-tac-toeView';
import NimView from './nimView';

const names = ['Host', 'Pixel'];
const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider
    initialSettings={{ ...settingsSchema.defaultValue(), language: 'en', reducedMotion: true }}
  >
    {children}
  </SettingsProvider>
);
afterEach(cleanup);

describe('additional shared Nearby boards', () => {
  it('rotates Mancala for the guest and maps pointer/keyboard to its canonical pits', () => {
    const act = vi.fn();
    const match: NearbyMatch = {
      gameId: 'mancala',
      round: 1,
      revision: 1,
      state: { pits: initialPits(), turn: 1, last: null },
    };
    const ui = render(<MancalaView match={match} seat={1} names={names} canAct act={act} />, {
      wrapper,
    });
    fireEvent.click(ui.container.querySelector('.mc-pit-you')!);
    expect(act).toHaveBeenLastCalledWith({ kind: 'sow', pit: 7 });
    fireEvent.keyDown(window, { key: '6' });
    expect(act).toHaveBeenLastCalledWith({ kind: 'sow', pit: 12 });
    ui.rerender(<MancalaView match={match} seat={1} names={names} canAct={false} act={act} />);
    const count = act.mock.calls.length;
    fireEvent.keyDown(window, { key: '1' });
    expect(act).toHaveBeenCalledTimes(count);
    expect(
      [...ui.container.querySelectorAll<HTMLButtonElement>('.mc-pit-you')].every((b) => b.disabled),
    ).toBe(true);
    expect(ui.container.querySelector('.mc-store-cpu')).toHaveAccessibleName(/Host/);
  });

  it('Dots maps the guest box ownership without changing edge IDs and blocks hidden input', () => {
    let board = emptyBoard(3);
    // Top-left box: top 0, bottom 3, left 12, right 13.
    for (const edge of [0, 3, 12, 13]) board = claim(board, 2, edge)!.board;
    const match: NearbyMatch = {
      gameId: 'dots-and-boxes',
      round: 1,
      revision: 4,
      state: { board, turn: 1, last: 13 },
    };
    const act = vi.fn();
    const ui = render(<DotsView match={match} seat={1} names={names} canAct act={act} />, {
      wrapper,
    });
    expect(ui.container.querySelectorAll('.db-box-you')).toHaveLength(1);
    fireEvent.click(ui.container.querySelector('button[data-edge="1"]')!);
    expect(act).toHaveBeenCalledExactlyOnceWith({ kind: 'edge', edge: 1 });
    ui.rerender(<DotsView match={match} seat={1} names={names} canAct={false} act={act} />);
    fireEvent.click(ui.container.querySelector('button[data-edge="2"]')!);
    expect(act).toHaveBeenCalledTimes(1);
  });

  it('Nested exposes only the forced small board for the guest and preserves canonical cells', () => {
    const match: NearbyMatch = {
      gameId: 'nested-tic-tac-toe',
      round: 1,
      revision: 1,
      state: { moves: [40] },
    };
    const act = vi.fn();
    const ui = render(<NestedView match={match} seat={1} names={names} canAct act={act} />, {
      wrapper,
    });
    const available = [
      ...ui.container.querySelectorAll<HTMLButtonElement>('button[data-cell]'),
    ].filter((b) => !b.disabled);
    expect(available).toHaveLength(8);
    expect(
      available.every((b) => Number(b.dataset.cell) >= 36 && Number(b.dataset.cell) <= 44),
    ).toBe(true);
    fireEvent.click(ui.container.querySelector('button[data-cell="36"]')!);
    expect(act).toHaveBeenCalledExactlyOnceWith({ kind: 'place', cell: 36 });
    ui.rerender(<NestedView match={match} seat={1} names={names} canAct={false} act={act} />);
    expect(
      [...ui.container.querySelectorAll<HTMLButtonElement>('button[data-cell]')].every(
        (b) => b.disabled,
      ),
    ).toBe(true);
  });

  it('Chess guest promotes using the original piece picker; interrupted selection cannot send', () => {
    const match: NearbyMatch = {
      gameId: 'chess',
      round: 1,
      revision: 1,
      state: { fen: '7k/8/8/8/8/8/p7/7K b - - 0 1', outcome: null, last: 1, plies: 1 },
    };
    const act = vi.fn();
    const ui = render(<ChessView match={match} seat={1} names={names} canAct act={act} />, {
      wrapper,
    });
    const tap = (square: string) =>
      fireEvent.click(ui.container.querySelector(`[data-square="${square}"]`)!);
    tap('a2');
    tap('a1');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(act).not.toHaveBeenCalled();
    ui.rerender(<ChessView match={match} seat={1} names={names} canAct={false} act={act} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    ui.rerender(<ChessView match={match} seat={1} names={names} canAct act={act} />);
    tap('a1');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    tap('a2');
    tap('a1');
    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', { name: 'black queen' }),
    );
    expect(act).toHaveBeenCalledExactlyOnceWith({ kind: 'move', from: 8, to: 0, promotion: 5 });
    expect(ui.container.querySelector('.ch-board')?.firstElementChild).toHaveAttribute(
      'data-square',
      'h1',
    );
  });

  it('Nim keeps explicit count confirmation and discards a stale selection after interruption', () => {
    const match: NearbyMatch = {
      gameId: 'nim',
      round: 1,
      revision: 0,
      state: { heaps: [2, 3, 4, 5], turn: 0, last: null },
    };
    const act = vi.fn();
    const ui = render(<NimView match={match} seat={0} names={names} canAct act={act} />, {
      wrapper,
    });
    fireEvent.click(screen.getByRole('button', { name: 'Row 2: 3 stones' }));
    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: '2' }));
    expect(act).not.toHaveBeenCalled();
    ui.rerender(<NimView match={match} seat={0} names={names} canAct={false} act={act} />);
    ui.rerender(<NimView match={match} seat={0} names={names} canAct act={act} />);
    expect(screen.getByRole('button', { name: 'Take 1' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Row 2: 3 stones' }));
    fireEvent.click(within(screen.getByRole('group')).getByRole('button', { name: '2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Take 2' }));
    expect(act).toHaveBeenCalledExactlyOnceWith({ kind: 'take', row: 1, count: 2 });
  });
});
