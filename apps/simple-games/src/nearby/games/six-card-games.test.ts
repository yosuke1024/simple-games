import { afterEach, describe, expect, it, vi } from 'vitest';
import { game as crazyEights } from './crazy-eights';
import { game as durak } from './durak';
import { game as spades } from './spades';
import { game as texasHoldem } from './texas-holdem';
import { game as blackjack, projectBlackjack, decodeBlackjack } from './blackjack';
import { game as indianRummy } from './indian-rummy';
import { GroupSession, validGroupSnapshot, type GroupGame } from '../groupSession';
import { NEARBY_CAPACITY, NEARBY_GAME_CODES, isGroupGameId } from '../../app/nearbyGameIds';
import { createSession, total, type Hand, type Session } from '../../games/blackjack/game/index';
import { project } from '../../games/blackjack/game/view';

const games = [crazyEights, durak, spades, texasHoldem, blackjack, indianRummy];
const bytes = (raw: unknown) => new TextEncoder().encode(JSON.stringify(raw)).length;
const longName = '🌸'.repeat(24);
function seededEntropy() {
  let s = 1234;
  vi.stubGlobal('crypto', {
    getRandomValues: (a: Uint32Array) => {
      for (let i = 0; i < a.length; i++) {
        s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
        a[i] = s;
      }
      return a;
    },
  });
}
function room(game: GroupGame) {
  return new GroupSession({
    game,
    name: longName,
    title: longName,
    room: 'a'.repeat(32),
    send: () => {},
    changed: () => {},
  });
}
afterEach(() => vi.unstubAllGlobals());
describe('six turn-based card tables over Nearby', () => {
  it('routes all six through seat-based rooms, including two-seat Durak', () => {
    for (const game of games) {
      expect(isGroupGameId(game.id)).toBe(true);
      expect(NEARBY_CAPACITY[game.id]).toBe(game.capacity);
    }
    expect(games.map((g) => NEARBY_GAME_CODES[g.id])).toEqual(['17', '18', '19', '1A', '1B', '1C']);
    expect(durak.capacity).toBe(2);
  });
  it.each(games)(
    '$id: completes a legal match with recipient-specific views and bounded frames',
    (game) => {
      seededEntropy();
      const r = room(game);
      r.ready();
      expect(r.start()).toBe(true);
      let moves = 0;
      const check = () => {
        const snapshot = r.snapshot();
        const names = snapshot.seats.map((s) => ({ ...s, name: longName }));
        for (let seat = 0; seat < game.capacity; seat++) {
          const state = game.project!(r.state, seat);
          expect(game.valid(state, seat)).toBe(true);
          expect(game.valid(state, (seat + 1) % game.capacity)).toBe(false);
          expect(game.valid({ ...(state as object), seed: 42 }, seat)).toBe(false);
          expect(state).not.toHaveProperty('stock');
          expect(state).not.toHaveProperty('shoe');
          const frame = {
            ...snapshot,
            you: seat,
            state,
            seats: names,
            ...(snapshot.final ? { final: names } : {}),
          };
          expect(validGroupSnapshot(frame, game)).toBe(true);
          expect(bytes(frame)).toBeLessThan(2800);
        }
      };
      while (!game.finished(r.state) && moves++ < 20000) {
        check();
        const seat = game.turn(r.state),
          action = game.cpu(r.state);
        expect(action).not.toBeNull();
        expect(game.apply(r.state, (seat + 1) % game.capacity, action)).toBeNull();
        expect(game.apply(r.state, seat, { ...(action as object), extra: true })).toBeNull();
        const before = r.revision;
        if (seat === 0) {
          expect(r.act('host', before - 1, r.seats[0]!.epoch, action)).toBe(false);
          expect(r.act('host', before, r.seats[0]!.epoch, action)).toBe(true);
          expect(r.act('host', before, r.seats[0]!.epoch, action)).toBe(false);
        } else expect(r.cpuStep()).toBe(true);
      }
      expect(moves).toBeLessThan(20000);
      check();
      expect(game.result!(r.snapshot().state)).toEqual(game.result!(r.state));
      expect(r.finalSeats).not.toBeNull();
      expect(r.canStart).toBe(false);
      r.ready();
      expect(r.start()).toBe(true);
      expect(r.round).toBe(2);
    },
    30000,
  );
  it('Durak preserves the guest hand while disconnected, across takeover and rejoin', () => {
    seededEntropy();
    const r = room(durak);
    r.request('guest', 'Guest');
    expect(r.approve('guest', 2)).toBe(false);
    expect(r.approve('guest', 1)).toBe(true);
    const ack = () =>
      r.receive('guest', { group: 1, type: 'ack', room: r.options.room, revision: r.revision });
    ack();
    r.ready('guest');
    r.ready();
    r.start();
    ack();
    const before = structuredClone(r.state),
      projected = r.snapshot('guest').state;
    const epoch = r.seats[1]!.epoch;
    r.disconnect('guest');
    expect(r.synchronized).toBe(false);
    expect(r.cpuStep()).toBe(false);
    expect(r.control(1, 'cpu')).toBe(true);
    expect(r.act('guest', r.revision, epoch, durak.cpu(r.state))).toBe(false);
    expect(r.resume('guest-2', 1)).toBe(true);
    expect(r.state).toEqual(before);
    expect(r.snapshot('guest-2').state).toEqual(projected);
  });
  it('freezes names and resets readiness when blackjack ends on the opening deal', () => {
    let seed = 0,
      initial = createSession(seed);
    while (initial.status === 'playing' && seed < 1000) initial = createSession(++seed);
    expect(initial.status).not.toBe('playing');
    const r = room({ ...blackjack, create: () => initial });
    r.request('guest', 'Guest');
    r.approve('guest', 1);
    r.ready('guest');
    r.ready();
    expect(r.start()).toBe(true);
    expect(r.finalSeats?.[1]?.name).toBe('Guest');
    expect(r.seats[0]?.ready).toBe(false);
    expect(r.seats[1]?.ready).toBe(false);
    expect(r.canStart).toBe(false);
    r.leave('guest');
    expect(r.finalSeats?.[1]?.name).toBe('Guest');
    expect(validGroupSnapshot(r.snapshot(), blackjack)).toBe(true);
  });
  it('packs sixteen settled split hands within the native frame budget without duplicating own cards', () => {
    // Capacity fixture: all sixteen hands use distinct physical cards from six decks.
    // This stresses transport independently of the chance of such a deal.
    const source = Array.from({ length: 312 }, (_, i) => i),
      hands: Hand[][] = [];
    for (let p = 0; p < 4; p++) {
      hands.push(
        Array.from({ length: 4 }, () => {
          const cards = source.splice(0, 3);
          return {
            cards,
            stake: 20,
            split: true,
            splitAces: false,
            status: total(cards).value > 21 ? 'bust' : 'stand',
            payout: total(cards).value > 21 ? -20 : 0,
          } satisfies Hand;
        }),
      );
    }
    const dealer = [source.shift()!, source.shift()!];
    const s: Session = {
      ...createSession(0),
      status: 'lost',
      hands,
      dealer,
      shoe: source,
      scores: hands.map((hs) => hs.reduce((n, h) => n + h.payout!, 0)),
      event: { kind: 'settled', seat: 0, cards: dealer },
    };
    const r = room({ ...blackjack, create: () => s });
    r.ready();
    r.start();
    for (let seat = 0; seat < 4; seat++) {
      const wire = projectBlackjack(s, seat);
      expect(wire.revealed[seat]).toEqual([]);
      expect(decodeBlackjack(wire, seat)).toEqual(project(s, seat));
      expect(decodeBlackjack({ ...wire, shoe: source }, seat)).toBeNull();
      const duplicate = structuredClone(wire);
      duplicate.revealed[seat] = duplicate.hands;
      expect(decodeBlackjack(duplicate, seat)).toBeNull();
      const malformed = structuredClone(wire);
      malformed.hands[0]![2] = 4;
      expect(decodeBlackjack(malformed, seat)).toBeNull();
      const snapshot = r.snapshot(),
        names = snapshot.seats.map((s) => ({ ...s, name: longName }));
      expect(
        bytes({ ...snapshot, you: seat, state: wire, seats: names, final: names }),
      ).toBeLessThan(2800);
    }
  });
});
