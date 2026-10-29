import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider } from '@/state/SettingsContext';
import { settingsSchema } from '@/storage/schemas';
import { applyLudo, createLudo, type State } from './ludo';
import LudoView from './ludoView';

afterEach(cleanup);
const names = ['Host', 'Aki', 'Yuki', 'CPU 3'];
function openingAt(seat: number): State {
  let state = createLudo(() => 0);
  while (state.turn !== seat) state = applyLudo(state, state.turn, { kind: 'roll' }, () => 0)!;
  return state;
}
function mount(state: State, seat: number, canAct = true, visible = true) {
  const act = vi.fn();
  const view = render(
    <SettingsProvider initialSettings={settingsSchema.defaultValue()}>
      <LudoView
        state={state}
        seat={seat}
        names={names}
        canAct={canAct}
        act={act}
        visible={visible}
      />
    </SettingsProvider>,
  );
  return { ...view, act };
}

describe('four-seat Ludo view', () => {
  it.each([1, 2, 3])('lets guest seat %i roll and moves only their bottom-facing pawns', (seat) => {
    const opening = openingAt(seat);
    let view = mount(opening, seat);
    fireEvent.click(screen.getByRole('button', { name: 'Roll the die' }));
    expect(view.act).toHaveBeenCalledWith({ kind: 'roll' });
    view.unmount();
    const rolled = applyLudo(opening, seat, { kind: 'roll' }, () => 0.99)!;
    view = mount(rolled, seat);
    const pawns = screen.getAllByRole('button', { name: 'Move your pawn in the yard' });
    expect(pawns).toHaveLength(4);
    for (const pawn of pawns) expect(pawn).toHaveClass(`ld-seat-${seat}`);
    expect(pawns[0]).toHaveStyle({ gridRow: '11 / span 1', gridColumn: '2 / span 1' });
    fireEvent.click(pawns[0]!);
    expect(view.act).toHaveBeenCalledWith({ kind: 'move', pawn: 0 });
    expect(screen.getByText(names[seat]!)).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: 'Host, in the yard' })).toHaveLength(4);
  });

  it('blocks input while awaiting a host update or while another seat plays', () => {
    const state = applyLudo(openingAt(2), 2, { kind: 'roll' }, () => 0.99)!;
    let view = mount(state, 2, false);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    view.unmount();
    view = mount(state, 1);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(view.act).not.toHaveBeenCalled();
  });

  it('does not render or arm die animations when the room is hidden', () => {
    mount(openingAt(2), 2, true, false);
    expect(screen.queryByRole('group', { name: 'Ludo board' })).not.toBeInTheDocument();
  });
});
