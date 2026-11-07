import { cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { SettingsProvider } from '../../state/SettingsContext';
import { settingsSchema } from '../../storage/schemas';
import type { NearbyMatch, Seat } from '../gameTypes';
import { loadGroupGame } from '../groupGames';
import BackgammonBoard from './backgammonView';
import FleetBoard from './fleet-searchView';
import RidgeBoard from './ridge-cannonsView';
import TerritoryBoard from './chain-territoryView';
import { adapter as backgammon } from './backgammon';
import { adapter as fleet } from './fleet-search';
import { adapter as ridge } from './ridge-cannons';
import { adapter as territory } from './chain-territory';
const names = ['Host', 'Alex', 'Sora', 'Nora'];
const wrapper = ({ children }: { children: ReactNode }) => (
  <SettingsProvider
    initialSettings={{ ...settingsSchema.defaultValue(), language: 'en', reducedMotion: true }}
  >
    {children}
  </SettingsProvider>
);
afterEach(cleanup);
const match = (gameId: NearbyMatch['gameId'], state: unknown): NearbyMatch => ({
  gameId,
  state,
  round: 1,
  revision: 1,
});
describe('added Nearby controls and private boards', () => {
  it.each([0, 1] as Seat[])(
    'backgammon seat %s selects and sends a legal checker move in its own orientation',
    (seat) => {
      let full = backgammon.create(() => 0.2) as object;
      full = { ...full, turn: seat, phase: 'roll', rolls: 1, roll: [6, 1] };
      full = backgammon.apply(full, seat, { kind: 'roll' }, () => 0.4) as object;
      const send = vi.fn();
      const state = backgammon.project(full, seat);
      const ui = render(
        <BackgammonBoard
          match={match('backgammon', state)}
          seat={seat}
          names={names}
          canAct
          act={send}
        />,
        { wrapper },
      );
      fireEvent.click(ui.container.querySelector('.bk-point-pickable')!);
      fireEvent.click(ui.container.querySelector('.bk-point-target')!);
      expect(send).toHaveBeenCalledTimes(1);
      expect(backgammon.apply(full, seat, send.mock.calls[0]![0], () => 0.2)).not.toBeNull();
      expect(ui.container.textContent).not.toContain('CPU');
      ui.rerender(
        <BackgammonBoard
          match={match('backgammon', state)}
          seat={seat}
          names={names}
          canAct={false}
          act={send}
        />,
      );
      expect([...ui.container.querySelectorAll('button')].every((b) => b.disabled)).toBe(true);
    },
  );
  it('Fleet Search cannot act while waiting and exposes no enemy ship before the result', () => {
    const full = fleet.create(() => 0.35);
    const send = vi.fn();
    const state = fleet.project(full, 1);
    const ui = render(
      <FleetBoard
        match={match('fleet-search', state)}
        seat={1}
        names={names}
        canAct={false}
        act={send}
      />,
      { wrapper },
    );
    for (const button of ui.container.querySelectorAll('button')) fireEvent.click(button);
    expect(send).not.toHaveBeenCalled();
    expect(state).not.toHaveProperty('fleets');
    expect(ui.container.querySelector('.fs-chart')).toBeInTheDocument();
  });
  it('Ridge Cannons sends the selected aim and prevents a second action while hidden', () => {
    const send = vi.fn();
    const m = match(
      'ridge-cannons',
      ridge.project(
        ridge.create(() => 0.3),
        0,
      ),
    );
    const ui = render(<RidgeBoard match={m} seat={0} names={names} canAct act={send} />, {
      wrapper,
    });
    fireEvent.click(ui.container.querySelector('.rc-fire')!);
    expect(send).toHaveBeenCalledExactlyOnceWith({ angle: 50, power: 80 });
    ui.rerender(
      <RidgeBoard match={m} seat={0} names={names} canAct={false} visible={false} act={send} />,
    );
    fireEvent.click(ui.container.querySelector('.rc-fire')!);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it('Territory maps the guest ownership and keeps the canonical cell numbers', () => {
    let full = territory.create(() => 0);
    full = territory.apply(full, 0, 0, () => 0);
    const send = vi.fn();
    const ui = render(
      <TerritoryBoard
        match={match('chain-territory', territory.project(full, 1))}
        seat={1}
        names={names}
        canAct
        act={send}
      />,
      { wrapper },
    );
    const cells = ui.container.querySelectorAll('.ct-cell');
    expect(cells[0]).toHaveAttribute('data-owner', '2');
    fireEvent.click(cells[0]!);
    expect(send).not.toHaveBeenCalled();
    fireEvent.click(cells[1]!);
    expect(send).toHaveBeenCalledExactlyOnceWith(1);
  });
  it.each(['hearts', 'daifugo', 'sevens', 'old-maid'] as const)(
    '%s renders each seat with only its own hand and disables actions while waiting',
    async (id) => {
      const { game, Board } = await loadGroupGame(id);
      const full = game.create();
      for (let seat = 0; seat < 4; seat++) {
        const state = game.project!(full, seat),
          send = vi.fn();
        const ui = render(
          <Board
            state={state}
            seat={seat}
            names={names}
            canAct={false}
            act={send}
            visible
            revision={1}
          />,
          { wrapper },
        );
        expect(game.valid(state, seat)).toBe(true);
        expect(ui.container.textContent).not.toContain('CPU');
        for (const button of ui.container.querySelectorAll('button')) fireEvent.click(button);
        expect(send).not.toHaveBeenCalled();
        expect(ui.container.children.length).toBeGreaterThan(0);
        ui.unmount();
      }
    },
  );
});
