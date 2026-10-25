import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NativeEvent, NearbyPlugin } from './native';
import { NearbyController } from './controller';
import { loadHistory } from './history';
import { serializeListing } from './discovery';
import { adapter as nimAdapter } from './games/nim';
import { adapter as yachtAdapter } from './games/yacht';
import { NEARBY_GAME_CODES } from '../app/nearbyGameIds';
import { metadataGameCode } from './discovery';
import type { NearbyGameId } from './gameTypes';

// Channel crypto is tested separately with actual WebCrypto. This synchronous
// channel seam makes lost-ACK and lifecycle timers deterministic.
vi.mock('./channel', () => ({
  Channel: {
    create: async (
      _host: boolean,
      send: (raw: string) => Promise<void>,
      ready: () => void,
      receive: (raw: string) => void,
    ) => ({
      code: '123456',
      reconnectKey: {},
      resumeProof: async () => 'proof',
      verifyResume: async () => true,
      start: async () => {
        ready();
      },
      send,
      receive: async (raw: string) => receive(raw),
      close: () => {},
    }),
  },
}));
const controllers: NearbyController[] = [];
function create(...args: ConstructorParameters<typeof NearbyController>) {
  const controller = new NearbyController(...args);
  controllers.push(controller);
  return controller;
}
function native() {
  let listener: ((event: NativeEvent) => void) | null = null;
  let data: string | null = null;
  const frames: string[] = [];
  const plugin: NearbyPlugin = {
    start: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    stop: vi.fn(async () => {}),
    send: vi.fn(async ({ data }) => {
      frames.push(data);
    }),
    addListener: async (_name, callback) => {
      listener = callback;
      return {
        remove: async () => {
          listener = null;
        },
      };
    },
    readHistory: vi.fn(async () => ({ data })),
    writeHistory: async (v) => {
      data = v.data;
    },
    clearHistory: async () => {
      data = null;
    },
  };
  return { plugin, frames, event: (v: NativeEvent) => listener?.(v) };
}
async function settle() {
  for (let i = 0; i < 100; i++) await Promise.resolve();
}
async function setup() {
  const a = native(),
    b = native();
  const host = create(
    { host: true, name: 'A', public: true, chatEnabled: true, gameId: 'yacht', transport: 'ble' },
    () => {},
    a.plugin,
  );
  const guest = create(
    { host: false, name: 'B', public: false, chatEnabled: true, gameId: 'yacht', transport: 'ble' },
    () => {},
    b.plugin,
  );
  await Promise.all([host.start(), guest.start()]);
  a.event({ type: 'connected' });
  b.event({ type: 'connected' });
  async function pump() {
    for (let i = 0; i < 10; i++) {
      await settle();
      while (a.frames.length) b.event({ type: 'data', data: a.frames.shift()! });
      while (b.frames.length) a.event({ type: 'data', data: b.frames.shift()! });
    }
    await settle();
  }
  await pump();
  return { a, b, host, guest, pump };
}
afterEach(async () => {
  if (!vi.isFakeTimers()) vi.useFakeTimers();
  const closing = controllers.splice(0).map((value) => value.stop());
  await vi.advanceTimersByTimeAsync(1751);
  await Promise.all(closing);
  vi.useRealTimers();
});

function browser(p: ReturnType<typeof native>) {
  return create(
    { host: false, name: '', public: false, chatEnabled: false, gameId: null, transport: 'ble' },
    () => {},
    p.plugin,
  );
}

function advertise(
  p: ReturnType<typeof native>,
  id = 'host',
  gameId: NearbyGameId = 'nim',
  name = 'Pixel',
) {
  const label = `P-${metadataGameCode(gameId)}1234`;
  p.event({ type: 'peer', id, name: label, listing: serializeListing(label, name, gameId)! });
}

describe('nearby all-game discovery handoff', () => {
  it('lists compatible metadata across all games without opening storage, a channel, or a session', async () => {
    const p = native();
    const c = browser(p);
    await c.start();
    for (const gameId of Object.keys(NEARBY_GAME_CODES) as NearbyGameId[])
      advertise(p, gameId, gameId);
    p.event({ type: 'peer', id: 'legacy', name: 'P-011234' });
    p.event({ type: 'peer', id: 'occupied', name: 'P-811234' });
    p.event({ type: 'peer', id: 'broken', name: 'P-811234', listing: '{' });
    p.event({
      type: 'peer',
      id: 'wrong-version',
      name: 'P-811234',
      listing: JSON.stringify({
        v: 1,
        label: 'P-811234',
        name: 'Old',
        gameId: 'yacht',
        protocol: 5,
        available: true,
      }),
    });
    await settle();
    expect(c.peers.map((p) => p.gameId)).toEqual(Object.keys(NEARBY_GAME_CODES));
    expect(c.peers.every((p) => p.hostName === 'Pixel')).toBe(true);
    expect(c.gameId).toBeNull();
    expect(c.session).toBeNull();
    expect(p.plugin.readHistory).not.toHaveBeenCalled();
    expect(p.frames).toEqual([]);
    expect(p.plugin.start).toHaveBeenCalledExactlyOnceWith({
      role: 'browse',
      label: 'F-000000',
      transport: 'ble',
    });
    p.event({ type: 'peerLost', id: 'nim' });
    expect(c.peers).toHaveLength(12);
    advertise(p, 'yacht', 'yacht', 'New name');
    expect(c.peers.find((p) => p.id === 'yacht')?.hostName).toBe('New name');
    p.event({ type: 'peer', id: 'yacht', name: 'P-811234', listing: '{}' });
    expect(c.peers.some((p) => p.id === 'yacht')).toBe(false);
  });

  it('promotes the selected scan to its game, then requires host approval and both Ready', async () => {
    const a = native(),
      b = native();
    const host = create(
      {
        host: true,
        name: 'Pixel',
        public: true,
        chatEnabled: false,
        gameId: 'nim',
        transport: 'ble',
      },
      () => {},
      a.plugin,
      nimAdapter,
    );
    const guest = browser(b);
    await Promise.all([host.start(), guest.start()]);
    const listing = vi.mocked(a.plugin.start).mock.calls[0]![0].listing;
    b.event({ type: 'peer', id: 'host', name: host.label, listing });
    expect(await guest.connectToGame('host', 'iPhone', nimAdapter)).toBe(true);
    expect(guest.setup).toMatchObject({ name: 'iPhone', gameId: 'nim', host: false });
    expect(guest.session?.gameId).toBe('nim');
    expect(b.plugin.start).toHaveBeenCalledTimes(1);
    expect(b.plugin.stop).not.toHaveBeenCalled();
    expect(b.plugin.connect).toHaveBeenCalledExactlyOnceWith({ peerId: 'host' });
    a.event({ type: 'connected' });
    b.event({ type: 'connected' });
    const pump = async () => {
      for (let i = 0; i < 10; i++) {
        await settle();
        while (a.frames.length) b.event({ type: 'data', data: a.frames.shift()! });
        while (b.frames.length) a.event({ type: 'data', data: b.frames.shift()! });
      }
      await settle();
    };
    await pump();
    expect(guest.session?.peerName).toBe('Pixel');
    expect(guest.state).toBe('connecting');
    expect(guest.gathering).toBeNull();
    guest.session!.ready();
    expect(guest.session!.match).toBeNull();
    host.session!.approve();
    await pump();
    expect(guest.state).toBe('room');
    guest.session!.proposeGame();
    await pump();
    guest.session!.ready();
    await pump();
    expect(guest.session!.match).toBeNull();
    host.session!.ready();
    await pump();
    expect(guest.session!.match?.gameId).toBe('nim');
    expect(host.session!.pending).toBe(false);
  });

  it.each(['adapter', 'lost', 'name'] as const)(
    'rejects a stale/invalid selection before storage or connection: %s',
    async (failure) => {
      const p = native();
      const c = browser(p);
      await c.start();
      advertise(p);
      if (failure === 'lost') p.event({ type: 'peerLost', id: 'host' });
      expect(
        await c.connectToGame(
          'host',
          failure === 'name' ? ' invalid' : 'Guest',
          failure === 'adapter' ? yachtAdapter : nimAdapter,
        ),
      ).toBe(false);
      expect(c.state).toBe('ended');
      expect(c.reason).toBe('connectionError');
      expect(p.plugin.connect).not.toHaveBeenCalled();
      expect(p.plugin.readHistory).not.toHaveBeenCalled();
    },
  );

  it.each(['lost', 'changed', 'stop'] as const)(
    'does not connect after selection becomes invalid while storage loads: %s',
    async (failure) => {
      const p = native();
      const c = browser(p);
      await c.start();
      advertise(p);
      let finish!: (value: { data: null }) => void;
      p.plugin.readHistory = vi.fn(
        () =>
          new Promise<{ data: null }>((resolve) => {
            finish = resolve;
          }),
      );
      const pending = c.connectToGame('host', 'Guest', nimAdapter);
      await settle();
      if (failure === 'lost') p.event({ type: 'peerLost', id: 'host' });
      else if (failure === 'changed') advertise(p, 'host', 'nim', 'Someone else');
      else await c.stop();
      finish({ data: null });
      expect(await pending).toBe(false);
      expect(c.state).toBe('ended');
      expect(c.session).toBeNull();
      expect(p.plugin.connect).not.toHaveBeenCalled();
    },
  );

  it('ignores disappearance of an advertisement once the selected native connection has begun', async () => {
    const p = native();
    const c = browser(p);
    await c.start();
    advertise(p);
    let finish!: () => void;
    p.plugin.connect = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = c.connectToGame('host', 'Guest', nimAdapter);
    await settle();
    p.event({ type: 'peerLost', id: 'host' });
    finish();
    expect(await pending).toBe(true);
    expect(c.state).toBe('connecting');
    expect(p.plugin.stop).not.toHaveBeenCalled();
  });

  it('does not let a stopped selection close a newer scan after its history request resolves', async () => {
    const p = native();
    const old = browser(p);
    await old.start();
    advertise(p);
    let finish!: (value: { data: null }) => void;
    p.plugin.readHistory = vi.fn(
      () =>
        new Promise<{ data: null }>((resolve) => {
          finish = resolve;
        }),
    );
    const pending = old.connectToGame('host', 'Guest', nimAdapter);
    await settle();
    await old.stop();
    const next = browser(p);
    await next.start();
    const stopped = vi.mocked(p.plugin.stop).mock.calls.length;
    finish({ data: null });
    expect(await pending).toBe(false);
    expect(p.plugin.stop).toHaveBeenCalledTimes(stopped);
    expect(next.state).toBe('discovering');
    expect(p.plugin.connect).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'closes a selected-name mismatch before admission/history (global=%s)',
    async (global) => {
      const a = native(),
        b = native();
      const host = create(
        {
          host: true,
          name: 'Real name',
          public: true,
          chatEnabled: false,
          gameId: 'yacht',
          transport: 'ble',
        },
        () => {},
        a.plugin,
      );
      const guest = global
        ? browser(b)
        : create(
            {
              host: false,
              name: 'Guest',
              public: false,
              chatEnabled: false,
              gameId: 'yacht',
              transport: 'ble',
            },
            () => {},
            b.plugin,
          );
      await Promise.all([host.start(), guest.start()]);
      b.event({
        type: 'peer',
        id: 'host',
        name: host.label,
        listing: serializeListing(host.label, 'Other name', 'yacht')!,
      });
      if (global) expect(await guest.connectToGame('host', 'Guest', yachtAdapter)).toBe(true);
      else await guest.connect('host');
      a.event({ type: 'connected' });
      b.event({ type: 'connected' });
      for (let i = 0; i < 10; i++) {
        await settle();
        while (a.frames.length) b.event({ type: 'data', data: a.frames.shift()! });
        while (b.frames.length) a.event({ type: 'data', data: b.frames.shift()! });
      }
      await settle();
      expect(guest.state).toBe('ended');
      expect(guest.reason).toBe('connectionError');
      expect(guest.gathering).toBeNull();
      expect(guest.session!.paired).toBe(false);
    },
  );
});
describe('nearby lifecycle and persistence', () => {
  it('filters discovery by the selected game and never connects an unlisted peer', async () => {
    const p = native();
    const controller = create(
      {
        host: false,
        name: 'A',
        public: false,
        chatEnabled: false,
        gameId: 'yacht',
        transport: 'ble',
      },
      () => {},
      p.plugin,
    );
    await controller.start();
    p.event({ type: 'peer', id: 'other-game', name: 'P-0A1234' });
    p.event({ type: 'peer', id: 'old-label', name: 'Nearby Play' });
    p.event({ type: 'peer', id: 'same-game', name: 'F-01ABCD' });
    advertise(p, 'current-game', 'yacht');
    p.event({ type: 'peer', id: 'occupied', name: 'P-811234' });
    p.event({ type: 'peer', id: 'invalid-metadata', name: 'P-811234', listing: '{}' });
    await settle();
    expect(controller.peers).toEqual([
      { id: 'same-game', name: 'F-01ABCD', gameId: 'yacht' },
      { id: 'current-game', name: 'P-811234', gameId: 'yacht', hostName: 'Pixel' },
    ]);
    await controller.connect('other-game');
    expect(p.plugin.connect).not.toHaveBeenCalled();
    await controller.connect('same-game');
    expect(p.plugin.connect).toHaveBeenCalledExactlyOnceWith({ peerId: 'same-game' });
  });
  it('rejects a mismatched selected game and adapter before opening the radio', async () => {
    const p = native();
    const controller = create(
      { host: true, name: 'A', public: false, chatEnabled: false, gameId: 'nim', transport: 'ble' },
      () => {},
      p.plugin,
    );
    await controller.start();
    expect(controller.state).toBe('ended');
    expect(controller.reason).toBe('connectionError');
    expect(controller.session).toBeNull();
    expect(p.plugin.start).not.toHaveBeenCalled();
  });
  it('does no radio work on construction; approves, chats, starts Yacht and retains history after disconnect', async () => {
    const p = native();
    create(
      {
        host: true,
        name: 'A',
        public: false,
        chatEnabled: true,
        gameId: 'yacht',
        transport: 'ble',
      },
      () => {},
      p.plugin,
    );
    expect(p.plugin.start).not.toHaveBeenCalled();
    const { a, b, host, guest, pump } = await setup();
    expect(host.session?.paired).toBe(false);
    expect(host.session?.sendChat('before approval')).toBe(false);
    host.session!.approve();
    await pump();
    expect(guest.state).toBe('room');
    expect(host.session!.match).toBeNull();
    host.session!.sendChat('Hello');
    await pump();
    expect(guest.session!.messages[0]?.text).toBe('Hello');
    expect(host.session!.messages[0]?.status).toBe('delivered');
    host.session!.proposeGame();
    await pump();
    host.session!.ready();
    await pump();
    expect(host.session!.match).toBeNull();
    guest.session!.ready();
    await pump();
    expect(host.session!.match?.round).toBe(1);
    a.event({ type: 'disconnected', reason: 'background' });
    b.event({ type: 'disconnected', reason: 'background' });
    await settle();
    expect(host.state).toBe('reconnecting');
    expect(a.plugin.stop).not.toHaveBeenCalled();
    const saved = (await loadHistory(a.plugin)).gatherings[0]!;
    expect(saved.messages[0]?.text).toBe('Hello');
    expect(saved.games[0]?.finished).toBe(false);
    expect(saved.endedAt).toBeUndefined();
    // Reading history cannot start or reconnect a transport.
    expect(a.plugin.start).toHaveBeenCalledTimes(1);
    expect(a.plugin.connect).not.toHaveBeenCalled();
  });
  it('pauses on lost chat ACK without marking it delivered or ending the gathering', async () => {
    const { host, guest, pump, a } = await setup();
    host.session!.approve();
    await pump();
    vi.useFakeTimers();
    host.session!.sendChat('lost');
    await settle();
    await vi.advanceTimersByTimeAsync(15001);
    expect(host.state).toBe('reconnecting');
    expect(host.session!.closed).toBe('');
    expect(host.session!.messages[0]?.status).toBe('sending');
    expect(a.plugin.start).toHaveBeenCalledTimes(1);
    void guest.stop();
  });
  it('retains the match when repeated foreground probes fill the unacknowledged outbox', async () => {
    const { host, guest, pump, a } = await setup();
    host.session!.approve();
    await pump();
    guest.session!.proposeGame();
    await pump();
    host.session!.ready();
    guest.session!.ready();
    await pump();
    const session = host.session!;
    const match = structuredClone(session.match);
    expect(match).not.toBeNull();
    vi.useFakeTimers();
    // No responses reach the host during these app switches. A full bounded
    // outbox must enter recovery, without an unhandled lifecycle rejection.
    for (let i = 0; i < 65; i++) {
      a.event({ type: 'lifecycle', active: false });
      a.event({ type: 'lifecycle', active: true });
      await settle();
    }
    expect(host.state).toBe('reconnecting');
    expect(host.session).toBe(session);
    expect(session.suspended).toBe(true);
    expect(session.closed).toBe('');
    expect(session.match).toEqual(match);
    expect(a.plugin.stop).not.toHaveBeenCalled();
  });
  it('stops pending permission/start work when the view is left', async () => {
    const p = native();
    let finish!: () => void;
    p.plugin.start = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const controller = create(
      {
        host: true,
        name: 'A',
        public: false,
        chatEnabled: true,
        gameId: 'yacht',
        transport: 'ble',
      },
      () => {},
      p.plugin,
    );
    const starting = controller.start();
    await settle();
    await controller.stop();
    finish();
    await starting;
    expect(controller.state).toBe('ended');
    expect(p.plugin.stop).toHaveBeenCalled();
  });
  it('does not let an old start completion stop a newer gathering', async () => {
    const p = native();
    let finish!: () => void;
    p.plugin.start = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(undefined);
    const options = {
      host: true,
      name: 'A',
      public: false,
      chatEnabled: true,
      gameId: 'yacht',
      transport: 'ble',
    } as const;
    const old = create(options, () => {}, p.plugin);
    const pending = old.start();
    await settle();
    await old.stop();
    const next = create(options, () => {}, p.plugin);
    await next.start();
    const stops = vi.mocked(p.plugin.stop).mock.calls.length;
    finish();
    await pending;
    expect(p.plugin.stop).toHaveBeenCalledTimes(stops);
    expect(next.state).toBe('discovering');
    await next.stop();
  });
  it('submits a rejection before closing the native queue', async () => {
    const { host, guest, a, b } = await setup();
    vi.useFakeTimers();
    host.session!.reject();
    await settle();
    expect(a.frames.some((raw) => JSON.parse(raw).message?.type === 'admission')).toBe(true);
    expect(a.plugin.stop).not.toHaveBeenCalled();
    while (a.frames.length) b.event({ type: 'data', data: a.frames.shift()! });
    await settle();
    expect(guest.reason).toBe('declined');
    await vi.advanceTimersByTimeAsync(751);
    expect(a.plugin.stop).toHaveBeenCalledTimes(1);
  });
  it.each(['flood', 'oversized'] as const)(
    'closes before retaining an unbounded native event backlog: %s',
    async (attack) => {
      const p = native();
      const controller = create(
        {
          host: false,
          name: 'A',
          public: false,
          chatEnabled: true,
          gameId: 'yacht',
          transport: 'ble',
        },
        () => {},
        p.plugin,
      );
      await controller.start();
      if (attack === 'flood') {
        for (let i = 0; i < 10000; i++)
          p.event({ type: 'peer', id: `peer-${i}`, name: 'P-ABCDEF' });
      } else p.event({ type: 'data', data: 'x'.repeat(4097) });
      // Closure is synchronous at the listener boundary, before async crypto.
      expect(controller.state).toBe('ended');
      expect(controller.reason).toBe('connectionError');
      await controller.stop();
      await settle();
      expect(p.plugin.stop).toHaveBeenCalledTimes(1);
      expect(controller.peers).toEqual([]);
      expect(p.plugin.start).toHaveBeenCalledTimes(1);
    },
  );
});
