// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GroupController, ludoGroupGame } from './groupController';
import { NearbyController } from './controller';
import { applyLudo, type State } from './games/ludo';
import type { GroupGame } from './groupSession';
import type { NativeEvent, NearbyPlugin } from './native';

const controllers: GroupController[] = [];
function radio() {
  type Frame = { peerId?: string; data: string };
  const nodes = new Map<string, ReturnType<typeof node>>();
  const connected = new Set<string>();
  function node(id: string) {
    const listeners = new Set<(e: NativeEvent) => void>();
    const frames: Frame[] = [];
    const sent: Frame[] = [];
    let history: string | null = null;
    let setup: Parameters<NearbyPlugin['start']>[0] | undefined;
    const emit = (event: NativeEvent) => {
      for (const listener of listeners) listener(event);
    };
    const close = (guest: string) => {
      if (!connected.delete(guest)) return;
      nodes.get('host')!.emit({ type: 'disconnected', peerId: guest, reason: 'peer-disconnected' });
      nodes.get(guest)!.emit({ type: 'disconnected', peerId: 'host', reason: 'peer-disconnected' });
    };
    const plugin: NearbyPlugin = {
      start: vi.fn(async (options) => {
        setup = options;
      }),
      connect: vi.fn(async ({ peerId }) => {
        expect(peerId).toBe('host');
        connected.add(id);
        nodes.get('host')!.emit({ type: 'connected', peerId: id });
        emit({ type: 'connected', peerId: 'host' });
      }),
      send: vi.fn(async (frame) => {
        expect(frame.peerId).toBeTypeOf('string');
        frames.push(frame);
        sent.push(frame);
      }),
      disconnect: vi.fn(async ({ peerId }) => {
        close(id === 'host' ? peerId : id);
      }),
      stop: vi.fn(async () => {
        if (id === 'host') for (const peer of [...connected]) close(peer);
        else close(id);
      }),
      addListener: async (_event, listener) => {
        listeners.add(listener);
        return {
          remove: async () => {
            listeners.delete(listener);
          },
        };
      },
      readHistory: async () => ({ data: history }),
      writeHistory: async ({ data }) => {
        history = data;
      },
      clearHistory: async () => {
        history = null;
      },
    };
    return {
      plugin,
      emit,
      frames,
      sent,
      listeners,
      get setup() {
        return setup;
      },
    };
  }
  const add = (id: string) => {
    const value = node(id);
    nodes.set(id, value);
    return value;
  };
  const deliver = () => {
    for (const [id, source] of nodes)
      while (source.frames.length) {
        const frame = source.frames.shift()!;
        const guest = id === 'host' ? frame.peerId! : id;
        if (!connected.has(guest)) continue;
        const target = nodes.get(id === 'host' ? guest : 'host')!;
        target.emit({ type: 'data', peerId: id === 'host' ? 'host' : id, data: frame.data });
      }
  };
  return { add, deliver, connected };
}
async function until(condition: () => boolean, deliver = () => {}) {
  const deadline = performance.now() + 3000;
  while (!condition()) {
    if (performance.now() > deadline) throw new Error('Group integration did not settle');
    deliver();
    await nextTurn();
  }
}
async function encryptedMessage(controller: GroupController, peer: string, value: unknown) {
  const links = (
    controller as unknown as {
      links: Map<string, { channel: { send(raw: string): Promise<void> } }>;
    }
  ).links;
  await links.get(peer)!.channel.send(JSON.stringify(value));
}
async function gathering(guestCount: number, dice: number[] = [1, 6], hostBlocked: string[] = []) {
  const network = radio();
  const game: GroupGame = {
    ...ludoGroupGame,
    apply: (state, seat, action) =>
      applyLudo(state as State, seat, action, () => ((dice.shift() ?? 1) - 0.5) / 6),
  };
  const hostNative = network.add('host');
  await hostNative.plugin.writeHistory({
    data: JSON.stringify({
      version: 1,
      identity: 'a'.repeat(32),
      blocked: hostBlocked,
      gatherings: [],
    }),
  });
  const make = (host: boolean, name: string, plugin: NearbyPlugin) => {
    const c = new GroupController(
      { host, name, roomName: 'Ludo room', transport: 'ble' },
      () => {},
      plugin,
      game,
    );
    controllers.push(c);
    return c;
  };
  const host = make(true, 'Host', hostNative.plugin);
  await host.start();
  const guests: {
    controller: GroupController;
    native: ReturnType<typeof network.add>;
    id: string;
  }[] = [];
  const pump = (condition: () => boolean) => until(condition, network.deliver);
  const addGuest = async (
    id: string,
    options?: { identity?: string; blocked?: string[]; rejected?: boolean },
  ) => {
    const native = network.add(id);
    if (options)
      await native.plugin.writeHistory({
        data: JSON.stringify({
          version: 1,
          identity: options.identity ?? 'b'.repeat(32),
          blocked: options.blocked ?? [],
          gatherings: [],
        }),
      });
    const controller = make(false, id, native.plugin);
    await controller.start();
    native.emit({
      type: 'peer',
      id: 'host',
      name: hostNative.setup!.label,
      listing: hostNative.setup!.listing,
    });
    await until(() => controller.peers.length === 1);
    await controller.join('host');
    await pump(() =>
      options?.rejected
        ? controller.status === 'ended' && !host.hostSession!.pending.has(id)
        : host.hostSession!.pending.has(id),
    );
    const guest = { controller, native, id };
    guests.push(guest);
    return guest;
  };
  for (let i = 1; i <= guestCount; i++) await addGuest(`guest${i}`);
  const approveAll = async () => {
    guests.forEach((g, i) => host.approve(g.id, i + 1));
    await pump(
      () => guests.every((g) => g.controller.status === 'room') && host.hostSession!.synchronized,
    );
  };
  const start = async () => {
    await approveAll();
    host.ready();
    guests.forEach((g) => g.controller.ready());
    await pump(() => host.hostSession!.canStart && host.hostSession!.synchronized);
    host.startRound();
    await pump(
      () =>
        guests.every((g) => g.controller.snapshot?.state !== null) &&
        host.hostSession!.synchronized,
    );
  };
  return { network, host, hostNative, guests, pump, start, addGuest, approveAll };
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});
afterEach(async () => {
  const stops = controllers.splice(0).map((c) => c.stop());
  await vi.advanceTimersByTimeAsync(501);
  await Promise.all(stops);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('four devices using real WebCrypto group channels', () => {
  it('approves four humans, agrees on every seat and board, and closes all guests when the host leaves', async () => {
    const r = await gathering(3);
    expect(r.guests.every((g) => g.controller.snapshot === null)).toBe(true);
    expect(r.host.hostSession!.members.size).toBe(0);
    await r.start();
    expect(r.host.snapshot!.seats.map((s) => s.control)).toEqual([
      'human',
      'human',
      'human',
      'human',
    ]);
    for (let i = 0; i < 3; i++) {
      const guest = r.guests[i]!;
      expect(guest.controller.snapshot!.you).toBe(i + 1);
      expect(guest.controller.snapshot!.state).toEqual(r.host.snapshot!.state);
      expect(guest.controller.codes.get('host')).toBe(r.host.codes.get(guest.id));
      expect(guest.native.setup!.maxPeers).toBe(3);
    }
    r.host.act({ kind: 'roll' });
    await r.pump(
      () =>
        r.host.hostSession!.synchronized &&
        r.guests.every((g) => (g.controller.snapshot!.state as State).rollIndex === 1),
    );
    const stopping = r.host.stop();
    await r.pump(() => r.guests.every((g) => g.controller.status === 'ended'));
    await stopping;
    expect(r.network.connected.size).toBe(0);
    expect(r.hostNative.listeners.size).toBe(0);
    expect(r.guests.every((g) => g.native.listeners.size === 0)).toBe(true);
  });

  it('continues with three humans/one CPU, replaces a human after a six without rerolling, and explicitly approves a returning human', async () => {
    const r = await gathering(2);
    await r.start();
    expect(r.host.snapshot!.seats[3]!.control).toBe('cpu');
    r.host.act({ kind: 'roll' });
    await r.pump(() => r.guests[0]!.controller.canAct && r.host.hostSession!.synchronized);
    r.guests[0]!.controller.act({ kind: 'roll' });
    await r.pump(
      () =>
        (r.host.snapshot!.state as State).die === 6 &&
        r.host.hostSession!.synchronized &&
        r.guests[0]!.controller.canAct,
    );
    const before = structuredClone(r.host.snapshot!.state as State);
    const leaving = r.guests[0]!.controller.stop();
    await r.pump(() => !r.host.snapshot!.seats[1]!.connected);
    await leaving;
    expect(r.host.snapshot!.state).toEqual(before);
    expect(r.guests[1]!.controller.status).toBe('room');
    r.host.control(1, 'cpu');
    await r.pump(() => r.host.hostSession!.synchronized);
    await vi.advanceTimersByTimeAsync(451);
    await r.pump(
      () => (r.host.snapshot!.state as State).die === null && r.host.hostSession!.synchronized,
    );
    const after = r.host.snapshot!.state as State;
    expect(after.rollIndex).toBe(before.rollIndex);
    expect(after.lastRoll).toEqual(before.lastRoll);
    expect(after.pawns[1].some((p) => p > 0)).toBe(true);
    const returned = await r.addGuest('returned');
    expect(returned.controller.snapshot).toBeNull();
    r.host.approve('returned', 1);
    await r.pump(() => returned.controller.status === 'room' && r.host.hostSession!.synchronized);
    expect(returned.controller.snapshot!.you).toBe(1);
    expect(returned.controller.snapshot!.state).toEqual(after);
    expect(r.guests[1]!.controller.status).toBe('room');
    expect(r.network.connected).toEqual(new Set(['guest2', 'returned']));
  });

  it('declines one applicant without disrupting other encrypted links', async () => {
    const r = await gathering(3);
    r.host.approve('guest1', 1);
    r.host.approve('guest2', 2);
    await r.pump(
      () => r.guests[0]!.controller.status === 'room' && r.guests[1]!.controller.status === 'room',
    );
    r.host.decline('guest3');
    await r.pump(() => r.guests[2]!.controller.status === 'ended');
    expect(r.host.status).toBe('room');
    expect(r.network.connected).toEqual(new Set(['guest1', 'guest2']));
    expect(r.host.hostSession!.pending.size).toBe(0);
    expect(r.hostNative.plugin.disconnect).toHaveBeenCalledWith({ peerId: 'guest3' });
  });

  it('ignores a delayed encrypted move after control changes and isolates an encrypted replay to its sender', async () => {
    const r = await gathering(2);
    await r.start();
    r.host.act({ kind: 'roll' });
    await r.pump(() => r.guests[0]!.controller.canAct && r.host.hostSession!.synchronized);
    r.guests[0]!.controller.act({ kind: 'roll' });
    await r.pump(
      () =>
        (r.host.snapshot!.state as State).die === 6 &&
        r.host.hostSession!.synchronized &&
        r.guests[0]!.controller.canAct,
    );
    const guest = r.guests[0]!;
    const before = structuredClone(r.host.snapshot!.state);
    guest.controller.act({ kind: 'move', pawn: 0 });
    await until(() => guest.native.frames.length > 0);
    // The valid encrypted command is still in transit when control changes twice.
    r.host.control(1, 'cpu');
    r.host.control(1, 'human');
    await r.pump(
      () =>
        r.host.hostSession!.synchronized &&
        guest.controller.snapshot!.revision === r.host.snapshot!.revision &&
        guest.controller.canAct,
    );
    expect(r.host.snapshot!.state).toEqual(before);
    expect(guest.controller.status).toBe('room');
    guest.controller.act({ kind: 'move', pawn: 0 });
    await until(() => guest.native.frames.length > 0);
    const replay = guest.native.frames[0]!.data;
    await r.pump(
      () => (r.host.snapshot!.state as State).die === null && r.host.hostSession!.synchronized,
    );
    const moved = structuredClone(r.host.snapshot!.state);
    r.hostNative.emit({ type: 'data', peerId: 'guest1', data: replay });
    await r.pump(() => !r.host.snapshot!.seats[1]!.connected);
    expect(r.host.snapshot!.state).toEqual(moved);
    expect(r.guests[1]!.controller.status).toBe('room');
    expect(r.network.connected).toEqual(new Set(['guest2']));
  });

  it('can keep a host and three CPU seats open without a discovery or connection timeout', async () => {
    const r = await gathering(0);
    r.host.ready();
    r.host.startRound();
    expect(r.host.snapshot!.seats.map((seat) => seat.control)).toEqual([
      'human',
      'cpu',
      'cpu',
      'cpu',
    ]);
    expect(r.host.canAct).toBe(true);
    await vi.advanceTimersByTimeAsync(60001);
    expect(r.host.status).toBe('room');
    expect(r.hostNative.plugin.stop).not.toHaveBeenCalled();
  });

  it('times out an unapproved connection while preserving the host room and admitted guests', async () => {
    const r = await gathering(2);
    r.host.approve('guest1', 1);
    await r.pump(
      () => r.guests[0]!.controller.status === 'room' && r.host.hostSession!.synchronized,
    );
    await vi.advanceTimersByTimeAsync(60001);
    await r.pump(() => r.guests[1]!.controller.status === 'ended');
    expect(r.host.status).toBe('room');
    expect(r.guests[0]!.controller.status).toBe('room');
    expect(r.network.connected).toEqual(new Set(['guest1']));
  });

  it('rearms an admission timeout after foreground resumes instead of waiting forever', async () => {
    const r = await gathering(1);
    r.host.setForeground(false);
    r.guests[0]!.controller.setForeground(false);
    await vi.advanceTimersByTimeAsync(60001);
    expect(r.host.hostSession!.pending.has('guest1')).toBe(true);
    expect(r.guests[0]!.controller.status).toBe('connecting');
    r.host.setForeground(true);
    r.guests[0]!.controller.setForeground(true);
    await vi.advanceTimersByTimeAsync(60001);
    await r.pump(() => r.guests[0]!.controller.status === 'ended');
    expect(r.host.status).toBe('room');
    expect(r.host.hostSession!.pending.size).toBe(0);
  });

  it('does not let an unapproved encrypted peer cancel its approval deadline with a guessed state ACK', async () => {
    const r = await gathering(1);
    const guest = r.guests[0]!.controller;
    // A modified guest can omit its own timeout and learn a room ID from another
    // participant. The host must enforce approval independently of client behavior.
    guest.setForeground(false);
    const links = (
      guest as unknown as { links: Map<string, { channel: { send(raw: string): Promise<void> } }> }
    ).links;
    await links.get('host')!.channel.send(
      JSON.stringify({
        group: 1,
        type: 'ack',
        room: r.host.hostSession!.options.room,
        revision: r.host.hostSession!.revision,
      }),
    );
    r.network.deliver();
    await (r.host as unknown as { incoming: Promise<void> }).incoming;
    await vi.advanceTimersByTimeAsync(60001);
    expect(r.host.hostSession!.pending.has('guest1')).toBe(false);
    expect(r.hostNative.plugin.disconnect).toHaveBeenCalledWith({ peerId: 'guest1' });
    expect(r.host.status).toBe('room');
  });

  it('enforces a host block before an applicant can be admitted, without disconnecting an existing member', async () => {
    const r = await gathering(1, [1, 6], ['b'.repeat(32)]);
    await r.approveAll();
    const blocked = await r.addGuest('blocked', { identity: 'b'.repeat(32), rejected: true });
    expect(blocked.controller.snapshot).toBeNull();
    expect(r.host.hostSession!.members.has('blocked')).toBe(false);
    expect(r.host.hostSession!.pending.has('blocked')).toBe(false);
    expect(r.guests[0]!.controller.status).toBe('room');
    expect(r.network.connected).toEqual(new Set(['guest1']));
  });

  it('rejects a blocked host during the encrypted hello before accepting a room snapshot', async () => {
    const r = await gathering(0);
    const guest = await r.addGuest('cautious', { blocked: ['a'.repeat(32)], rejected: true });
    expect(guest.controller.snapshot).toBeNull();
    expect(guest.controller.status).toBe('ended');
    expect(r.host.hostSession!.pending.size).toBe(0);
    expect(r.host.status).toBe('room');
    expect(r.network.connected.size).toBe(0);
  });

  it('ignores a failed old native send after the same peer ID has reconnected with a new encrypted channel', async () => {
    const r = await gathering(2);
    await r.start();
    const send = vi.mocked(r.hostNative.plugin.send);
    const originalSend = send.getMockImplementation()!;
    let failOldSend: ((reason: Error) => void) | undefined;
    send.mockImplementation(async (frame) => {
      if (frame.peerId === 'guest1' && !failOldSend) {
        await new Promise<void>((_resolve, reject) => {
          failOldSend = reject;
        });
      } else await originalSend(frame);
    });
    r.host.control(3, 'cpu'); // Publish a state whose old guest1 native send stalls.
    await until(() => !!failOldSend);
    const oldLink = (
      r.host as unknown as { links: Map<string, { outgoing: Promise<void> }> }
    ).links.get('guest1')!;
    send.mockImplementation(originalSend);
    await r.guests[0]!.native.plugin.disconnect!({ peerId: 'host' });
    await r.pump(
      () => !r.host.snapshot!.seats[1]!.connected && r.guests[0]!.controller.status === 'ended',
    );
    const replacement = await r.addGuest('guest1');
    r.host.approve('guest1', 1);
    await r.pump(
      () => replacement.controller.status === 'room' && r.host.hostSession!.synchronized,
    );
    const replacementCode = replacement.controller.codes.get('host');
    failOldSend!(new Error('Late old transport failure'));
    await oldLink.outgoing;
    await nextTurn();
    expect(r.host.snapshot!.seats[1]!.connected).toBe(true);
    expect(replacement.controller.status).toBe('room');
    expect(r.host.codes.get('guest1')).toBe(replacementCode);
    expect(r.guests[1]!.controller.status).toBe('room');
    expect(r.network.connected).toEqual(new Set(['guest1', 'guest2']));
  });

  it('tears down the native room even if writing local history is stalled', async () => {
    const r = await gathering(1);
    await r.start();
    // Flush the first round's history task before arranging a stalled final save.
    for (let i = 0; i < 10; i++) await nextTurn();
    let finishWrite: (() => void) | undefined;
    const originalWrite = r.hostNative.plugin.writeHistory;
    const write = vi.spyOn(r.hostNative.plugin, 'writeHistory');
    write.mockImplementationOnce(async (value) => {
      await new Promise<void>((resolve) => {
        finishWrite = resolve;
      });
      await originalWrite(value);
    });
    const stopping = r.host.stop();
    await r.pump(() => r.host.status === 'ended' && r.guests[0]!.controller.status === 'ended');
    await stopping;
    expect(r.hostNative.plugin.stop).toHaveBeenCalledTimes(1);
    expect(r.hostNative.listeners.size).toBe(0);
    expect(r.network.connected.size).toBe(0);
    await until(() => !!finishWrite);
    finishWrite!();
    for (let i = 0; i < 10; i++) await nextTurn();
  });

  it('keeps the new group radio owner when an old single-room discovery start completes late', async () => {
    const network = radio();
    const native = network.add('host');
    const originalStart = vi.mocked(native.plugin.start).getMockImplementation()!;
    let completeOldStart: (() => void) | undefined;
    vi.mocked(native.plugin.start).mockImplementationOnce(async (options) => {
      await originalStart(options);
      await new Promise<void>((resolve) => {
        completeOldStart = resolve;
      });
    });
    const old = new NearbyController(
      { host: false, gameId: null, name: '', roomName: '', chatEnabled: false, transport: 'ble' },
      () => {},
      native.plugin,
    );
    const oldStart = old.start();
    await until(() => !!completeOldStart);
    const group = new GroupController(
      { host: true, name: 'Host', roomName: 'New room', transport: 'ble' },
      () => {},
      native.plugin,
    );
    controllers.push(group);
    await group.start();
    expect(old.state).toBe('ended');
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
    expect(native.setup).toMatchObject({ role: 'advertise', maxPeers: 3 });
    completeOldStart!();
    await oldStart;
    expect(group.status).toBe('room');
    expect(native.listeners.size).toBe(1);
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
    group.ready();
    group.startRound();
    expect(group.canAct).toBe(true);
  });

  it('ignores an identical repeated join without changing the original identity used for blocking', async () => {
    const r = await gathering(1);
    await r.approveAll();
    const original = { ...r.host.participants.get('guest1')! };
    const revision = r.host.hostSession!.revision;
    await encryptedMessage(r.guests[0]!.controller, 'host', {
      group: 1,
      type: 'join',
      ...original,
    });
    r.network.deliver();
    await (r.host as unknown as { incoming: Promise<void> }).incoming;
    expect(r.host.participants.get('guest1')).toEqual(original);
    expect(r.host.hostSession!.revision).toBe(revision);
    expect(r.host.hostSession!.pending.size).toBe(0);
    await r.host.block('guest1');
    const history = JSON.parse((await r.hostNative.plugin.readHistory()).data!);
    expect(history.blocked).toContain(original.identity);
    expect(r.host.participants.size).toBe(0);
  });

  it.each(['name', 'identity'] as const)(
    'rejects an approved peer that changes its %s in a repeated join',
    async (field) => {
      const r = await gathering(2);
      await r.approveAll();
      const original = { ...r.host.participants.get('guest1')! };
      const changed = {
        ...original,
        [field]: field === 'identity' ? 'c'.repeat(32) : 'Replacement',
      };
      await encryptedMessage(r.guests[0]!.controller, 'host', {
        group: 1,
        type: 'join',
        ...changed,
      });
      await r.pump(
        () => !r.host.snapshot!.seats[1]!.connected && r.guests[0]!.controller.status === 'ended',
      );
      expect(r.host.snapshot!.seats[1]!.name).toBe(original.name);
      expect(r.host.participants.has('guest1')).toBe(false);
      expect(
        [...r.host.participants.values()].some(
          (p) => p.identity === changed.identity && p.name === changed.name,
        ),
      ).toBe(false);
      expect(r.guests[1]!.controller.status).toBe('room');
      await r.host.block('guest1'); // A departed/spoofed row cannot target another installation.
      const history = JSON.parse((await r.hostNative.plugin.readHistory()).data!);
      expect(history.blocked).not.toContain('c'.repeat(32));
      const replacement = await r.addGuest('guest1', { identity: 'd'.repeat(32) });
      expect(r.host.participants.get('guest1')!.identity).toBe('d'.repeat(32));
      expect(replacement.controller.snapshot).toBeNull();
    },
  );

  it('ignores an identical repeated host hello and retains its block identity', async () => {
    const r = await gathering(1);
    await r.approveAll();
    const guest = r.guests[0]!.controller;
    const original = { ...guest.participants.get('host')! };
    await encryptedMessage(r.host, 'guest1', {
      group: 1,
      type: 'hello',
      ...original,
      title: 'Ludo room',
    });
    r.network.deliver();
    await (guest as unknown as { incoming: Promise<void> }).incoming;
    expect(guest.status).toBe('room');
    expect(guest.participants.get('host')).toEqual(original);
    await guest.block('host');
    const history = JSON.parse((await r.guests[0]!.native.plugin.readHistory()).data!);
    expect(history.blocked).toContain(original.identity);
  });

  it.each(['name', 'identity', 'title'] as const)(
    'rejects a host that changes its %s in a repeated hello',
    async (field) => {
      const r = await gathering(1);
      await r.approveAll();
      const guest = r.guests[0]!.controller;
      const original = { ...guest.participants.get('host')!, title: 'Ludo room' };
      await encryptedMessage(r.host, 'guest1', {
        group: 1,
        type: 'hello',
        ...original,
        [field]: field === 'identity' ? 'c'.repeat(32) : 'Replacement',
      });
      await r.pump(() => guest.status === 'ended');
      expect(guest.participants.size).toBe(0);
      expect(guest.codes.size).toBe(0);
      expect(r.host.status).toBe('room');
    },
  );
});
