import { describe, expect, it } from 'vitest';
import { parseListing, serializeListing } from './discovery';
import { validateHistory } from './history';
import {
  isChatText,
  isPlayerName,
  isRoomName,
  PROTOCOL_VERSION,
  Session,
  type Wire,
} from './session';

function pair() {
  const queue: { target: 'host' | 'guest'; wire: Wire }[] = [];
  const sent: Wire[] = [];
  const observed: unknown[] = [];
  const options = (target: 'host' | 'guest') => ({
    send: (wire: Wire) => {
      queue.push({ target, wire });
      sent.push(wire);
    },
    changed: () => {
      // These are exactly the Session values consumed by UI/history capture.
      for (const session of [host, guest])
        observed.push(structuredClone({ peerName: session.peerName, messages: session.messages }));
    },
  });
  const host = new Session({
    host: true,
    name: 'Host',
    roomName: 'Yacht 1234',
    chatEnabled: true,
    nonce: 'a'.repeat(32),
    identity: 'c'.repeat(32),
    ...options('guest'),
  });
  const guest = new Session({
    host: false,
    name: 'Guest',
    nonce: 'b'.repeat(32),
    identity: 'd'.repeat(32),
    ...options('host'),
  });
  const flush = () => {
    let n = 0;
    while (queue.length) {
      if (++n > 100) throw new Error('Protocol loop');
      const { target, wire } = queue.shift()!;
      ({ host, guest })[target].receive(JSON.stringify(wire));
    }
  };
  const start = () => {
    host.start();
    guest.start();
  };
  const admit = () => {
    start();
    flush();
    host.approve();
    flush();
    expect(host.paired && guest.paired).toBe(true);
  };
  return { host, guest, sent, observed, queue, flush, start, admit };
}

describe('Nearby content rules at protocol boundaries', () => {
  it.each([
    'Yacht',
    'Reversi',
    'Connect Four',
    'Gomoku',
    'Checkers',
    'Gin Rummy',
    'Mancala',
    'Dominoes',
    'Dots and Boxes',
    'Chess',
    'Nested Tic-Tac-Toe',
    'Scopa',
    'Nim',
  ])('accepts the normal game/room name %s', (title) => {
    expect(isPlayerName(title)).toBe(true);
    expect(isRoomName(title)).toBe(true);
    expect(isChatText(`Let's play ${title}!`)).toBe(true);
  });

  it('does not advertise a blocked room or retain received listing metadata', () => {
    expect(serializeListing('P-810001', 'fuck', 'yacht')).toBeNull();
    const raw = JSON.stringify({
      v: 2,
      label: 'P-810001',
      roomName: 'fuck',
      gameId: 'yacht',
      protocol: PROTOCOL_VERSION,
      available: true,
    });
    expect(parseListing(raw, 'P-810001')).toBeNull();
  });

  it.each(['name', 'roomName'] as const)('refuses a local blocked %s before hello', (field) => {
    const sent: Wire[] = [];
    expect(() =>
      new Session({
        host: true,
        name: 'Host',
        roomName: 'Yacht 1234',
        nonce: 'a'.repeat(32),
        identity: 'b'.repeat(32),
        send: (wire) => sent.push(wire),
        changed: () => {},
        [field]: 'fuck',
      }).start(),
    ).toThrow();
    expect(sent).toEqual([]);
  });

  it.each(['name', 'roomName'] as const)(
    'rejects a remote blocked %s before peer retention',
    (field) => {
      const p = pair();
      p.start();
      const hello = p.queue.shift()!.wire;
      p.guest.receive(JSON.stringify({ ...hello, [field]: 'fuck' }));
      expect(p.guest.closed).not.toBe('');
      expect(p.guest.peerName).toBe('');
      expect(p.guest.peerIdentity).toBe('');
      expect(p.guest.roomName).toBe('');
      expect(p.guest.messages).toEqual([]);
      expect(JSON.stringify(p.observed)).not.toContain('fuck');
    },
  );

  it.each(['host', 'guest'] as const)(
    'does not send or capture blocked %s chat, then allows a valid send',
    (side) => {
      const p = pair();
      p.admit();
      const before = p.sent.length;
      expect(p[side].sendChat('fu\u200bck')).toBe(false);
      expect(p.sent).toHaveLength(before);
      expect(p[side].chatPending).toBe(false);
      expect(p.host.messages).toEqual([]);
      expect(p.guest.messages).toEqual([]);
      expect(JSON.stringify(p.observed)).not.toContain('fu\u200bck');
      expect(p[side].sendChat('Nice move!')).toBe(true);
      p.flush();
      for (const session of [p.host, p.guest])
        expect(session.messages).toEqual([
          expect.objectContaining({ text: 'Nice move!', status: 'delivered' }),
        ]);
      expect(p.sent.find((wire) => wire.type === 'chat')).toMatchObject({ seq: 1 });
    },
  );

  it.each(['host', 'guest'] as const)(
    'rejects blocked incoming chat before %s display/history capture',
    (side) => {
      const p = pair();
      p.admit();
      p[side].receive(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          type: 'chat',
          gameId: 'yacht',
          sid: p.host.sid,
          seq: 1,
          text: 'fuck',
        }),
      );
      expect(p[side].closed).toBe('Invalid chat');
      expect(p[side].messages).toEqual([]);
      expect(p.sent.some((wire) => wire.type === 'chat-ack')).toBe(false);
      expect(JSON.stringify(p.observed)).not.toContain('fuck');
    },
  );

  it('still accepts existing history files containing now-filtered values without rewriting them', () => {
    const saved = {
      version: 1,
      identity: 'a'.repeat(32),
      displayName: 'fuck',
      blocked: [],
      gatherings: [
        {
          id: 'b'.repeat(32),
          at: 0,
          label: 'P-810001',
          roomName: 'fuck',
          transport: 'ble',
          host: true,
          names: ['fuck', 'Guest'],
          messages: [{ id: '1', sender: 'self', text: 'fuck', status: 'delivered', at: 1 }],
          games: [],
        },
      ],
    };
    const before = JSON.stringify(saved);
    expect(validateHistory(saved)).toBe(saved);
    expect(JSON.stringify(saved)).toBe(before);
  });
});
