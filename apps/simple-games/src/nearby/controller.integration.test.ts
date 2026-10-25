// @vitest-environment node
import { webcrypto } from 'node:crypto';
import { setImmediate as nextTurn } from 'node:timers/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NearbyController } from './controller';
import { loadHistory } from './history';
import * as nativeModule from './native';
import type { NativeEvent, NearbyPlugin } from './native';

// Unlike controller.test.ts, this exercises the actual asynchronous WebCrypto
// channel. Only radio delivery and device-local storage are replaced.
const controllers: NearbyController[] = [];

function native() {
  const listeners = new Set<(event: NativeEvent) => void>();
  const frames: string[] = [];
  const sent: string[] = [];
  let history: string | null = null;
  const emit = (event: NativeEvent) => {
    for (const listener of listeners) listener(event);
  };
  const plugin: NearbyPlugin = {
    start: vi.fn(async () => {}),
    connect: vi.fn(async () => {}),
    stop: vi.fn(async () => {
      emit({ type: 'disconnected', reason: 'stopped' });
    }),
    send: vi.fn(async ({ data }) => {
      frames.push(data);
      sent.push(data);
    }),
    addListener: async (_name, listener) => {
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
  return { plugin, emit, frames, sent };
}

function controller(host: boolean, plugin: NearbyPlugin, chatEnabled = true) {
  const value = new NearbyController(
    { host, name: host ? 'Host' : 'Guest', public: true, chatEnabled, transport: 'ble' },
    () => {},
    plugin,
  );
  controllers.push(value);
  return value;
}

async function until(condition: () => boolean, deliver: () => void = () => {}) {
  // Real event-loop turns allow native WebCrypto jobs to finish. Fake timeout
  // advancement alone cannot reliably complete those jobs.
  const deadline = performance.now() + 2000;
  while (!condition()) {
    if (performance.now() >= deadline) throw new Error('Nearby integration did not settle');
    deliver();
    await nextTurn();
  }
}

async function pair(chatEnabled = true) {
  const a = native();
  const b = native();
  const host = controller(true, a.plugin, chatEnabled);
  const guest = controller(false, b.plugin);
  const deliver = () => {
    while (a.frames.length) b.emit({ type: 'data', data: a.frames.shift()! });
    while (b.frames.length) a.emit({ type: 'data', data: b.frames.shift()! });
  };
  const pump = (condition: () => boolean) => until(condition, deliver);
  await Promise.all([host.start(), guest.start()]);
  b.emit({ type: 'peer', id: 'host', name: host.label });
  await until(() => guest.peers.length === 1);
  await guest.connect('host');
  a.emit({ type: 'connected' });
  b.emit({ type: 'connected' });
  await pump(() => !!host.session?.peerName && !!guest.session?.peerName);
  expect(host.code).toMatch(/^\d{6}$/);
  expect(guest.code).toBe(host.code);
  const drain = async () => {
    await pump(
      () =>
        (host as unknown as { delivery: { pendingSequence: number } }).delivery.pendingSequence ===
          0 &&
        (guest as unknown as { delivery: { pendingSequence: number } }).delivery.pendingSequence ===
          0,
    );
    deliver();
    await nextTurn();
  };
  return { a, b, host, guest, pump, drain };
}

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
});

afterEach(async () => {
  const stopped = controllers.splice(0).map((value) => value.stop());
  await vi.runAllTimersAsync();
  await Promise.all(stopped);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('nearby controller with the real encrypted channel', () => {
  it('delivers a rejection before the bounded native disconnect', async () => {
    const { a, host, guest, pump } = await pair();
    const sentBefore = a.sent.length;
    host.session!.reject();
    await pump(() => guest.session?.admission === 'rejected');

    expect(host.state).toBe('ended');
    expect(guest.state).toBe('ended');
    expect(guest.reason).toBe('declined');
    expect(a.sent.length).toBeGreaterThan(sentBefore);
    expect(a.plugin.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(749);
    expect(a.plugin.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    await host.stop();
    expect(a.plugin.stop).toHaveBeenCalledTimes(1);
  });

  it('bounds rejection cleanup even when native queue acceptance never resolves', async () => {
    const { a, host, guest } = await pair();
    a.plugin.send = vi.fn(() => new Promise<void>(() => {}));
    host.session!.reject();
    await vi.advanceTimersByTimeAsync(1750);
    await host.stop();

    expect(host.state).toBe('ended');
    expect(a.plugin.stop).toHaveBeenCalledTimes(1);
    // We do not invent delivery: without a received frame the other peer has
    // not learned a rejection and will rely on disconnect/discovery deadlines.
    expect(guest.session!.admission).toBe('pending');
  });

  it('approves, exchanges acknowledged chat, and agrees on the first Yacht roll', async () => {
    const { a, b, host, guest, pump } = await pair();
    host.session!.approve();
    await pump(() => host.state === 'room' && guest.state === 'room');
    expect(host.session!.sendChat('こんにちは — host')).toBe(true);
    expect(guest.session!.sendChat('Hello — guest')).toBe(true);
    await pump(
      () =>
        host.session!.messages.length === 2 &&
        guest.session!.messages.length === 2 &&
        !host.session!.chatPending &&
        !guest.session!.chatPending,
    );
    expect(host.session!.messages.map((message) => message.status)).toEqual([
      'delivered',
      'delivered',
    ]);
    expect(guest.session!.messages.map((message) => message.status)).toEqual([
      'delivered',
      'delivered',
    ]);
    expect(host.session!.messages.find((message) => message.sender === 'peer')?.text).toBe(
      'Hello — guest',
    );
    expect(guest.session!.messages.find((message) => message.sender === 'peer')?.text).toBe(
      'こんにちは — host',
    );
    expect(a.sent.concat(b.sent).join('')).not.toContain('こんにちは — host');
    expect(a.sent.concat(b.sent).join('')).not.toContain('Hello — guest');

    host.session!.proposeGame();
    await pump(() => guest.session!.gameProposed);
    host.session!.ready();
    await pump(() => guest.session!.peerReady);
    expect(host.session!.match).toBeNull();
    guest.session!.ready();
    await pump(
      () =>
        host.session!.match?.round === 1 &&
        guest.session!.match?.round === 1 &&
        !host.session!.pending,
    );
    host.session!.act({ kind: 'roll' });
    await pump(
      () =>
        host.session!.match?.revision === 1 &&
        guest.session!.match?.revision === 1 &&
        !host.session!.pending,
    );
    expect(guest.session!.match).toEqual(host.session!.match);
    expect(host.session!.match!.rolls).toBe(1);
    expect(host.session!.match!.dice).toHaveLength(5);
    expect(host.session!.match!.dice.every((value) => value >= 1 && value <= 6)).toBe(true);
  });

  it('does not let a stale start completion stop the next owner of the native plugin', async () => {
    const p = native();
    let finishFirst: (() => void) | undefined;
    let calls = 0;
    p.plugin.start = vi.fn(async () => {
      if (calls++ === 0) {
        await new Promise<void>((resolve) => {
          finishFirst = resolve;
        });
      }
    });
    const first = controller(true, p.plugin);
    const starting = first.start();
    await until(() => finishFirst !== undefined);
    await first.stop();
    const next = controller(true, p.plugin);
    await next.start();
    expect(next.state).toBe('discovering');
    expect(p.plugin.stop).toHaveBeenCalledTimes(1);

    finishFirst!();
    await starting;
    await nextTurn();
    expect(next.state).toBe('discovering');
    expect(p.plugin.stop).toHaveBeenCalledTimes(1);
    expect(p.plugin.start).toHaveBeenCalledTimes(2);
  });

  it('keeps earlier guest history when a peer reuses a host nonce in a new connection', async () => {
    const { a, b, host, guest, pump } = await pair();
    host.session!.approve();
    await pump(() => host.state === 'room' && guest.state === 'room');
    host.session!.sendChat('First gathering');
    await pump(() => !host.session!.chatPending && guest.session!.messages.length === 1);
    const reusedNonce = host.session!.sid;
    const closing = Promise.all([host.stop(), guest.stop()]);
    await vi.advanceTimersByTimeAsync(1751);
    await closing;
    a.frames.length = b.frames.length = 0;
    const before = (await loadHistory(b.plugin)).gatherings;
    expect(before).toHaveLength(1);
    const original = before[0]!;

    const nextHost = controller(true, a.plugin);
    const nextGuest = controller(false, b.plugin);
    // Existing storage already has an installation identity. The next host
    // start consumes randomId for its public label and then its session nonce.
    // Only those calls are overridden; local history IDs still use real RNG.
    const randomId = vi
      .spyOn(nativeModule, 'randomId')
      .mockReturnValueOnce('f'.repeat(32))
      .mockReturnValueOnce(reusedNonce);
    try {
      await nextHost.start();
    } finally {
      randomId.mockRestore();
    }
    await nextGuest.start();
    a.emit({ type: 'connected' });
    b.emit({ type: 'connected' });
    await pump(() => !!nextHost.session?.peerName && !!nextGuest.session?.peerName);
    expect(nextHost.session!.sid).toBe(reusedNonce);
    expect(nextGuest.session!.sid).toBe(reusedNonce);
    nextHost.session!.approve();
    await pump(() => nextHost.state === 'room' && nextGuest.state === 'room');
    nextHost.session!.sendChat('Second gathering');
    await pump(() => !nextHost.session!.chatPending && nextGuest.session!.messages.length === 1);
    const nextClosing = Promise.all([nextHost.stop(), nextGuest.stop()]);
    await vi.advanceTimersByTimeAsync(1751);
    await nextClosing;

    const after = (await loadHistory(b.plugin)).gatherings;
    expect(after).toHaveLength(2);
    expect(new Set(after.map((gathering) => gathering.id)).size).toBe(2);
    expect(after.find((gathering) => gathering.id === original.id)).toEqual(original);
    expect(after.find((gathering) => gathering.id !== original.id)?.messages[0]?.text).toBe(
      'Second gathering',
    );
  });
});

describe('approved gathering survives a physical interruption', () => {
  it('retains the session across app switching without stopping the transport', async () => {
    const { a, host, guest, pump, drain } = await pair();
    host.session!.approve();
    await pump(() => host.state === 'room' && guest.state === 'room');
    await drain();
    a.emit({ type: 'lifecycle', active: false });
    await until(() => true);
    await vi.advanceTimersByTimeAsync(60001);
    expect(host.state).toBe('room');
    expect(host.session!.closed).toBe('');
    expect(a.plugin.stop).not.toHaveBeenCalled();
    a.emit({ type: 'lifecycle', active: true });
    guest.session!.sendChat('still here');
    await pump(() => host.session!.messages[0]?.text === 'still here');
  });

  it.each([
    { loss: 'state', chatEnabled: true },
    { loss: 'state receipt', chatEnabled: true },
    { loss: 'guest command', chatEnabled: true },
    { loss: 'state', chatEnabled: false },
  ])(
    'reconnects after losing $loss, preserving board, transcript and policy (chat: $chatEnabled)',
    async ({ loss, chatEnabled }) => {
      const { a, b, host, guest, pump } = await pair(chatEnabled);
      expect(host.session!.chatEnabled).toBe(chatEnabled);
      expect(guest.session!.chatEnabled).toBe(chatEnabled);
      // The joining setup defaults to ON in this fixture, but cannot override
      // the host policy already shared before approval.
      expect(guest.setup.chatEnabled).toBe(true);
      host.session!.approve();
      await pump(() => host.state === 'room' && guest.state === 'room');
      expect(host.session!.sendChat('before interruption')).toBe(chatEnabled);
      if (chatEnabled)
        await pump(() => guest.session!.messages.length === 1 && !host.session!.chatPending);
      guest.session!.proposeGame();
      await pump(() => host.session!.gameProposed);
      host.session!.ready();
      guest.session!.ready();
      await pump(() => !!guest.session!.match && !host.session!.pending);
      const oldHost = host.session,
        oldGuest = guest.session;
      const gatheringId = host.gathering!.id;
      host.session!.act({ kind: 'roll' });
      if (loss === 'state receipt') {
        await pump(() => guest.session!.match!.revision === 1);
        // Guest has applied it but its ACK has not necessarily reached host.
      } else if (loss === 'guest command') {
        await pump(() => !host.session!.pending);
        host.session!.act({ kind: 'score', category: 'choice' });
        await pump(() => guest.session!.canAct && !host.session!.pending);
        guest.session!.act({ kind: 'roll' });
      }
      await until(() => a.frames.length + b.frames.length > 0);
      a.frames.length = b.frames.length = 0;
      a.emit({ type: 'disconnected', reason: 'radio off' });
      b.emit({ type: 'disconnected', reason: 'radio off' });
      await until(() => host.state === 'reconnecting' && guest.state === 'reconnecting');
      expect(host.session).toBe(oldHost);
      expect(guest.session).toBe(oldGuest);
      expect(host.session!.closed).toBe('');
      expect(host.session!.canAct).toBe(false);
      expect(host.session!.sendChat('not yet')).toBe(false);
      expect(host.gathering!.endedAt).toBeUndefined();
      // Recovery reuses the admitted session policy, never re-reads setup.
      host.setup.chatEnabled = !chatEnabled;
      guest.setup.chatEnabled = !chatEnabled;
      await vi.advanceTimersByTimeAsync(3001);
      await until(
        () =>
          vi.mocked(a.plugin.start).mock.calls.length === 2 &&
          vi.mocked(b.plugin.start).mock.calls.length === 2,
      );
      b.emit({ type: 'peer', id: 'new-address', name: host.label });
      await until(() => vi.mocked(b.plugin.connect).mock.calls.length === 2);
      a.emit({ type: 'connected' });
      b.emit({ type: 'connected' });
      await pump(
        () =>
          host.state === 'room' &&
          guest.state === 'room' &&
          !host.session!.pending &&
          !guest.session!.pending,
      );
      expect(host.session!.match).toEqual(guest.session!.match);
      expect(host.session!.match!.revision).toBe(loss === 'guest command' ? 3 : 1);
      expect(host.session!.match!.rolls).toBe(1);
      expect(host.gathering!.id).toBe(gatheringId);
      expect(host.session!.chatEnabled).toBe(chatEnabled);
      expect(guest.session!.chatEnabled).toBe(chatEnabled);
      expect(host.session!.messages).toHaveLength(chatEnabled ? 1 : 0);
      expect(guest.session!.messages).toHaveLength(chatEnabled ? 1 : 0);
      expect(guest.session!.sendChat('after interruption')).toBe(chatEnabled);
      if (chatEnabled)
        await pump(() => host.session!.messages.length === 2 && !guest.session!.chatPending);
      else {
        expect(host.session!.sendChat('still disabled')).toBe(false);
        host.session!.act({ kind: 'hold', index: 0 });
        await pump(() => guest.session!.match!.held[0] === true && !host.session!.pending);
        expect(host.session!.match).toEqual(guest.session!.match);
        for (const device of [a, b]) {
          const saved = await loadHistory(device.plugin);
          expect(saved.gatherings).toHaveLength(1);
          expect(saved.gatherings[0]!.messages).toEqual([]);
          expect(saved.gatherings[0]!.games).toHaveLength(1);
        }
      }
    },
  );
});

it.each(['proposal', 'ready'] as const)(
  'detects a lost %s without a native disconnect callback',
  async (kind) => {
    const { a, b, host, guest, pump, drain } = await pair();
    host.session!.approve();
    await pump(() => host.state === 'room' && guest.state === 'room');
    await drain();
    if (kind === 'ready') {
      host.session!.proposeGame();
      await pump(() => guest.session!.gameProposed);
      await drain();
      host.session!.ready();
    } else host.session!.proposeGame();
    await until(() => a.frames.length > 0);
    a.frames.length = 0;
    await vi.advanceTimersByTimeAsync(15001);
    expect(host.state).toBe('reconnecting');
    expect(host.session!.closed).toBe('');
    expect(guest.state).toBe('room');
    // Closing/reopening the physical link on the retry notifies the other peer.
    b.emit({ type: 'disconnected', reason: 'peer transport restarted' });
    await until(() => guest.state === 'reconnecting');
    await vi.advanceTimersByTimeAsync(3001);
    await until(
      () =>
        vi.mocked(a.plugin.start).mock.calls.length === 2 &&
        vi.mocked(b.plugin.start).mock.calls.length === 2,
    );
    a.frames.length = b.frames.length = 0;
    a.emit({ type: 'connected' });
    b.emit({ type: 'connected' });
    await pump(
      () =>
        host.state === 'room' &&
        guest.state === 'room' &&
        guest.session!.gameProposed &&
        guest.session!.peerReady === (kind === 'ready'),
    );
    expect(guest.session!.peerReady).toBe(kind === 'ready');
    expect(host.session!.closed).toBe('');
  },
);

it.each(['admission', 'admission receipt'] as const)(
  'resumes without losing an explicit approval when its %s is lost',
  async (loss) => {
    const { a, b, host, guest, pump, drain } = await pair();
    await drain();
    host.session!.approve();
    if (loss === 'admission receipt') await pump(() => guest.state === 'room');
    else await until(() => a.frames.length > 0);
    a.frames.length = b.frames.length = 0;
    a.emit({ type: 'disconnected', reason: 'radio off' });
    b.emit({ type: 'disconnected', reason: 'radio off' });
    await until(() => host.state === 'reconnecting' && guest.state === 'reconnecting');
    expect(host.session!.closed).toBe('');
    expect(host.session!.approvalPending).toBe(true);
    expect(host.session!.canAct).toBe(false);
    await vi.advanceTimersByTimeAsync(3001);
    await until(
      () =>
        vi.mocked(a.plugin.start).mock.calls.length === 2 &&
        vi.mocked(b.plugin.start).mock.calls.length === 2,
    );
    a.frames.length = b.frames.length = 0;
    a.emit({ type: 'connected' });
    b.emit({ type: 'connected' });
    await pump(() => host.state === 'room' && guest.state === 'room');
    expect(host.session!.paired).toBe(true);
    expect(guest.session!.paired).toBe(true);
    expect(host.session!.sendChat('approved once')).toBe(true);
    await pump(() => guest.session!.messages[0]?.text === 'approved once');
  },
);

it('continues after a previous reconnect native send never settles', async () => {
  const { a, b, host, guest, pump, drain } = await pair();
  host.session!.approve();
  await pump(() => host.state === 'room' && guest.state === 'room');
  await drain();
  const send = b.plugin.send;
  let stalled = false;
  b.plugin.send = vi.fn(async (options) => {
    if (!stalled && JSON.parse(options.data).type === 'key') {
      stalled = true;
      await new Promise<void>(() => {});
    } else await send(options);
  });
  a.emit({ type: 'disconnected', reason: 'first interruption' });
  b.emit({ type: 'disconnected', reason: 'first interruption' });
  await until(() => host.state === 'reconnecting' && guest.state === 'reconnecting');
  await vi.advanceTimersByTimeAsync(3001);
  await until(
    () =>
      vi.mocked(a.plugin.start).mock.calls.length === 2 &&
      vi.mocked(b.plugin.start).mock.calls.length === 2,
  );
  b.emit({ type: 'peer', id: 'second', name: host.label });
  await until(() => vi.mocked(b.plugin.connect).mock.calls.length === 2);
  a.emit({ type: 'connected' });
  b.emit({ type: 'connected' });
  await until(() => stalled);
  await vi.advanceTimersByTimeAsync(18001);
  await until(
    () =>
      vi.mocked(a.plugin.start).mock.calls.length >= 3 &&
      vi.mocked(b.plugin.start).mock.calls.length >= 3,
  );
  a.frames.length = b.frames.length = 0;
  b.emit({ type: 'peer', id: 'third', name: host.label });
  await until(() => vi.mocked(b.plugin.connect).mock.calls.length === 3);
  a.emit({ type: 'connected' });
  b.emit({ type: 'connected' });
  await pump(() => host.state === 'room' && guest.state === 'room');
  expect(host.session!.closed).toBe('');
  expect(guest.session!.sendChat('continued')).toBe(true);
  await pump(() => host.session!.messages[0]?.text === 'continued');
});
