import { afterEach, describe, expect, it, vi } from 'vitest';
import type { NativeEvent, NearbyPlugin } from './native';
import { NearbyController } from './controller';
import { loadHistory } from './history';

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
    readHistory: async () => ({ data }),
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
    { host: true, name: 'A', public: true, transport: 'ble' },
    () => {},
    a.plugin,
  );
  const guest = create(
    { host: false, name: 'B', public: false, transport: 'ble' },
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
describe('nearby lifecycle and persistence', () => {
  it('does no radio work on construction; approves, chats, starts Yacht and retains history after disconnect', async () => {
    const p = native();
    create({ host: true, name: 'A', public: false, transport: 'ble' }, () => {}, p.plugin);
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
      { host: true, name: 'A', public: false, transport: 'ble' },
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
    const options = { host: true, name: 'A', public: false, transport: 'ble' } as const;
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
        { host: false, name: 'A', public: false, transport: 'ble' },
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
