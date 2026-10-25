import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import type { GameAdapter, NearbyBoardProps, Seat } from '../gameTypes';
import { adapter as four } from './connect-four';
import { adapter as gomoku } from './gomoku';
import { adapter as reversi } from './reversi';
import { adapter as checkers, type CheckersView as CheckersState } from './checkers';
import FourView from './connect-fourView';
import GomokuView from './gomokuView';
import ReversiView from './reversiView';
import CheckersView from './checkersView';

const components = {
  'connect-four': FourView,
  gomoku: GomokuView,
  reversi: ReversiView,
  checkers: CheckersView,
};
function props(
  adapter: GameAdapter,
  state = adapter.create(() => 0),
  seat: Seat = 0,
): NearbyBoardProps {
  return {
    match: { gameId: adapter.id, round: 1, revision: 0, state },
    seat,
    names: ['Alice', 'Bob'],
    canAct: true,
    act: vi.fn(),
  };
}
function mount(adapter: GameAdapter, initial = props(adapter)) {
  const View = components[adapter.id as keyof typeof components];
  const element = (p: NearbyBoardProps) => (
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <View {...p} />
    </SettingsProvider>
  );
  const rendered = render(element(initial));
  return { ...rendered, update: (p: NearbyBoardProps) => rendered.rerender(element(p)), initial };
}
afterEach(cleanup);
describe('shared public board interactions', () => {
  it('Connect Four keeps its seven keyboard-usable column controls and guest disc labels', async () => {
    const p = props(four),
      view = mount(four, p),
      user = userEvent.setup();
    const group = screen.getByRole('group', { name: /Connect Four board/ });
    expect(within(group).getAllByRole('button')).toHaveLength(7);
    within(group).getAllByRole('button')[0]!.focus();
    await user.keyboard('{Enter}');
    expect(p.act).toHaveBeenCalledWith({ type: 'drop', col: 0 });
    const state = four.apply(p.match.state, 0, { type: 'drop', col: 0 }, () => 0)!;
    view.update({ ...p, seat: 1, match: { ...p.match, state } });
    expect(within(group).getAllByRole('button')[0]).toHaveAccessibleName(/Alice/);
    expect(within(group).getAllByRole('button')[0]).not.toHaveAccessibleName(/CPU/);
    expect(group.querySelector('.c4-disc-cpu')).not.toBeNull();
    view.update({ ...p, canAct: false });
    expect(
      within(group)
        .getAllByRole('button')
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });
  it('Gomoku shares aim/change aim/second-tap confirmation and clears the local mark while waiting', () => {
    const p = props(gomoku),
      view = mount(gomoku, p);
    const group = screen.getByRole('group', { name: /Gomoku board/ });
    const points = within(group).getAllByRole('button');
    expect(points).toHaveLength(225);
    fireEvent.click(points[112]!);
    expect(p.act).not.toHaveBeenCalled();
    expect(points[112]).toHaveAccessibleName(/again/);
    fireEvent.click(points[113]!);
    expect(p.act).not.toHaveBeenCalled();
    fireEvent.click(points[113]!);
    expect(p.act).toHaveBeenCalledExactlyOnceWith({ type: 'place', cell: 113 });
    fireEvent.click(points[114]!);
    view.update({ ...p, canAct: false });
    expect(group.querySelector('.gm-ghost')).toBeNull();
    const state = gomoku.apply(p.match.state, 0, { type: 'place', cell: 112 }, () => 0)!;
    view.update({ ...p, seat: 1, match: { ...p.match, state } });
    expect(points[112]).toHaveAccessibleName(/Alice/);
    fireEvent.click(points[100]!);
    fireEvent.click(points[100]!);
    expect(p.act).toHaveBeenLastCalledWith({ type: 'place', cell: 100 });
  });
  it('Reversi shares legal dots and flipping while each seat plays its own colour', () => {
    const p = props(reversi),
      view = mount(reversi, p);
    const group = screen.getByRole('group', { name: /Reversi board/ });
    expect(group.querySelectorAll('.rv-legal-dot')).toHaveLength(4);
    const cells = within(group).getAllByRole('button');
    fireEvent.click(cells[19]!);
    expect(p.act).toHaveBeenCalledWith({ type: 'place', cell: 19 });
    const state = reversi.apply(p.match.state, 0, { type: 'place', cell: 19 }, () => 0)!;
    view.update({ ...p, seat: 1, match: { ...p.match, state } });
    expect(cells[19]).toHaveAccessibleName(/Alice/);
    expect(group.querySelectorAll('.rv-disc-flip').length).toBeGreaterThan(0);
    const legal = within(group)
      .getAllByRole('button')
      .find((button) => !(button as HTMLButtonElement).disabled)!;
    fireEvent.click(legal);
    expect(p.act).toHaveBeenCalledTimes(2);
  });
  it.each([0, 1] as const)(
    'Checkers keeps seat %i at the bottom, maps actions, and auto-selects a forced continuation',
    (seat) => {
      const board = Array(64).fill(0),
        pieces: Record<number, number> = { 42: 1, 35: 2, 21: 2, 7: 2 };
      const canonical = (cell: number) => (seat === 0 ? cell : 63 - cell);
      for (const [cell, piece] of Object.entries(pieces))
        board[canonical(Number(cell))] = seat === 0 ? piece : piece === 1 ? 2 : 1;
      const moveCount = seat === 0 ? 10 : 11;
      const state: CheckersState = {
        board,
        toMove: seat === 0 ? 1 : 2,
        moveCount,
        quietPlies: 0,
        pendingJumpFrom: null,
        lastMove: {
          by: seat === 0 ? 2 : 1,
          move: { from: canonical(26), to: canonical(35), captured: -1 },
          crowned: false,
          stepId: moveCount,
        },
      };
      const p = props(checkers, state, seat),
        view = mount(checkers, p);
      const group = screen.getByRole('group', { name: /Checkers board/ });
      const cells = within(group).getAllByRole('button');
      expect(cells[42]!.querySelector('.ck-piece-you')).not.toBeNull();
      fireEvent.click(cells[42]!);
      fireEvent.click(cells[28]!);
      expect(p.act).toHaveBeenCalledExactlyOnceWith({
        type: 'step',
        from: canonical(42),
        to: canonical(28),
      });
      const next = checkers.apply(
        state,
        seat,
        { type: 'step', from: canonical(42), to: canonical(28) },
        () => 0,
      )!;
      view.update({ ...p, match: { ...p.match, state: next, revision: 1 } });
      expect(cells[28]).toHaveAttribute('aria-pressed', 'true');
      fireEvent.click(cells[14]!);
      expect(p.act).toHaveBeenLastCalledWith({
        type: 'step',
        from: canonical(28),
        to: canonical(14),
      });
      expect(screen.queryByText(/CPU/)).not.toBeInTheDocument();
    },
  );
});
