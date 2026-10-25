// @vitest-environment jsdom
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PROTOCOL_VERSION, Session, type Wire } from './session';
import { CATEGORIES } from '../../../src/games/yacht/game/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type NativeEvent =
  | { type: 'peer'; id: string; name: string }
  | { type: 'connected' }
  | { type: 'data'; data: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'status'; message: string };
type Handle = { remove: ReturnType<typeof vi.fn<() => Promise<void>>> };
type Subscription = { callback: (event: NativeEvent) => void; handle: Handle };
const native = vi.hoisted(() => ({
  enabled: true,
  plugin: {
    capabilities: vi.fn<() => Promise<Record<string, unknown>>>(),
    start: vi.fn<(options: Record<string, string>) => Promise<void>>(),
    connect: vi.fn<(options: { peerId: string }) => Promise<void>>(),
    send: vi.fn<(options: { data: string }) => Promise<void>>(),
    stop: vi.fn<() => Promise<void>>(),
    addListener: vi.fn<(name: string, callback: (event: NativeEvent) => void) => Promise<Handle>>(),
  },
}));
vi.mock('@capacitor/core', () => ({
  Capacitor: { isNativePlatform: () => native.enabled },
  registerPlugin: () => native.plugin,
}));

const html = readFileSync(
  resolve(dirname(fileURLToPath(import.meta.url)), '../index.html'),
  'utf8',
);
const subscriptions: Subscription[] = [];
const element = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const button = (id: string) => element<HTMLButtonElement>(id);
let visibilityChanged: (() => void) | undefined;
let pageHidden: (() => void) | undefined;
let hidden = false;

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function subscribe(callback: (event: NativeEvent) => void): Handle {
  const handle = { remove: vi.fn<() => Promise<void>>().mockResolvedValue(undefined) };
  subscriptions.push({ callback, handle });
  return handle;
}
async function settle() {
  await vi.advanceTimersByTimeAsync(0);
}
async function open() {
  await import('./main');
}
async function start() {
  button('start').click();
  await settle();
}
async function stop() {
  button('stop').click();
  await settle();
}
function emit(index: number, event: NativeEvent) {
  subscriptions[index]!.callback(event);
}
function settleDeferred(pending: ReturnType<typeof deferred<void>>, outcome: 'resolve' | 'reject') {
  if (outcome === 'resolve') pending.resolve(undefined);
  else pending.reject(new Error('Previous session failed late'));
}
async function beginWithGuest(dropInitialAck = false) {
  let dropAcks = dropInitialAck;
  const guestMessages: Wire[] = [];
  const guest = new Session({
    name: 'Guest',
    host: false,
    nonce: 'b'.repeat(32),
    die: () => {
      throw new Error('Guest RNG');
    },
    changed: () => {},
    send: (wire) => {
      guestMessages.push(wire);
      if (wire.type !== 'state-ack' || !dropAcks)
        emit(0, { type: 'data', data: JSON.stringify(wire) });
    },
  });
  native.plugin.send.mockImplementation(async ({ data }) => {
    guest.receive(data);
  });
  await open();
  await start();
  guest.start();
  emit(0, { type: 'connected' });
  await settle();
  button('confirm').click();
  guest.confirm();
  await settle();
  button('ready').click();
  guest.ready();
  await settle();
  return {
    guest,
    guestMessages,
    dropAcks: () => {
      dropAcks = true;
    },
  };
}

beforeEach(() => {
  vi.resetModules();
  vi.resetAllMocks();
  vi.useFakeTimers();
  native.enabled = true;
  hidden = false;
  subscriptions.length = 0;
  visibilityChanged = pageHidden = undefined;
  document.documentElement.innerHTML = html;
  native.plugin.capabilities.mockResolvedValue({ platform: 'test' });
  native.plugin.start.mockResolvedValue(undefined);
  native.plugin.connect.mockResolvedValue(undefined);
  native.plugin.send.mockResolvedValue(undefined);
  native.plugin.stop.mockResolvedValue(undefined);
  native.plugin.addListener.mockImplementation(async (_name, callback) => subscribe(callback));
  vi.spyOn(document, 'hidden', 'get').mockImplementation(() => hidden);

  // Capture only this module's lifecycle callbacks. Re-importing main must not leave
  // old document/window handlers alive in the next test's DOM or fake timer queue.
  const addDocumentListener = document.addEventListener.bind(document);
  vi.spyOn(document, 'addEventListener').mockImplementation((type, callback, options) => {
    if (type === 'visibilitychange')
      visibilityChanged = () => {
        if (typeof callback === 'function') callback.call(document, new Event(type));
        else callback.handleEvent(new Event(type));
      };
    else addDocumentListener(type, callback, options);
  });
  const addWindowListener = window.addEventListener.bind(window);
  vi.spyOn(window, 'addEventListener').mockImplementation((type, callback, options) => {
    if (type === 'pagehide')
      pageHidden = () => {
        if (typeof callback === 'function') callback.call(window, new Event(type));
        else callback.handleEvent(new Event(type));
      };
    else addWindowListener(type, callback, options);
  });
});

afterEach(async () => {
  pageHidden?.();
  await settle();
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.documentElement.innerHTML = '';
});

describe('PoC native UI lifecycle', () => {
  it('keeps the browser preview inactive without starting native discovery', async () => {
    native.enabled = false;
    await open();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(element('setup').hidden).toBe(true);
    expect(element('unsupported').hidden).toBe(false);
    expect(native.plugin.addListener).not.toHaveBeenCalled();
    expect(native.plugin.start).not.toHaveBeenCalled();
    expect(native.plugin.capabilities).not.toHaveBeenCalled();
    expect(native.plugin.send).not.toHaveBeenCalled();
  });

  it('retains early hello until connected, then requires both people to confirm', async () => {
    await open();
    expect(native.plugin.start).not.toHaveBeenCalled();
    await start();
    const remoteNonce = 'b'.repeat(32);
    emit(0, {
      type: 'data',
      data: JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'hello',
        name: '近くの相手',
        host: false,
        nonce: remoteNonce,
      }),
    });
    expect(element('pairing').hidden).toBe(true);
    expect(native.plugin.send).not.toHaveBeenCalled();
    emit(0, { type: 'connected' });
    await settle();
    expect(element('peerName').textContent).toContain('近くの相手');
    expect(element('pairing').hidden).toBe(false);
    expect(element('ready').hidden).toBe(true);
    const hello = JSON.parse(native.plugin.send.mock.calls[0]![0].data) as {
      type: string;
      nonce: string;
    };
    expect(hello.type).toBe('hello');
    expect(native.plugin.send).toHaveBeenCalledTimes(1);
    button('confirm').click();
    await settle();
    expect(element('ready').hidden).toBe(true);
    emit(0, {
      type: 'data',
      data: JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'confirm',
        sid: hello.nonce,
        nonce: remoteNonce,
      }),
    });
    expect(element('pairing').hidden).toBe(true);
    expect(element('ready').hidden).toBe(false);
    expect(element('game').hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(native.plugin.stop).not.toHaveBeenCalled();
  });

  it('times out the initial state despite native send acceptance', async () => {
    await beginWithGuest(true);
    expect(element('turn').textContent).toContain('rev 0');
    expect(element('status').textContent).toContain('Waiting for peer');
    expect(button('roll').disabled).toBe(true);
    expect(button('ready').disabled).toBe(true);
    await vi.advanceTimersByTimeAsync(14_999);
    expect(native.plugin.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
    expect(element('status').textContent).toContain('Command timeout');
    expect(element('turn').textContent).toContain('Session ended');
    expect(button('start').disabled).toBe(false);
  });

  it('sends no idle heartbeat and bounds an unacknowledged host action without extending its timer', async () => {
    const p = await beginWithGuest();
    const idleSends = native.plugin.send.mock.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(native.plugin.send).toHaveBeenCalledTimes(idleSends);
    expect(native.plugin.stop).not.toHaveBeenCalled();
    p.dropAcks();
    button('roll').click();
    await settle();
    expect(element('turn').textContent).toContain('rev 1');
    expect(button('roll').disabled).toBe(true);
    expect(element('status').textContent).toContain('Waiting for peer');
    const pendingSends = native.plugin.send.mock.calls.length;
    button('roll').click();
    element('scores').querySelector('button')!.click();
    await settle();
    expect(native.plugin.send).toHaveBeenCalledTimes(pendingSends);
    await vi.advanceTimersByTimeAsync(10_000);
    const oldAck = p.guestMessages.find((wire) => wire.type === 'state-ack')!;
    emit(0, { type: 'data', data: JSON.stringify(oldAck) });
    p.guest.ping(); // Unrelated valid traffic causes render, but cannot restart the ACK timer.
    await settle();
    expect(element('status').textContent).toContain('Waiting for peer');
    await vi.advanceTimersByTimeAsync(4_999);
    expect(native.plugin.stop).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
    expect(element('status').textContent).toContain('Command timeout');
    expect(element('result').textContent).toBe('');
    await vi.advanceTimersByTimeAsync(60_000);
    expect(native.plugin.start).toHaveBeenCalledTimes(1);
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
  });

  it.each(['acknowledged', 'timeout'] as const)(
    'withholds the final result and rematch until the final state is %s',
    async (outcome) => {
      const p = await beginWithGuest();
      for (const category of CATEGORIES) {
        button('roll').click();
        await settle();
        element('scores')
          .querySelector<HTMLButtonElement>(`button[aria-label^="Score ${category}:"]`)!
          .click();
        await settle();
        p.guest.act({ kind: 'roll' });
        await settle();
        if (category === 'yacht') p.dropAcks();
        p.guest.act({ kind: 'score', category });
        await settle();
      }
      expect(element('turn').textContent).toContain('Waiting for peer');
      expect(element('turn').textContent).not.toMatch(/Finished|rev /);
      expect(element('result').textContent).toBe('');
      expect(button('ready').hidden).toBe(true);
      expect(button('ready').disabled).toBe(true);
      button('ready').click();
      if (outcome === 'acknowledged') {
        const finalAck = p.guestMessages.filter((wire) => wire.type === 'state-ack').at(-1)!;
        emit(0, { type: 'data', data: JSON.stringify(finalAck) });
        await settle();
        expect(element('turn').textContent).toContain('Finished');
        expect(element('result').textContent).toMatch(/Draw|Wins/);
        expect(button('ready').hidden).toBe(false);
        expect(button('ready').disabled).toBe(false);
        await vi.advanceTimersByTimeAsync(15_000);
        expect(native.plugin.stop).not.toHaveBeenCalled();
      } else {
        await vi.advanceTimersByTimeAsync(15_000);
        expect(native.plugin.stop).toHaveBeenCalledTimes(1);
        expect(element('turn').textContent).toContain('Session ended');
        expect(element('result').textContent).toBe('');
        expect(button('ready').hidden).toBe(true);
        expect(button('ready').disabled).toBe(true);
      }
    },
  );

  it('removes a delayed old listener without overwriting the restarted session listener', async () => {
    const oldRegistration = deferred<Handle>();
    native.plugin.addListener.mockImplementationOnce((_name, callback) => {
      subscribe(callback);
      return oldRegistration.promise;
    });
    await open();
    await start();
    await stop();
    await start();
    oldRegistration.resolve(subscriptions[0]!.handle);
    await settle();
    expect(subscriptions[0]!.handle.remove).toHaveBeenCalledTimes(1);
    expect(subscriptions[1]!.handle.remove).not.toHaveBeenCalled();
    expect(native.plugin.start).toHaveBeenCalledTimes(1);
    emit(0, { type: 'error', code: 'OLD', message: 'stale callback' });
    emit(1, { type: 'status', message: 'Current discovery' });
    expect(element('status').textContent).toBe('Current discovery');
    expect(button('start').disabled).toBe(true);
    await stop();
    expect(subscriptions[1]!.handle.remove).toHaveBeenCalledTimes(1);
  });

  it('ignores rejection of an old listener registration after restart', async () => {
    const oldRegistration = deferred<Handle>();
    native.plugin.addListener.mockImplementationOnce((_name, callback) => {
      subscribe(callback);
      return oldRegistration.promise;
    });
    await open();
    await start();
    await stop();
    await start();
    emit(1, { type: 'status', message: 'Current discovery' });
    oldRegistration.reject(new Error('Old listener failed'));
    await settle();
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
    expect(element('status').textContent).toBe('Current discovery');
    expect(button('start').disabled).toBe(true);
    await stop();
    expect(subscriptions[1]!.handle.remove).toHaveBeenCalledTimes(1);
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores an old native start %s after restart',
    async (outcome) => {
      const oldStart = deferred<void>();
      native.plugin.start.mockReturnValueOnce(oldStart.promise);
      await open();
      await start();
      await stop();
      await start();
      emit(1, { type: 'status', message: 'Current discovery' });
      settleDeferred(oldStart, outcome);
      await settle();
      expect(native.plugin.start).toHaveBeenCalledTimes(2);
      expect(native.plugin.stop).toHaveBeenCalledTimes(1);
      expect(element('status').textContent).toBe('Current discovery');
      expect(button('start').disabled).toBe(true);
      expect(subscriptions[1]!.handle.remove).not.toHaveBeenCalled();
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'ignores an old connect %s after restart',
    async (outcome) => {
      const oldConnect = deferred<void>();
      native.plugin.connect.mockReturnValueOnce(oldConnect.promise);
      await open();
      await start();
      emit(0, { type: 'peer', id: 'peer-old', name: 'Old peer' });
      element('peers').querySelector('button')!.click();
      await settle();
      expect(native.plugin.connect).toHaveBeenCalledWith({ peerId: 'peer-old' });
      await stop();
      await start();
      emit(1, { type: 'status', message: 'Current discovery' });
      settleDeferred(oldConnect, outcome);
      await settle();
      expect(native.plugin.stop).toHaveBeenCalledTimes(1);
      expect(element('status').textContent).toBe('Current discovery');
      expect(button('start').disabled).toBe(true);
    },
  );

  it('ends on background and clears old events and handshake timeout before explicit restart', async () => {
    await open();
    await start();
    emit(0, { type: 'connected' });
    await settle();
    hidden = true;
    visibilityChanged?.();
    await settle();
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
    expect(subscriptions[0]!.handle.remove).toHaveBeenCalledTimes(1);
    expect(button('start').disabled).toBe(false);
    expect(element('setup').hidden).toBe(false);
    hidden = false;
    visibilityChanged?.();
    await settle();
    expect(native.plugin.start).toHaveBeenCalledTimes(1);
    await start();
    emit(0, { type: 'error', code: 'OLD', message: 'old transport closed' });
    emit(0, { type: 'connected' });
    emit(1, { type: 'status', message: 'Restarted explicitly' });
    await vi.advanceTimersByTimeAsync(15_000);
    expect(native.plugin.start).toHaveBeenCalledTimes(2);
    expect(native.plugin.stop).toHaveBeenCalledTimes(1);
    expect(element('status').textContent).toBe('Restarted explicitly');
    expect(button('start').disabled).toBe(true);
  });
});
