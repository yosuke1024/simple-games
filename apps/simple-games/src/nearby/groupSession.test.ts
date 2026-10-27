import { describe, expect, it, vi } from 'vitest';
import { GroupSession, validGroupSnapshot, type GroupGame } from './groupSession';
import {
  applyLudo,
  createLudo,
  isLudoState,
  ludoCpuAction,
  ludoResult,
  type State,
} from './games/ludo';

function room(dice: number[] = [1, 6]) {
  const draw = vi.fn(() => ((dice.shift() ?? 1) - 0.5) / 6);
  const game: GroupGame = {
    id: 'ludo',
    capacity: 4,
    create: () => createLudo(draw),
    valid: isLudoState,
    turn: (s) => (s as State).turn,
    finished: (s) => ludoResult(s as State) !== null,
    apply: (s, seat, action) => applyLudo(s as State, seat, action, draw),
    cpu: (s) => ludoCpuAction(s as State),
  };
  const send = vi.fn();
  const session = new GroupSession({
    name: 'Host',
    title: 'Ludo room',
    room: 'a'.repeat(32),
    game,
    send,
    changed: vi.fn(),
  });
  const acknowledge = () => {
    for (const peer of session.members.keys())
      session.receive(peer, {
        group: 1,
        type: 'ack',
        room: session.options.room,
        revision: session.revision,
      });
  };
  const add = (peer: string, seat: number) => {
    expect(session.request(peer, peer)).toBe(true);
    expect(session.approve(peer, seat)).toBe(true);
    session.ready(peer);
  };
  const act = (peer: string, action: unknown) => {
    acknowledge();
    const snapshot = session.snapshot(peer);
    return session.act(peer, snapshot.revision, snapshot.seats[snapshot.you]!.epoch, action);
  };
  return { session, game, draw, send, acknowledge, add, act };
}

describe('four-seat host session with the real Ludo rules', () => {
  it('requires approval and every human ready, then publishes separate seat assignments and waits for all ACKs', () => {
    const { session, add, acknowledge, game } = room();
    add('Alice', 1);
    add('Bob', 2);
    expect(session.request('Carol', 'Carol')).toBe(true);
    expect(session.approve('Carol', 3)).toBe(true);
    session.ready();
    expect(session.start()).toBe(false);
    session.ready('Carol');
    expect(session.start()).toBe(true);
    expect(session.seats.map((s) => s.control)).toEqual(['human', 'human', 'human', 'human']);
    expect(session.canAct(0)).toBe(false);
    acknowledge();
    expect(session.canAct(0)).toBe(true);
    for (const peer of session.members.keys())
      expect(validGroupSnapshot(session.snapshot(peer), game)).toBe(true);
    expect(session.snapshot('Carol').you).toBe(3);
  });

  it('supports three humans and one CPU and preserves a rolled die when a departing human becomes CPU', () => {
    const { session, add, act, acknowledge, draw } = room();
    add('Alice', 1);
    add('Bob', 2);
    session.ready();
    expect(session.start()).toBe(true);
    expect(session.seats.map((s) => s.control)).toEqual(['human', 'human', 'human', 'cpu']);
    expect(act('host', { kind: 'roll' })).toBe(true); // 1, no pawn can leave yard.
    expect(act('Alice', { kind: 'roll' })).toBe(true); // 6, pawn selection is pending.
    const before = structuredClone(session.state as State);
    expect(before.die).toBe(6);
    session.disconnect('Alice');
    expect(session.state).toEqual(before);
    expect(session.cpuStep()).toBe(false);
    expect(session.control(1, 'cpu')).toBe(true);
    acknowledge();
    expect(session.cpuStep()).toBe(true);
    const after = session.state as State;
    expect(after.rollIndex).toBe(before.rollIndex);
    expect(after.lastRoll).toEqual(before.lastRoll);
    expect(after.pawns[1].filter((p) => p > 0)).toHaveLength(1);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(session.seats[2]!.connected).toBe(true);
  });

  it('rejects delayed/duplicate actions across human→CPU→human and restores a connected human without resetting the board', () => {
    const { session, add, act, acknowledge } = room();
    add('Alice', 1);
    session.ready();
    session.start();
    act('host', { kind: 'roll' });
    act('Alice', { kind: 'roll' });
    const stale = session.snapshot('Alice');
    const position = structuredClone(session.state);
    expect(session.control(1, 'cpu')).toBe(true);
    expect(session.control(1, 'human')).toBe(true);
    acknowledge();
    expect(session.state).toEqual(position);
    expect(
      session.act('Alice', session.revision, stale.seats[1]!.epoch, { kind: 'move', pawn: 0 }),
    ).toBe(false);
    expect(
      session.act('Alice', stale.revision, session.seats[1]!.epoch, { kind: 'move', pawn: 0 }),
    ).toBe(false);
    const current = session.snapshot('Alice');
    expect(
      session.act('Alice', current.revision, current.seats[1]!.epoch, { kind: 'move', pawn: 0 }),
    ).toBe(true);
    const moved = structuredClone(session.state);
    expect(
      session.act('Alice', current.revision, current.seats[1]!.epoch, { kind: 'move', pawn: 0 }),
    ).toBe(false);
    expect(session.state).toEqual(moved);
  });

  it("holds an away human's seat: everyone waits, nobody else can take it, and joins are closed mid-match", () => {
    const { session, add, act, acknowledge, send } = room();
    add('Alice', 1);
    session.ready();
    session.start();
    act('host', { kind: 'roll' });
    act('Alice', { kind: 'roll' });
    const position = structuredClone(session.state);
    session.disconnect('Alice');
    expect(session.seats[1]).toMatchObject({ name: 'Alice', control: 'human', connected: false });
    expect(session.isHeld(1)).toBe(true);
    acknowledge();
    expect(session.synchronized).toBe(false);
    expect(session.cpuStep()).toBe(false);
    expect(session.joinOpen).toBe(false);
    expect(session.discoverable).toBe(false);
    expect(session.request('Returned', 'Someone')).toBe(false);
    expect(session.pending.size).toBe(0);
    // Even a CPU the host chooses does not open the seat to someone new mid-match.
    expect(session.control(1, 'cpu')).toBe(true);
    expect(session.isHeld(1)).toBe(true);
    expect(session.approve('Returned', 1)).toBe(false);
    send.mockClear();
    acknowledge();
    expect(session.cpuStep()).toBe(true);
    expect((session.state as State).rollIndex).toBe((position as State).rollIndex);
    expect(send.mock.calls.some(([peer]) => peer === 'Alice')).toBe(false);
  });

  it('returns a held seat to its person on a new link without approval, keeping a CPU the host chose', () => {
    const { session, add, act, acknowledge } = room();
    add('Alice', 1);
    session.ready();
    session.start();
    act('host', { kind: 'roll' });
    act('Alice', { kind: 'roll' });
    const before = structuredClone(session.state);
    const stale = session.snapshot('Alice');
    session.disconnect('Alice');
    expect(session.resume('Alice-2', 2)).toBe(false); // Seat 2 is a CPU nobody holds.
    expect(session.resume('Alice-2', 1)).toBe(true);
    expect(session.members.get('Alice-2')).toBe(1);
    expect(session.seats[1]).toMatchObject({ control: 'human', connected: true });
    expect(session.state).toEqual(before);
    expect(
      session.act('Alice', session.revision, stale.seats[1]!.epoch, { kind: 'move', pawn: 0 }),
    ).toBe(false);
    expect(act('Alice-2', { kind: 'move', pawn: 0 })).toBe(true);

    session.disconnect('Alice-2');
    expect(session.control(1, 'cpu')).toBe(true);
    expect(session.resume('Alice-3', 1)).toBe(true);
    expect(session.seats[1]).toMatchObject({ control: 'cpu', connected: true });
    acknowledge();
    expect(session.control(1, 'human')).toBe(true);
    expect((session.state as State).turn).toBe(1); // The six earned another roll.
    expect(act('Alice-3', { kind: 'roll' })).toBe(true);
    expect(session.snapshot('Alice-3').you).toBe(1);
  });

  it('never transfers the host seat and ends all admitted and pending peers exactly once', () => {
    const { session, add, send } = room();
    add('Alice', 1);
    add('Bob', 2);
    session.request('Carol', 'Carol');
    expect(session.approve('Carol', 0)).toBe(false);
    expect(session.control(0, 'cpu')).toBe(false);
    send.mockClear();
    session.end();
    session.end();
    expect(send.mock.calls).toEqual(
      ['Alice', 'Bob', 'Carol'].map((p) => [p, { group: 1, type: 'ended' }]),
    );
    expect(session.start()).toBe(false);
    expect(session.approve('Carol', 3)).toBe(false);
    expect(session.cpuStep()).toBe(false);
  });

  it('releases a seat whose person dropped before acknowledging any state', () => {
    const { session } = room();
    expect(session.request('Alice', 'Alice')).toBe(true);
    expect(session.approve('Alice', 1)).toBe(true);
    expect(session.disconnect('Alice')).toBe(true);
    expect(session.seats[1]).toMatchObject({ control: 'cpu', name: '' });
    expect(session.isHeld(1)).toBe(false);
    expect(session.request('Alice', 'Alice')).toBe(true); // They can simply apply again.
  });

  it('gives a deliberately left seat to a CPU at once and stops holding it', () => {
    const { session, add, act, acknowledge } = room();
    add('Alice', 1);
    add('Bob', 2);
    session.ready();
    session.start();
    act('host', { kind: 'roll' });
    act('Alice', { kind: 'roll' });
    const before = structuredClone(session.state as State);
    session.leave('Alice');
    expect(session.seats[1]).toMatchObject({ name: '', control: 'cpu', connected: false });
    expect(session.isHeld(1)).toBe(false);
    expect(session.members.has('Alice')).toBe(false);
    expect(session.resume('Alice-2', 1)).toBe(false);
    acknowledge();
    expect(session.synchronized).toBe(true);
    expect(session.cpuStep()).toBe(true);
    expect((session.state as State).rollIndex).toBe(before.rollIndex);
    expect(session.seats[2]!.connected).toBe(true);
    session.request('Carol', 'Carol');
    expect(session.pending.size).toBe(0); // Mid-match, the freed seat waits for the next match.
  });

  it('recruits only between matches and while a guest seat is not human', () => {
    const { session, add, acknowledge } = room();
    expect(session.discoverable).toBe(true);
    add('Alice', 1);
    add('Bob', 2);
    expect(session.discoverable).toBe(true);
    add('Carol', 3);
    expect(session.discoverable).toBe(false);
    session.leave('Carol');
    expect(session.discoverable).toBe(true);
    acknowledge(); // Bob has seen his seat.
    session.disconnect('Bob');
    expect(session.discoverable).toBe(true); // Seat 3 is a CPU again; Bob's seat stays his.
    expect(session.request('Dan', 'Dan')).toBe(true);
    expect(session.approve('Dan', 2)).toBe(false);
    expect(session.approve('Dan', 3)).toBe(true);
    expect(session.discoverable).toBe(false);
    session.ready();
    session.ready('Alice');
    session.ready('Dan');
    expect(session.canStart).toBe(false); // Bob is away and still human.
    expect(session.control(2, 'cpu')).toBe(true);
    expect(session.start()).toBe(true);
    expect(session.discoverable).toBe(false);
  });

  it('freezes the seats as a round finishes and sends them, so a later leave cannot rename the result', () => {
    const { session, add, act, game } = room([1]);
    add('Alice', 1);
    session.ready();
    session.start();
    expect(session.snapshot('Alice').final).toBeUndefined();
    session.state = {
      ...createLudo(() => 0),
      pawns: [
        [0, 0, 0, 0],
        [58, 59, 59, 59],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      turn: 1,
      rollIndex: 4,
      lastRoll: { seat: 0, die: 1, kind: 'autoPass' },
    } satisfies State;
    expect(act('Alice', { kind: 'roll' })).toBe(true);
    expect(act('Alice', { kind: 'move', pawn: 0 })).toBe(true);
    expect(ludoResult(session.state as State)?.winner).toBe(1);
    session.leave('Alice');
    expect(session.seats[1]).toMatchObject({ control: 'cpu', name: '' });
    const snapshot = session.snapshot();
    expect(snapshot.final![1]).toMatchObject({ control: 'human', name: 'Alice' });
    expect(validGroupSnapshot(snapshot, game)).toBe(true);
    expect(validGroupSnapshot({ ...snapshot, final: snapshot.final!.slice(1) }, game)).toBe(false);
    expect(validGroupSnapshot({ ...snapshot, state: createLudo(() => 0) }, game)).toBe(false);
    session.ready();
    expect(session.start()).toBe(true);
    expect(session.snapshot().final).toBeUndefined();
  });

  it('requires Ready for newly approved or restored humans after a finished round', () => {
    const { session, add, act } = room([1]);
    add('Alice', 1);
    session.ready();
    session.start();
    // Put a legal near-finish board on the table, then finish through the real rules.
    session.state = {
      ...createLudo(() => 0),
      pawns: [
        [58, 59, 59, 59],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ],
      rollIndex: 4,
      lastRoll: { seat: 3, die: 1, kind: 'autoPass' },
    } satisfies State;
    expect(act('host', { kind: 'roll' })).toBe(true);
    expect(act('host', { kind: 'move', pawn: 0 })).toBe(true);
    expect(ludoResult(session.state as State)?.winner).toBe(0);
    expect(session.seats[0]!.ready).toBe(false);
    expect(session.seats[1]!.ready).toBe(false);

    expect(session.request('Bob', 'Bob')).toBe(true);
    expect(session.approve('Bob', 2)).toBe(true);
    expect(session.seats[2]!.ready).toBe(false);
    session.ready();
    session.ready('Alice');
    expect(session.canStart).toBe(false);
    session.ready('Bob');
    expect(session.canStart).toBe(true);

    expect(session.control(1, 'cpu')).toBe(true);
    expect(session.control(1, 'human')).toBe(true);
    expect(session.seats[1]!.ready).toBe(false);
    expect(session.canStart).toBe(false);
    session.ready('Alice');
    expect(session.canStart).toBe(true);
  });
});
