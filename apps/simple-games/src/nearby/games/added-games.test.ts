import { afterEach, describe, expect, it, vi } from 'vitest';
import { adapter as backgammon, steps, isBackgammonView } from './backgammon';
import { adapter as ridge } from './ridge-cannons';
import { adapter as fleet, isFleetView, type FleetState } from './fleet-search';
import { adapter as territory, territoryState, isTerritoryView } from './chain-territory';
import { game as hearts } from './hearts';
import { game as daifugo } from './daifugo';
import { game as sevens } from './sevens';
import { game as oldMaid } from './old-maid';
import { GroupSession, validGroupSnapshot } from '../groupSession';
import type { GameAdapter, Seat } from '../gameTypes';
import { NEARBY_CAPACITY, NEARBY_GAME_CODES } from '../../app/nearbyGameIds';
import { GAMES } from '../../app/registry';
import { serializeListing, parseListing, metadataGameCode } from '../discovery';
function rng(seed = 91) {
  let s = seed;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}
afterEach(() => vi.unstubAllGlobals());
const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v)).length;
function checkPair(g: GameAdapter, s: unknown) {
  for (const seat of [0, 1] as const) {
    const view = g.project(s, seat);
    expect(g.isView(view)).toBe(true);
    expect(
      bytes({ type: 'state', gameId: g.id, round: 1, revision: 100, state: view }),
    ).toBeLessThan(2600);
    expect(g.isView({ ...(view as object), seed: 'leak' })).toBe(false);
  }
}
describe('the eight added Nearby games', () => {
  it('registers 22 games, fixed capacities, native eligibility and safe discovery codes', () => {
    expect(Object.keys(NEARBY_GAME_CODES)).toHaveLength(22);
    for (const id of [
      'hearts',
      'backgammon',
      'ridge-cannons',
      'fleet-search',
      'chain-territory',
      'daifugo',
      'sevens',
      'old-maid',
    ] as const) {
      expect(GAMES.find((g) => g.id === id)?.channel).toBeUndefined();
      expect(NEARBY_CAPACITY[id]).toBe(
        ['hearts', 'daifugo', 'sevens', 'old-maid'].includes(id) ? 4 : 2,
      );
      const label = `P-${metadataGameCode(id)}ABCD`,
        raw = serializeListing(label, '🌸'.repeat(24), id);
      expect(raw).not.toBeNull();
      expect(parseListing(raw, label)?.gameId).toBe(id);
    }
  });
  for (const g of [backgammon, ridge, fleet, territory])
    it(`${g.id}: both seats finish a legal match within the wire limit`, () => {
      const random = rng();
      let state = g.create(random),
        count = 0;
      while (!g.finished(g.project(state, 0)) && count++ < 3000) {
        checkPair(g, state);
        const view = g.project(state, 0),
          turn = g.turn(view);
        let action: unknown;
        if (g === backgammon && isBackgammonView(view))
          action = view.phase === 'move' ? { kind: 'move', ...steps(view)[0] } : { kind: 'roll' };
        else if (g === fleet && isFleetView(view)) {
          const mine = g.project(state, turn);
          if (!isFleetView(mine)) throw new Error('view');
          action = !mine.ready[turn]
            ? { type: 'start' }
            : {
                type: 'shot',
                cell: Array.from({ length: 64 }, (_, i) => i).find(
                  (c) => !mine.target.blocked.includes(c),
                ),
              };
        } else if (g === territory && isTerritoryView(view)) {
          const s = territoryState(view);
          const legal = s.board.flatMap((c, i) => (!c.owner || c.owner === s.turn ? [i] : []));
          action = legal[Math.floor(random() * legal.length)];
        } else action = { angle: 50, power: 80 };
        expect(g.apply(state, (1 - turn) as Seat, action, random)).toBeNull();
        const next = g.apply(state, turn, action, random);
        expect(next).not.toBeNull();
        state = next;
      }
      expect(count).toBeLessThan(3000);
      checkPair(g, state);
      expect(g.result(g.project(state, 0)).winner).not.toBeNull();
    });
  it('Fleet Search never projects an unhit enemy ship or a shuffle seed', () => {
    const full = fleet.create(rng()) as FleetState;
    const view = fleet.project(full, 0);
    expect(isFleetView(view)).toBe(true);
    const other = fleet.create(rng(9234)) as FleetState;
    expect(fleet.project({ ...full, fleets: [full.fleets[0], other.fleets[1]] }, 0)).toEqual(view);
    expect(view).not.toHaveProperty('fleets');
    expect(view).not.toHaveProperty('seed');
  });
  for (const game of [hearts, daifugo, sevens, oldMaid])
    it(`${game.id}: private projections, CPU handovers and complete multiplayer rounds`, () => {
      const random = rng(1234);
      vi.stubGlobal('crypto', {
        getRandomValues: (array: Uint32Array) => {
          for (let i = 0; i < array.length; i++) array[i] = Math.floor(random() * 0x100000000);
          return array;
        },
      });
      const room = new GroupSession({
        name: '🌸'.repeat(24),
        title: '🌸'.repeat(24),
        room: 'a'.repeat(32),
        game,
        send: () => {},
        changed: () => {},
      });
      room.ready();
      expect(room.start()).toBe(true);
      let count = 0,
        hostFinishedEarly = false;
      while (!game.finished(room.state) && count++ < 4000) {
        for (let seat = 0; seat < 4; seat++) {
          const view = game.project!(room.state, seat);
          expect(game.valid(view, seat)).toBe(true);
          expect(game.valid(view, (seat + 1) % 4)).toBe(false);
          expect(view).not.toHaveProperty('hands');
          expect(view).not.toHaveProperty('seed');
          expect(view).not.toHaveProperty('choices');
          expect(
            bytes({
              ...room.snapshot(),
              you: seat,
              state: view,
              seats: room.seats.map((s) => ({ ...s, name: '🌸'.repeat(24) })),
            }),
          ).toBeLessThan(2800);
        }
        expect(validGroupSnapshot(room.snapshot(), game)).toBe(true);
        const view = game.project!(room.state, 0) as { order?: number[]; phase?: string };
        if (view.order?.includes(0)) hostFinishedEarly = true;
        if (game.automatic?.(room.state) != null) {
          expect(room.automaticStep()).toBe(true);
          continue;
        }
        const turn = game.turn(room.state);
        if (turn === 0) {
          const action = view.phase === 'over' ? { kind: 'next' } : game.cpu(room.state);
          expect(room.act('host', room.revision, room.seats[0]!.epoch, action)).toBe(true);
        } else expect(room.cpuStep()).toBe(true);
      }
      expect(count).toBeLessThan(4000);
      expect(game.result?.(room.snapshot().state)).not.toBeNull();
      if (game !== hearts)
        expect(
          hostFinishedEarly ||
            (game.project!(room.state, 0) as { order: number[] }).order.indexOf(0) >= 0,
        ).toBe(true);
      const final = room.snapshot();
      const longSeats = final.seats.map((s) => ({ ...s, name: '🌸'.repeat(24) }));
      expect(bytes({ ...final, seats: longSeats, final: longSeats })).toBeLessThan(2800);
      const previous = room.state;
      room.ready();
      expect(room.start()).toBe(true);
      if (game === daifugo) {
        expect((room.state as { previousOrder: unknown }).previousOrder).toEqual(
          (previous as { order: unknown }).order,
        );
        expect((room.state as { phase: string }).phase).toBe('exchange');
        const before = structuredClone(
          room.state as { hands: number[][]; previousOrder: number[] },
        );
        const picks: Record<number, number[]> = {};
        for (let i = 0; i < 2; i++) {
          const seat = game.turn(room.state);
          const action = game.cpu(room.state) as { cards: number[] };
          picks[seat] = [...action.cards];
          expect(
            seat === 0
              ? room.act('host', room.revision, room.seats[0]!.epoch, action)
              : room.cpuStep(),
          ).toBe(true);
          if (i === 0) expect((room.state as { hands: number[][] }).hands).toEqual(before.hands);
        }
        const after = room.state as { hands: number[][]; phase: string };
        expect(after.phase).toBe('play');
        expect(new Set(after.hands.flat()).size).toBe(53);
        expect(after.hands.map((h) => h.length)).toEqual(before.hands.map((h) => h.length));
        for (const [seat, cards] of Object.entries(picks)) {
          const low = before.previousOrder[3 - before.previousOrder.indexOf(Number(seat))]!;
          for (const card of cards) expect(after.hands[low]).toContain(card);
        }
      }
    });
  it('a guest only receives its own cards before and after takeover/reconnection', () => {
    let outgoing: unknown;
    const room = new GroupSession({
      name: 'Host',
      title: 'Cards',
      room: 'a'.repeat(32),
      game: daifugo,
      send: (_peer, value) => {
        outgoing = value;
      },
      changed: () => {},
    });
    expect(room.request('guest', 'Guest')).toBe(true);
    expect(room.approve('guest', 1)).toBe(true);
    room.receive('guest', {
      group: 1,
      type: 'ack',
      room: room.options.room,
      revision: room.revision,
    });
    room.ready('guest');
    room.ready();
    room.start();
    const snapshot = room.snapshot('guest');
    expect(validGroupSnapshot(snapshot, daifugo)).toBe(true);
    expect(snapshot.state).toEqual(daifugo.project!(room.state, 1));
    expect(outgoing).toEqual(snapshot);
    const state = room.state;
    const epoch = room.seats[1]!.epoch;
    room.control(1, 'cpu');
    expect(room.state).toBe(state);
    expect(room.act('guest', room.revision, epoch, { kind: 'pass' })).toBe(false);
    room.control(1, 'human');
    room.receive('guest', {
      group: 1,
      type: 'ack',
      room: room.options.room,
      revision: room.revision,
    });
    room.disconnect('guest');
    expect(room.resume('new-link', 1)).toBe(true);
    expect(room.snapshot('new-link').state).toEqual(daifugo.project!(state, 1));
  });
});
