import { describe, expect, it, vi } from 'vitest';
import {
  isChatText,
  isPlayerName,
  MAX_CHAT_MESSAGES,
  MAX_FRAME_BYTES,
  PROTOCOL_VERSION,
  Session,
  type Wire,
} from './session';
import { apply, CATEGORIES, finished, isMatch, newMatch, turn } from './yacht';

function pair(
  options: { hostChatEnabled?: boolean; guestChatEnabled?: boolean } = { hostChatEnabled: true },
) {
  const queue: Array<{ target: 'host' | 'guest'; wire: Wire }> = [];
  const sent: Array<{ target: 'host' | 'guest'; wire: Wire }> = [];
  const die = vi.fn(() => 6);
  const send = (target: 'host' | 'guest') => (wire: Wire) => {
    queue.push({ target, wire });
    sent.push({ target, wire });
  };
  const host = new Session({
    name: 'ホスト',
    host: true,
    chatEnabled: options.hostChatEnabled,
    nonce: 'a'.repeat(32),
    identity: 'c'.repeat(32),
    die,
    send: send('guest'),
    changed: () => {},
  });
  const guestDie = vi.fn(() => {
    throw new Error('Guest must never draw dice');
  });
  const guest = new Session({
    name: 'Guest',
    host: false,
    chatEnabled: options.guestChatEnabled,
    nonce: 'b'.repeat(32),
    identity: 'd'.repeat(32),
    die: guestDie,
    send: send('host'),
    changed: () => {},
  });
  const flush = () => {
    let n = 0;
    while (queue.length) {
      if (++n > 100) throw new Error('Protocol loop');
      const { target, wire } = queue.shift()!;
      ({ host, guest })[target].receive(JSON.stringify(wire));
    }
  };
  const deliver = () => {
    const { target, wire } = queue.shift()!;
    ({ host, guest })[target].receive(JSON.stringify(wire));
    return wire;
  };
  const connect = () => {
    host.start();
    guest.start();
    flush();
  };
  const admit = () => {
    connect();
    host.approve();
    flush();
  };
  const begin = () => {
    admit();
    host.proposeGame();
    flush();
    host.ready();
    guest.ready();
    flush();
  };
  return { host, guest, die, guestDie, queue, sent, deliver, flush, connect, admit, begin };
}

describe('approved two-peer room and host-authoritative Yacht', () => {
  it.each([
    { hostChatEnabled: undefined, guestChatEnabled: undefined },
    { hostChatEnabled: undefined, guestChatEnabled: true },
    { hostChatEnabled: false, guestChatEnabled: true },
    { hostChatEnabled: true, guestChatEnabled: false },
  ])('shares the host-only chat policy before admission (%#)', (options) => {
    const p = pair(options);
    const enabled = options.hostChatEnabled === true;
    expect(p.host.chatEnabled).toBe(enabled);
    expect(p.guest.chatEnabled).toBe(false);
    p.connect();
    expect(p.sent.find(({ target }) => target === 'guest')!.wire.chatEnabled).toBe(enabled);
    expect(p.sent.find(({ target }) => target === 'host')!.wire).not.toHaveProperty('chatEnabled');
    for (const session of [p.host, p.guest]) {
      expect(session.chatEnabled).toBe(enabled);
      expect(session.paired).toBe(false);
      expect(session.sendChat('not admitted')).toBe(false);
    }
    p.host.approve();
    p.flush();
    for (const session of [p.host, p.guest]) {
      expect(session.sendChat('allowed only by host')).toBe(enabled);
      p.flush();
    }
    expect(p.host.messages).toHaveLength(enabled ? 2 : 0);
    expect(p.guest.messages).toHaveLength(enabled ? 2 : 0);
    expect(p.host.closed || p.guest.closed).toBe('');
  });
  it.each([undefined, null, 'true', 1, {}])(
    'rejects a missing or invalid host policy (%#)',
    (value) => {
      const p = pair();
      p.host.start();
      p.guest.start();
      const hello = p.queue.shift()!.wire;
      p.guest.receive(JSON.stringify({ ...hello, chatEnabled: value }));
      expect(p.guest.closed).toBe('Invalid room policy');
      expect(p.guest.chatEnabled).toBe(false);
      expect(p.guest.peerName).toBe('');
      expect(p.guest.sid).toBe('');
    },
  );
  it.each([false, true])('rejects a guest claiming a room policy of %s', (chatEnabled) => {
    const p = pair({ hostChatEnabled: false, guestChatEnabled: true });
    p.guest.start();
    p.host.start();
    p.host.receive(JSON.stringify({ ...p.queue.shift()!.wire, chatEnabled }));
    expect(p.host.closed).toBe('Invalid room policy');
    expect(p.host.chatEnabled).toBe(false);
    expect(p.host.messages).toEqual([]);
  });
  it.each(['admission', 'admission-ack'] as const)(
    'rejects a changed or omitted policy in %s before the receiver is admitted',
    (type) => {
      for (const chatEnabled of [undefined, true]) {
        const p = pair({ hostChatEnabled: false });
        p.connect();
        p.host.approve();
        if (type === 'admission-ack') p.deliver();
        const { target, wire } = p.queue.shift()!;
        const receiver = p[target];
        receiver.receive(JSON.stringify({ ...wire, chatEnabled }));
        expect(receiver.closed).toBe('Room policy mismatch');
        expect(receiver.paired).toBe(false);
        expect(receiver.chatEnabled).toBe(false);
        expect(receiver.messages).toEqual([]);
      }
    },
  );
  it.each(['pending', 'approved', 'resumed'] as const)(
    'rejects repeated hello without changing the %s room policy',
    (phase) => {
      for (const target of ['host', 'guest'] as const) {
        const p = pair({ hostChatEnabled: false });
        if (phase === 'pending') p.connect();
        else p.admit();
        const receiver = p[target];
        if (phase === 'resumed') {
          receiver.suspend();
          receiver.resume();
        }
        const hello = p.sent.find(
          (frame) => frame.target === target && frame.wire.type === 'hello',
        )!;
        receiver.receive(JSON.stringify({ ...hello.wire, chatEnabled: true }));
        expect(receiver.closed).not.toBe('');
        expect(receiver.chatEnabled).toBe(false);
        expect(receiver.messages).toEqual([]);
      }
    },
  );
  it.each(['chat', 'chat-ack'] as const)(
    'rejects remote %s in an OFF room without saving text or changing the board',
    (type) => {
      for (const target of ['host', 'guest'] as const) {
        const p = pair({ hostChatEnabled: false, guestChatEnabled: true });
        p.begin();
        const receiver = p[target];
        const board = structuredClone(receiver.match);
        receiver.receive(
          JSON.stringify({
            v: PROTOCOL_VERSION,
            type,
            sid: receiver.sid,
            seq: 1,
            text: 'must not be retained',
          }),
        );
        expect(receiver.closed).toBe('Chat disabled');
        expect(receiver.messages).toEqual([]);
        expect(receiver.chatPending).toBe(false);
        expect(receiver.match).toEqual(board);
        expect(p.die).not.toHaveBeenCalled();
      }
    },
  );
  it('supports an approved chat-only room and a later host game proposal', () => {
    const p = pair();
    p.admit();
    expect(p.host.sendChat('こんにちは 👋')).toBe(true);
    expect(p.host.chatPending).toBe(true);
    expect(p.host.messages[0]?.status).toBe('sending');
    expect(p.host.sendChat('queue is bounded')).toBe(false);
    p.deliver();
    expect(p.guest.messages[0]).toMatchObject({
      sender: 'peer',
      text: 'こんにちは 👋',
      status: 'delivered',
    });
    expect(p.host.messages[0]?.status).toBe('sending');
    p.deliver();
    expect(p.host.messages[0]?.status).toBe('delivered');
    expect(p.host.messages[0]?.id).toBe(p.guest.messages[0]?.id);
    expect(p.guest.sendChat('よろしく')).toBe(true);
    p.flush();
    expect(p.host.match).toBeNull();
    expect(p.host.pending || p.guest.pending).toBe(false);
    p.host.proposeGame();
    p.flush();
    p.host.ready();
    p.guest.ready();
    p.flush();
    expect(p.host.match).toEqual(newMatch(1));
    expect(p.host.messages).toHaveLength(2);
    expect(p.guest.messages).toHaveLength(2);
    expect(
      p.sent.every(
        ({ wire }) => new TextEncoder().encode(JSON.stringify(wire)).length <= MAX_FRAME_BYTES,
      ),
    ).toBe(true);
  });
  it('rejects admission without admitting, chatting or starting a game on either peer', () => {
    const p = pair();
    p.connect();
    expect(p.guest.sendChat('not approved')).toBe(false);
    p.host.proposeGame();
    p.guest.ready();
    expect(p.host.gameProposed).toBe(false);
    p.host.reject();
    p.flush();
    expect(p.host.admission).toBe('rejected');
    expect(p.guest.admission).toBe('rejected');
    expect(p.host.closed).toBe('Admission rejected');
    expect(p.guest.closed).toBe('Admission rejected');
    expect(p.host.messages).toEqual([]);
    expect(p.host.match).toBeNull();
    p.host.approve();
    expect(p.host.paired || p.guest.paired).toBe(false);
  });
  it.each(['chat', 'chat-ack', 'ready', 'game-proposal', 'command', 'state', 'state-ack'])(
    'closes on remote %s before approval',
    (type) => {
      const p = pair();
      p.connect();
      p.host.receive(
        JSON.stringify({ v: PROTOCOL_VERSION, type, sid: p.host.sid, seq: 1, text: 'hidden' }),
      );
      expect(p.host.closed).toBe('Admission required');
      expect(p.host.messages).toEqual([]);
      expect(p.host.match).toBeNull();
      expect(p.die).not.toHaveBeenCalled();
    },
  );
  it('does not let a guest approve itself or acknowledge an approval that was never sent', () => {
    for (const type of ['admission', 'admission-ack']) {
      const p = pair();
      p.connect();
      p.host.receive(
        JSON.stringify({ v: PROTOCOL_VERSION, type, sid: p.host.sid, approved: true }),
      );
      expect(p.host.closed).not.toBe('');
      expect(p.host.admission).toBe('pending');
    }
  });
  it('deduplicates chat and does not let old chat ACKs release newer chat or game waits', () => {
    const p = pair();
    p.begin();
    p.host.sendChat('first');
    const firstChat = p.deliver();
    const firstAck = p.deliver();
    p.guest.receive(JSON.stringify(firstChat));
    p.flush();
    expect(p.guest.messages).toHaveLength(1);
    p.host.sendChat('second');
    p.host.act({ kind: 'roll' });
    p.host.receive(JSON.stringify(firstAck));
    expect(p.host.chatPending).toBe(true);
    expect(p.host.pending).toBe(true);
    const chat = p.queue.shift()!;
    p.guest.receive(JSON.stringify(chat.wire));
    const chatAck = p.queue.pop()!;
    p.host.receive(JSON.stringify(chatAck.wire));
    expect(p.host.chatPending).toBe(false);
    expect(p.host.pending).toBe(true);
    p.flush();
    expect(p.host.pending).toBe(false);
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.guest.messages.map((m) => m.text)).toEqual(['first', 'second']);
  });
  it('keeps an unacknowledged chat pending while a game state is acknowledged', () => {
    const p = pair();
    p.begin();
    p.host.sendChat('waiting');
    p.queue.shift(); // no chat delivery or ACK
    p.host.act({ kind: 'roll' });
    p.flush();
    expect(p.host.pending).toBe(false);
    expect(p.host.chatPending).toBe(true);
    p.host.end('Chat acknowledgement timeout');
    p.flush();
    expect(p.host.messages[0]?.status).toBe('failed');
    expect(p.host.chatPending).toBe(false);
    expect(p.host.sendChat('no implicit retry')).toBe(false);
    expect(p.guest.closed).not.toBe('');
  });
  it.each([
    { type: 'chat', seq: 2, text: 'gap' },
    { type: 'chat', seq: 1, text: '\n' },
    { type: 'chat', seq: 1, text: 'a'.repeat(161) },
    { type: 'chat', seq: MAX_CHAT_MESSAGES + 1, text: 'limit' },
    { type: 'chat-ack', seq: 1 },
  ])('rejects malformed, skipped or unsent chat frames (%#)', (fields) => {
    const p = pair();
    p.admit();
    p.host.receive(JSON.stringify({ v: PROTOCOL_VERSION, sid: p.host.sid, ...fields }));
    expect(p.host.closed).not.toBe('');
    expect(p.host.messages).toEqual([]);
  });
  it('rejects a conflicting duplicate instead of replacing an already received message', () => {
    const p = pair();
    p.admit();
    p.guest.sendChat('original');
    const chat = p.deliver();
    p.flush();
    p.host.receive(JSON.stringify({ ...chat, text: 'replacement' }));
    expect(p.host.closed).toBe('Conflicting chat');
    expect(p.host.messages[0]?.text).toBe('original');
  });
  it('bounds room history and closes instead of growing the message queue indefinitely', () => {
    const p = pair();
    p.admit();
    for (let i = 0; i < MAX_CHAT_MESSAGES; i++) {
      expect(p.host.sendChat('x')).toBe(true);
      p.flush();
    }
    expect(p.host.sendChat('too many')).toBe(false);
    p.flush();
    expect(p.host.closed).toBe('Chat limit');
    expect(p.host.messages).toHaveLength(MAX_CHAT_MESSAGES);
    expect(p.guest.messages).toHaveLength(MAX_CHAT_MESSAGES);
  });
  it('counts Unicode code points and rejects control, directional and malformed Unicode text', () => {
    expect(isChatText('😀'.repeat(160))).toBe(true);
    expect(isChatText('😀'.repeat(161))).toBe(false);
    for (const text of [
      '',
      '  ',
      'a\nb',
      'a\tb',
      '\u0000',
      '\u0085',
      '\u202eabc',
      '\u2066abc',
      '\ud800',
      '\udfff',
    ])
      expect(isChatText(text)).toBe(false);
    expect(isPlayerName('😀'.repeat(24))).toBe(true);
    expect(isPlayerName('😀'.repeat(25))).toBe(false);
    expect(isPlayerName(' leading')).toBe(false);
    expect(isPlayerName('name\n')).toBe(false);
    const p = pair();
    p.admit();
    expect(p.host.sendChat('😀'.repeat(160))).toBe(true);
    p.flush();
    expect(p.guest.messages[0]?.text).toBe('😀'.repeat(160));
  });
  it('enforces a round limit instead of starting an invalid next match', () => {
    const p = pair();
    p.admit();
    p.host.match = {
      ...newMatch(10000),
      revision: 48,
      scores: [Array(12).fill(0), Array(12).fill(0)],
    };
    p.host.proposeGame();
    expect(p.host.closed).toBe('Round limit');
    expect(p.host.match.round).toBe(10000);
  });
  it.each([1, 2, 3, 4])(
    'rejects protocol version %s rather than mixing older peers into admission',
    (v) => {
      const p = pair();
      p.host.start();
      p.host.receive(
        JSON.stringify({
          v,
          type: 'hello',
          name: 'Old',
          host: false,
          nonce: 'b'.repeat(32),
          identity: 'd'.repeat(32),
        }),
      );
      expect(p.host.closed).toBe('Protocol mismatch');
    },
  );
  it('retains a bounded hello that arrives before the local connected callback', () => {
    const p = pair();
    p.host.start();
    p.flush();
    expect(p.guest.peerName).toBe('');
    p.guest.start();
    p.flush();
    p.host.approve();
    p.flush();
    p.host.proposeGame();
    p.flush();
    p.host.ready();
    p.guest.ready();
    p.flush();
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.host.match).toEqual(newMatch(1));
    expect(p.guest.match).toEqual(p.host.match);
  });
  it('bounds buffering before the connection is usable', () => {
    const p = pair();
    p.guest.receive('{}');
    p.guest.receive('{}');
    p.guest.start();
    expect(p.guest.closed).not.toBe('');
    expect(p.sent).toHaveLength(0);
  });
  it('requires host admission, receipt, a proposal and both explicit Ready operations', () => {
    const p = pair();
    expect(p.sent).toHaveLength(0);
    p.connect();
    expect(p.host.peerIdentity).toBe('d'.repeat(32));
    expect(p.guest.peerIdentity).toBe('c'.repeat(32));
    p.guest.approve();
    p.host.ready();
    expect(p.host.paired || p.guest.paired).toBe(false);
    p.host.approve();
    expect(p.host.approvalPending).toBe(true);
    expect(p.host.sendChat('not yet')).toBe(false);
    p.deliver(); // guest receives admission and queues its ACK
    expect(p.guest.paired).toBe(true);
    expect(p.host.paired).toBe(false);
    p.deliver();
    expect(p.host.paired).toBe(true);
    p.host.ready();
    p.guest.ready();
    expect(p.host.match).toBeNull();
    p.guest.proposeGame();
    expect(p.guest.gameProposed).toBe(true);
    p.host.proposeGame();
    p.flush();
    p.guest.ready();
    p.flush();
    expect(p.host.match).toBeNull();
    p.host.ready();
    p.flush();
    expect(p.host.match).toEqual(newMatch(1));
    expect(p.guest.match).toEqual(p.host.match);
  });
  it('completes 24 turns, shares exact scores, preserves holds, limits rolls, and requires mutual rematch readiness', () => {
    const p = pair();
    p.begin();
    for (const category of CATEGORIES)
      for (const actor of [p.host, p.guest]) {
        actor.act({ kind: 'roll' });
        p.flush();
        actor.act({ kind: 'hold', index: 0 });
        p.flush();
        actor.act({ kind: 'roll' });
        p.flush();
        actor.act({ kind: 'roll' });
        p.flush();
        const before = JSON.stringify(p.host.match);
        actor.act({ kind: 'roll' });
        p.flush();
        actor.act({ kind: 'hold', index: 0 });
        p.flush();
        expect(JSON.stringify(p.host.match)).toBe(before);
        actor.act({ kind: 'score', category });
        p.flush();
        expect(isMatch(p.guest.match)).toBe(true);
        expect(p.host.match).toEqual(p.guest.match);
        expect(p.host.closed || p.guest.closed).toBe('');
      }
    expect(finished(p.host.match!)).toBe(true);
    expect(p.host.match!.scores[0]).toEqual([0, 0, 0, 0, 0, 30, 0, 24, 0, 0, 30, 50]);
    expect(p.host.match!.scores[1]).toEqual(p.host.match!.scores[0]);
    expect(p.die).toHaveBeenCalledTimes(24 * 3 * 5);
    expect(p.guestDie).not.toHaveBeenCalled();
    expect(p.host.sendChat('また遊ぼう')).toBe(true);
    p.flush();
    p.host.proposeGame();
    p.flush();
    p.guest.ready();
    p.flush();
    expect(p.host.match!.round).toBe(1);
    p.host.ready();
    p.flush();
    expect(p.host.match).toEqual(newMatch(2));
    expect(p.guest.match).toEqual(p.host.match);
  });
  it('requires receipt of the initial state before any host RNG or action', () => {
    const p = pair();
    p.admit();
    p.host.proposeGame();
    p.flush();
    p.host.ready();
    p.guest.ready();
    p.deliver(); // host Ready
    p.deliver(); // guest Ready creates the initial state
    expect(p.host.pending).toBe(true);
    expect(p.host.match).toEqual(newMatch(1));
    p.host.act({ kind: 'roll' });
    expect(p.die).not.toHaveBeenCalled();
    expect(p.guest.match).toBeNull();
    p.deliver(); // state received, ACK still in transit
    expect(p.guest.match).toEqual(p.host.match);
    expect(p.host.canAct).toBe(false);
    p.deliver();
    expect(p.host.pending).toBe(false);
    expect(p.host.canAct).toBe(true);
  });
  it('blocks repeated host actions and ignores old ACKs until the exact state is acknowledged', () => {
    const p = pair();
    p.begin();
    const oldAck = p.sent.find(({ wire }) => wire.type === 'state-ack')!.wire;
    p.host.act({ kind: 'roll' });
    const before = structuredClone(p.host.match);
    const sent = p.sent.length;
    p.host.act({ kind: 'roll' });
    p.host.act({ kind: 'hold', index: 0 });
    p.host.act({ kind: 'score', category: 'ones' });
    p.host.ready();
    p.host.receive(JSON.stringify(oldAck));
    p.host.receive(JSON.stringify(oldAck));
    expect(p.host.pending).toBe(true);
    expect(p.host.match).toEqual(before);
    expect(p.host.localReady).toBe(false);
    expect(p.sent).toHaveLength(sent);
    expect(p.die).toHaveBeenCalledTimes(5);
    p.deliver();
    expect(p.host.pending).toBe(true);
    const ack = p.deliver();
    expect(p.host.canAct).toBe(true);
    p.host.receive(JSON.stringify(ack));
    expect(p.host.closed).toBe('');
    p.host.act({ kind: 'hold', index: 0 });
    p.host.receive(JSON.stringify(ack));
    expect(p.host.pending).toBe(true);
    p.flush();
    expect(p.host.pending).toBe(false);
  });
  it('orders the guest state ACK before its next command and bounds duplicate replies', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.flush();
    p.host.act({ kind: 'score', category: 'ones' });
    p.deliver();
    p.guest.act({ kind: 'roll' });
    expect(p.queue.map(({ wire }) => wire.type)).toEqual(['state-ack', 'command']);
    p.deliver();
    const command = p.deliver();
    const before = structuredClone(p.host.match);
    const draws = p.die.mock.calls.length;
    p.host.receive(JSON.stringify(command));
    p.host.receive(JSON.stringify(command));
    expect(p.queue).toHaveLength(1);
    const firstState = p.queue[0]!.wire;
    p.flush();
    p.host.receive(JSON.stringify(command));
    expect(p.host.pending).toBe(false);
    expect(p.queue[0]!.wire.stateSeq).toBe(firstState.stateSeq);
    p.flush();
    expect(p.host.pending || p.guest.pending).toBe(false);
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.host.match).toEqual(before);
    expect(p.guest.match).toEqual(before);
    expect(p.die).toHaveBeenCalledTimes(draws);
    // A duplicate may arrive while the guest's next command is already in transit.
    p.guest.act({ kind: 'hold', index: 0 });
    p.host.receive(JSON.stringify(command));
    p.flush();
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.host.pending || p.guest.pending).toBe(false);
    expect(p.host.match!.held[0]).toBe(true);
    expect(p.guest.match).toEqual(p.host.match);
    expect(p.die).toHaveBeenCalledTimes(draws);
  });
  it.each([false, true])(
    'keeps final result and rematch unconfirmed until ACK (chat: %s)',
    (hostChatEnabled) => {
      const p = pair({ hostChatEnabled });
      p.begin();
      for (const category of CATEGORIES)
        for (const actor of [p.host, p.guest]) {
          actor.act({ kind: 'roll' });
          p.flush();
          actor.act({ kind: 'score', category });
          if (category !== 'yacht' || actor === p.host) p.flush();
        }
      p.deliver(); // last guest command
      expect(finished(p.host.match!)).toBe(true);
      expect(p.host.matchComplete).toBe(false);
      expect(p.host.pending).toBe(true);
      p.host.ready();
      expect(p.host.localReady).toBe(false);
      p.deliver(); // final state
      p.guest.ready();
      expect(p.queue.map(({ wire }) => wire.type)).toEqual(['state-ack']);
      p.host.ready();
      expect(p.host.match!.round).toBe(1);
      expect(p.host.localReady).toBe(false);
      p.deliver(); // ACK
      expect(p.host.matchComplete).toBe(true);
      p.host.proposeGame();
      p.flush();
      p.guest.ready();
      p.host.ready();
      p.flush();
      expect(p.host.match).toEqual(newMatch(2));
      expect(p.guest.match).toEqual(p.host.match);
      expect(p.host.pending).toBe(false);
      expect(p.host.chatEnabled).toBe(hostChatEnabled);
      expect(p.guest.chatEnabled).toBe(hostChatEnabled);
      expect(p.host.messages).toEqual([]);
      expect(p.guest.messages).toEqual([]);
    },
  );
  it.each([
    { stateSeq: 0, round: 1, revision: 1 },
    { stateSeq: 3, round: 1, revision: 1 },
    { stateSeq: 2, round: 2, revision: 1 },
    { stateSeq: 2, round: 1, revision: 0 },
    { stateSeq: 2, round: 1, revision: '1' },
  ])('rejects malformed or mismatched state ACKs (%#)', (fields) => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    const before = structuredClone(p.host.match);
    p.host.receive(
      JSON.stringify({ v: PROTOCOL_VERSION, type: 'state-ack', sid: p.host.sid, ...fields }),
    );
    expect(p.host.closed).not.toBe('');
    expect(p.host.match).toEqual(before);
    expect(p.die).toHaveBeenCalledTimes(5);
  });
  it('rejects an unacknowledged next command and v1 peers explicitly', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.host.receive(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'command',
        sid: p.host.sid,
        round: 1,
        revision: 1,
        seq: 1,
        action: { kind: 'roll' },
      }),
    );
    expect(p.host.closed).toContain('acknowledgement required');
    expect(p.die).toHaveBeenCalledTimes(5);
    const old = pair();
    old.host.start();
    old.host.receive(
      JSON.stringify({ v: 1, type: 'hello', name: 'Old', host: false, nonce: 'b'.repeat(32) }),
    );
    expect(old.host.closed).toBe('Protocol mismatch');
    expect(old.host.peerName).toBe('');
  });
  it('rejects a remote operation on the host turn without consuming RNG or accepting a forged seat', () => {
    const p = pair();
    p.begin();
    const before = structuredClone(p.host.match);
    p.host.receive(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'command',
        sid: p.host.sid,
        round: 1,
        revision: 0,
        seq: 1,
        seat: 0,
        action: { kind: 'roll' },
      }),
    );
    expect(p.host.match).toEqual(before);
    expect(p.die).not.toHaveBeenCalled();
  });
  it('ignores duplicates, stale revisions and commands for a different round', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.flush();
    p.host.act({ kind: 'score', category: 'ones' });
    p.flush();
    p.guest.act({ kind: 'roll' });
    p.flush();
    const command = p.sent.find((m) => m.wire.type === 'command')!.wire;
    const before = structuredClone(p.host.match);
    const draws = p.die.mock.calls.length;
    p.host.receive(JSON.stringify({ ...command, revision: p.host.match!.revision }));
    p.flush();
    expect(p.host.match).toEqual(before);
    expect(p.die).toHaveBeenCalledTimes(draws);
    p.guest.act({ kind: 'roll' });
    const stale = p.queue.shift()!.wire;
    p.host.receive(JSON.stringify({ ...stale, revision: command.revision }));
    p.flush();
    p.guest.act({ kind: 'roll' });
    const wrongRound = p.queue.shift()!.wire;
    p.host.receive(JSON.stringify({ ...wrongRound, round: 2 }));
    p.flush();
    expect(p.host.match).toEqual(before);
    expect(p.host.pending || p.guest.pending).toBe(false);
    expect(p.host.closed || p.guest.closed).toBe('');
    expect(p.die).toHaveBeenCalledTimes(draws);
  });
  it('never advances the guest optimistically or continues after disconnect', () => {
    const p = pair();
    p.begin();
    p.host.act({ kind: 'roll' });
    p.flush();
    p.host.act({ kind: 'score', category: 'ones' });
    p.flush();
    const before = structuredClone(p.guest.match);
    p.guest.act({ kind: 'roll' });
    expect(p.guest.pending).toBe(true);
    expect(p.guest.match).toEqual(before);
    const commands = p.sent.length;
    p.guest.act({ kind: 'roll' });
    expect(p.sent).toHaveLength(commands);
    p.guest.end('Disconnected', false);
    p.flush();
    expect(p.guest.match).toEqual(before);
    expect(p.guest.canAct).toBe(false);
  });
  it.each([
    '{',
    JSON.stringify({ v: 1, type: 'hello' }),
    ' '.repeat(4097),
    JSON.stringify({ v: PROTOCOL_VERSION, type: 'command', sid: 'wrong', seq: 1 }),
    JSON.stringify({
      v: PROTOCOL_VERSION,
      type: 'state',
      sid: 'a'.repeat(32),
      match: newMatch(1),
      ack: 0,
    }),
    JSON.stringify({
      v: PROTOCOL_VERSION,
      type: 'command',
      sid: 'a'.repeat(32),
      round: 1,
      revision: 0,
      seq: 1,
      action: { kind: 'hold', index: 99 },
    }),
  ])('closes on malformed or unauthorized frames without changing host state (%#)', (raw) => {
    const p = pair();
    p.begin();
    const before = structuredClone(p.host.match);
    p.host.receive(raw);
    expect(p.host.closed).not.toBe('');
    expect(p.host.match).toEqual(before);
    expect(p.die).not.toHaveBeenCalled();
  });
  it('refuses a noncomplementary host role and does not auto-confirm', () => {
    const p = pair();
    p.host.start();
    p.host.receive(
      JSON.stringify({
        v: PROTOCOL_VERSION,
        type: 'hello',
        host: true,
        name: 'Second host',
        nonce: 'b'.repeat(32),
      }),
    );
    expect(p.host.closed).not.toBe('');
    expect(p.host.admission).toBe('pending');
  });
  it('rejects invalid, skipped and conflicting guest snapshots', () => {
    for (const match of [
      { ...newMatch(1), dice: [7, 1, 1, 1, 1], revision: 1 },
      { ...newMatch(1), revision: 2 },
      { ...newMatch(1), dice: [2, 2, 2, 2, 2] },
    ]) {
      const p = pair();
      p.begin();
      const before = structuredClone(p.guest.match);
      p.guest.receive(
        JSON.stringify({
          v: PROTOCOL_VERSION,
          type: 'state',
          sid: p.guest.sid,
          match,
          ack: 0,
          stateSeq: 2,
        }),
      );
      expect(p.guest.closed).not.toBe('');
      expect(p.guest.match).toEqual(before);
    }
  });
});

describe('Yacht legal moves', () => {
  it('rejects scoring and holding before the first throw, all-held rolls, and reused categories', () => {
    const die = vi.fn(() => 4);
    let m = newMatch(1);
    expect(apply(m, 0, { kind: 'score', category: 'ones' }, die)).toBeNull();
    expect(apply(m, 0, { kind: 'hold', index: 1 }, die)).toBeNull();
    m = apply(m, 0, { kind: 'roll' }, die)!;
    for (let index = 0; index < 5; index++) m = apply(m, 0, { kind: 'hold', index }, die)!;
    expect(apply(m, 0, { kind: 'roll' }, die)).toBeNull();
    expect(die).toHaveBeenCalledTimes(5);
    m = apply(m, 0, { kind: 'score', category: 'fours' }, die)!;
    expect(m.scores[0][3]).toBe(20);
    expect(turn(m)).toBe(1);
    expect(m.held).toEqual(Array(5).fill(false));
    m = apply(m, 1, { kind: 'roll' }, die)!;
    m = apply(m, 1, { kind: 'score', category: 'ones' }, die)!;
    m = apply(m, 0, { kind: 'roll' }, die)!;
    expect(apply(m, 0, { kind: 'score', category: 'fours' }, die)).toBeNull();
  });
});
