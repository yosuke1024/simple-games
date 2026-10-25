import { webcrypto } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Channel } from './channel';

beforeEach(() => {
  vi.stubGlobal('crypto', webcrypto);
});
afterEach(() => {
  vi.unstubAllGlobals();
});
async function pair() {
  const hostFrames: string[] = [],
    guestFrames: string[] = [],
    hostMessages: string[] = [],
    guestMessages: string[] = [];
  const hostReady = vi.fn(),
    guestReady = vi.fn();
  const host = await Channel.create(
    true,
    async (raw) => {
      hostFrames.push(raw);
    },
    hostReady,
    (raw) => hostMessages.push(raw),
  );
  const guest = await Channel.create(
    false,
    async (raw) => {
      guestFrames.push(raw);
    },
    guestReady,
    (raw) => guestMessages.push(raw),
  );
  await host.start();
  // A peer hello may reach JS before its connected callback.
  await guest.receive(hostFrames.shift()!);
  await guest.start();
  await host.receive(guestFrames.shift()!);
  return {
    host,
    guest,
    hostFrames,
    guestFrames,
    hostMessages,
    guestMessages,
    hostReady,
    guestReady,
  };
}
describe('encrypted nearby channel', () => {
  it('agrees on a code and sends ordered Unicode both ways without plaintext on the wire', async () => {
    const p = await pair();
    expect(p.host.code).toMatch(/^\d{6}$/);
    expect(p.guest.code).toBe(p.host.code);
    expect(p.hostReady).toHaveBeenCalledTimes(1);
    expect(p.guestReady).toHaveBeenCalledTimes(1);
    await Promise.all([p.host.send('こんにちは'), p.host.send('second')]);
    expect(p.hostFrames.join('')).not.toContain('こんにちは');
    for (const frame of p.hostFrames) await p.guest.receive(frame);
    expect(p.guestMessages).toEqual(['こんにちは', 'second']);
    await p.guest.send('reply');
    await p.host.receive(p.guestFrames[0]!);
    expect(p.hostMessages).toEqual(['reply']);
  });
  it('rejects replay, altered ciphertext, reflection, and oversized plaintext', async () => {
    const p = await pair();
    await p.host.send('message');
    const frame = p.hostFrames[0]!;
    await p.guest.receive(frame);
    await expect(p.guest.receive(frame)).rejects.toThrow('sequence');
    await expect(p.host.receive(frame)).rejects.toThrow();
    const q = await pair();
    await q.host.send('secret');
    const altered = JSON.parse(q.hostFrames[0]!) as { data: string };
    altered.data = (altered.data.startsWith('A') ? 'B' : 'A') + altered.data.slice(1);
    await expect(q.guest.receive(JSON.stringify(altered))).rejects.toThrow();
    expect(q.guestMessages).toEqual([]);
    await expect(q.host.send('あ'.repeat(1000))).rejects.toThrow();
  });
  it('keeps a maximum chat inside native framing and drops work after close', async () => {
    const p = await pair();
    const text = JSON.stringify({
      type: 'chat',
      text: '😀'.repeat(160),
      sid: 'a'.repeat(32),
      seq: 1,
    });
    await p.host.send(text);
    expect(new TextEncoder().encode(p.hostFrames[0]!).length).toBeLessThan(4096);
    await p.guest.receive(p.hostFrames[0]!);
    expect(p.guestMessages).toEqual([text]);
    p.host.close();
    await p.host.send('not sent');
    expect(p.hostFrames).toHaveLength(1);
  });
});

describe('continuation authentication', () => {
  it('binds proof to the original pair, fresh key exchange, and sender role', async () => {
    const original = await pair();
    const hostKey = original.host.reconnectKey!;
    const guestKey = original.guest.reconnectKey!;
    expect(hostKey.extractable).toBe(false);
    original.host.close();
    original.guest.close();
    const resumed = await pair();
    const proof = await resumed.host.resumeProof(hostKey);
    expect(await resumed.guest.verifyResume(guestKey, proof)).toBe(true);
    expect(await resumed.host.verifyResume(hostKey, proof)).toBe(false);
    expect(await resumed.guest.verifyResume(resumed.guest.reconnectKey!, proof)).toBe(false);
    const next = await pair();
    expect(await next.guest.verifyResume(guestKey, proof)).toBe(false);
  });
});

it('runs key derivation once when native send completion races with the peer key', async () => {
  let release!: () => void;
  const ready = vi.fn();
  const a = await Channel.create(
    true,
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
    ready,
    () => {},
  );
  const frames: string[] = [];
  const b = await Channel.create(
    false,
    async (raw) => {
      frames.push(raw);
    },
    () => {},
    () => {},
  );
  const starting = a.start();
  await b.start();
  const receiving = a.receive(frames.shift()!);
  release();
  await Promise.all([starting, receiving]);
  expect(ready).toHaveBeenCalledTimes(1);
});
