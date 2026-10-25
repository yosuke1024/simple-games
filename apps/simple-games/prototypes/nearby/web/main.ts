import { Capacitor, registerPlugin, type PluginListenerHandle } from '@capacitor/core';
import { CATEGORIES } from '../../../src/games/yacht/game/types';
import { scoreFor } from '../../../src/games/yacht/game/engine';
import { Session, type Wire } from './session';
import { finished, totals, turn } from './yacht';
import './style.css';

type NativeEvent =
  | { type: 'peer'; id: string; name: string }
  | { type: 'connected' }
  | { type: 'data'; data: string }
  | { type: 'disconnected'; reason: string }
  | { type: 'error'; code: string; message: string }
  | { type: 'status'; message: string };
interface NearbyPlugin {
  capabilities(): Promise<Record<string, unknown>>;
  start(options: { transport: string; role: string; label: string }): Promise<void>;
  connect(options: { peerId: string }): Promise<void>;
  send(options: { data: string }): Promise<void>;
  stop(): Promise<void>;
  addListener(
    event: 'nearbyEvent',
    listener: (event: NativeEvent) => void,
  ): Promise<PluginListenerHandle>;
}
const el = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const button = (id: string) => el<HTMLButtonElement>(id);
const plugin = registerPlugin<NearbyPlugin>('NearbyPoc');
let session: Session | null = null;
let active = false;
let generation = 0;
let listener: PluginListenerHandle | null = null;
let sends = Promise.resolve();
let commandTimer: ReturnType<typeof setTimeout> | undefined;
let helloTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setTimeout> | undefined;
let pingStart = 0;
let pingCount = 0;
const diagnostics: string[] = [];
const peers = new Set<string>();
const startedAt = performance.now();
function log(message: string) {
  diagnostics.push(`${((performance.now() - startedAt) / 1000).toFixed(2)}s ${message}`);
  if (diagnostics.length > 100) diagnostics.shift();
  el('log').textContent = diagnostics.join('\n');
}
function nonce() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (v) =>
    v.toString(16).padStart(2, '0'),
  ).join('');
}
function die() {
  const bytes = new Uint8Array(1);
  do {
    crypto.getRandomValues(bytes);
  } while (bytes[0]! >= 252);
  return (bytes[0]! % 6) + 1;
}
function send(message: Wire) {
  const current = generation;
  const data = JSON.stringify(message);
  log(`TX ${message.type} ${new TextEncoder().encode(data).length} bytes`);
  sends = sends
    .then(async () => {
      if (active && current === generation) await plugin.send({ data });
    })
    .catch((error: unknown) => {
      if (current === generation) void stop(`Send failed: ${String(error)}`);
    });
}
async function stop(reason: string) {
  if (!active) return;
  // End is best-effort; the native disconnect is the final authority, not an ACK wait.
  active = false;
  const stoppedGeneration = ++generation;
  const oldListener = listener;
  listener = null;
  clearTimeout(commandTimer);
  clearTimeout(helloTimer);
  clearTimeout(pingTimer);
  commandTimer = helloTimer = pingTimer = undefined;
  session?.end(reason, false);
  log(reason);
  try {
    await plugin.stop();
  } catch (error) {
    log(`Stop: ${String(error)}`);
  }
  await oldListener?.remove();
  if (generation !== stoppedGeneration) return;
  el('status').textContent = reason;
  button('start').disabled = false;
  el('setup').hidden = false;
  render();
}
const labels = [
  'Ones / 1',
  'Twos / 2',
  'Threes / 3',
  'Fours / 4',
  'Fives / 5',
  'Sixes / 6',
  'Full House',
  'Four of a Kind',
  'Little Straight',
  'Big Straight',
  'Choice',
  'Yacht',
];
function render() {
  const s = session;
  if (!s) return;
  if (s.closed && active) {
    void stop(s.closed);
    return;
  }
  if (s.peerName) clearTimeout(helloTimer);
  el('pairing').hidden = !s.peerName || s.paired || !!s.closed;
  el('peerName').textContent = `相手 / Peer: ${s.peerName}`;
  el('code').textContent = s.code;
  button('confirm').disabled = s.localConsent || !active;
  button('ready').hidden = !s.paired || !!(s.match && !finished(s.match));
  button('ready').disabled = s.localReady || !active;
  button('ready').textContent = s.localReady
    ? '相手の Ready を待っています / Waiting'
    : s.match
      ? 'もう一局 / Ready for rematch'
      : '準備できました / Ready';
  button('ping').hidden = !s.paired;
  if (s.paired) el('status').textContent = '双方で接続を確認しました / Confirmed';
  if (s.closed) el('status').textContent = s.closed;
  button('stop').disabled = !active;
  if (s.pending && !commandTimer)
    commandTimer = setTimeout(() => {
      void stop('応答がありません。接続を終了しました / Command timeout');
    }, 15000);
  if (!s.pending) {
    clearTimeout(commandTimer);
    commandTimer = undefined;
  }
  if (s.pings > pingCount) {
    pingCount = s.pings;
    const ms = Math.round(performance.now() - pingStart);
    clearTimeout(pingTimer);
    pingTimer = undefined;
    button('ping').disabled = false;
    el('pingResult').textContent = `往復 / RTT: ${ms} ms (${pingCount})`;
    log(`Ping round trip ${ms} ms`);
  }
  el('game').hidden = !s.match;
  const m = s.match;
  if (!m) return;
  el('name0').textContent = s.names[0]!;
  el('name1').textContent = s.names[1]!;
  el('turn').textContent = s.closed
    ? '対局終了 / Session ended'
    : finished(m)
      ? '対局完了 / Finished'
      : `${s.names[turn(m)]} の番 / Turn · ${m.rolls}/3 · rev ${m.revision}`;
  el('dice').replaceChildren(
    ...m.dice.map((face, index) => {
      const b = document.createElement('button');
      b.textContent = m.rolls ? String(face) : '—';
      b.setAttribute('aria-label', `Die ${index + 1}: ${m.rolls ? face : 'not rolled'}`);
      b.setAttribute('aria-pressed', String(m.held[index]));
      b.disabled = !s.canAct || m.rolls === 0 || m.rolls === 3;
      b.onclick = () => s.act({ kind: 'hold', index });
      return b;
    }),
  );
  button('roll').disabled = !s.canAct || m.rolls >= 3 || m.held.every(Boolean);
  el('scores').replaceChildren(
    ...CATEGORIES.map((category, index) => {
      const row = document.createElement('tr');
      const th = document.createElement('th');
      th.scope = 'row';
      th.textContent = labels[index]!;
      row.append(th);
      for (const sheet of m.scores) {
        const td = document.createElement('td');
        td.textContent = sheet[index] === null ? '—' : String(sheet[index]);
        row.append(td);
      }
      const cell = document.createElement('td');
      const b = document.createElement('button');
      b.textContent = m.rolls ? String(scoreFor(category, m.dice)) : '—';
      b.setAttribute('aria-label', `Score ${category}: ${b.textContent}`);
      b.disabled = !s.canAct || m.rolls === 0 || m.scores[s.host ? 0 : 1][index] !== null;
      b.onclick = () => s.act({ kind: 'score', category });
      cell.append(b);
      row.append(cell);
      return row;
    }),
  );
  const [a, b] = totals(m);
  el('total0').textContent = String(a);
  el('total1').textContent = String(b);
  el('result').textContent = finished(m)
    ? a === b
      ? '引き分け / Draw'
      : `${s.names[a! > b! ? 0 : 1]} の勝ち / Wins`
    : '';
}
async function start() {
  if (active) return;
  const name = el<HTMLInputElement>('name').value.trim();
  let current = generation;
  try {
    const identity = nonce();
    const radioLabel = `P-${identity.slice(0, 6)}`;
    session = new Session({
      host: el<HTMLInputElement>('host').checked,
      name,
      nonce: identity,
      die,
      send,
      changed: render,
    });
    active = true;
    current = ++generation;
    sends = Promise.resolve();
    peers.clear();
    pingCount = 0;
    el('peers').replaceChildren();
    el('pingResult').textContent = '';
    button('ping').disabled = false;
    el('connection').hidden = false;
    el('setup').hidden = true;
    button('start').disabled = true;
    el('status').textContent = '接続を準備中 / Starting';
    el('radioLabel').textContent = `この端末の探索名 / Radio label: ${radioLabel}`;
    render();
    const handle = await plugin.addListener('nearbyEvent', (event) => {
      if (!active || current !== generation) return;
      if (event.type === 'data') {
        log(`RX ${new TextEncoder().encode(event.data).length} bytes`);
        session?.receive(event.data);
      } else if (event.type === 'connected') {
        el('peers').replaceChildren();
        el('status').textContent = '接続。相手の情報を待っています / Connected';
        log('Transport connected');
        helloTimer = setTimeout(() => {
          void stop('Handshake timeout');
        }, 15000);
        session?.start();
      } else if (event.type === 'peer') {
        if (peers.has(event.id) || peers.size >= 32) return;
        peers.add(event.id);
        const b = document.createElement('button');
        b.textContent = event.name || event.id;
        b.onclick = async () => {
          el('peers').replaceChildren();
          try {
            await plugin.connect({ peerId: event.id });
          } catch (error) {
            if (current === generation) void stop(String(error));
          }
        };
        el('peers').append(b);
      } else if (event.type === 'error') {
        void stop(`${event.code}: ${event.message}`);
      } else if (event.type === 'disconnected') {
        void stop(event.reason || 'Disconnected');
      } else {
        el('status').textContent = event.message;
        log(event.message);
      }
    });
    if (!active || current !== generation) {
      await handle.remove();
      return;
    }
    listener = handle;
    await plugin.start({
      transport: el<HTMLSelectElement>('transport').value,
      role: el<HTMLSelectElement>('role').value,
      label: radioLabel,
    });
  } catch (error) {
    if (current !== generation) return;
    if (active) await stop(String(error));
    else {
      el('capabilityInfo').textContent = String(error);
      button('start').disabled = false;
    }
  }
}
button('start').onclick = () => {
  void start();
};
button('capabilities').onclick = async () => {
  try {
    el('capabilityInfo').textContent = JSON.stringify(await plugin.capabilities());
  } catch (error) {
    el('capabilityInfo').textContent = String(error);
  }
};
button('stop').onclick = () => {
  void stop('終了しました / Ended locally');
};
button('confirm').onclick = () => session?.confirm();
button('ready').onclick = () => session?.ready();
button('roll').onclick = () => session?.act({ kind: 'roll' });
button('ping').onclick = () => {
  if (!session?.paired || pingTimer) return;
  pingStart = performance.now();
  button('ping').disabled = true;
  pingTimer = setTimeout(() => {
    void stop('Ping timeout');
  }, 15000);
  session.ping();
};
document.addEventListener('visibilitychange', () => {
  if (document.hidden) void stop('Background: session ended');
});
window.addEventListener('pagehide', () => {
  void stop('Page closed');
});
if (!Capacitor.isNativePlatform()) {
  el('setup').hidden = true;
  el('unsupported').hidden = false;
}
