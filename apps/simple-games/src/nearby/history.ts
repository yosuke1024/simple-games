import { nearbyPlugin, randomId, type NearbyPlugin, type Transport } from './native';
import { isNearbyGameId } from '../app/nearbyGameIds';
import type { GameResult, NearbyGameId } from './gameTypes';

export interface SavedMessage {
  id: string;
  sender: 'self' | 'peer';
  text: string;
  status: 'sending' | 'delivered' | 'failed';
  at: number;
}
export interface SavedGame {
  gameId?: NearbyGameId; // Absent only in legacy v1 Yacht records.
  round: number;
  at: number;
  finished: boolean;
  scores: [number, number];
  winner?: GameResult['winner'];
}
export const savedGameId = (game: SavedGame): NearbyGameId => game.gameId ?? 'yacht';
export const savedGameResult = (game: SavedGame): GameResult => ({
  scores: game.scores,
  winner: !game.finished
    ? null
    : (game.winner ??
      (game.scores[0] === game.scores[1] ? 'draw' : game.scores[0] > game.scores[1] ? 0 : 1)),
});
export interface Gathering {
  id: string;
  at: number;
  endedAt?: number;
  /** Local block target, never advertised or included in a report automatically. */
  peerIdentity?: string;
  label: string;
  roomName?: string;
  transport: Transport;
  host: boolean;
  names: [string, string];
  messages: SavedMessage[];
  games: SavedGame[];
}
export interface HistoryData {
  version: 1;
  identity: string;
  displayName?: string;
  blocked: string[];
  gatherings: Gathering[];
}
type HistoryIO = Pick<NearbyPlugin, 'readHistory' | 'writeHistory' | 'clearHistory'>;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{32}$/.test(v);
const integer = (v: unknown): v is number =>
  typeof v === 'number' && Number.isSafeInteger(v) && v >= 0;
const text = (v: unknown, max: number): v is string => typeof v === 'string' && v.length <= max;
// eslint-disable-next-line no-control-regex -- reject control characters in stored display names.
const name = (v: unknown) => text(v, 48) && !/[\u0000-\u001f\u007f]/.test(v);
// New optional names follow the wire's isPlayerName rules. Keep legacy names
// above readable, and keep history validation independent of game/session code.
// eslint-disable-next-line no-control-regex -- Reject controls, bidi overrides and lone surrogates.
const unsafeName = /[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069\ud800-\udfff]/u;
const strictName = (v: unknown): v is string =>
  typeof v === 'string' &&
  v.trim() === v &&
  v.length > 0 &&
  Array.from(v).length <= 24 &&
  !unsafeName.test(v);
const MAX_BYTES = 1024 * 1024;

/** Never trusts files, even though they are never accepted from another device. */
export function validateHistory(v: unknown): HistoryData | null {
  if (
    !object(v) ||
    v.version !== 1 ||
    !id(v.identity) ||
    (v.displayName !== undefined && !strictName(v.displayName)) ||
    !Array.isArray(v.blocked) ||
    v.blocked.length > 1000 ||
    !v.blocked.every(id) ||
    !Array.isArray(v.gatherings) ||
    v.gatherings.length > 100
  )
    return null;
  for (const g of v.gatherings) {
    if (
      !object(g) ||
      !id(g.id) ||
      !integer(g.at) ||
      (g.peerIdentity !== undefined && !id(g.peerIdentity)) ||
      (g.endedAt !== undefined && !integer(g.endedAt)) ||
      !text(g.label, 32) ||
      (g.roomName !== undefined && !strictName(g.roomName)) ||
      (g.transport !== 'ble' && g.transport !== 'lan') ||
      typeof g.host !== 'boolean' ||
      !Array.isArray(g.names) ||
      g.names.length !== 2 ||
      !g.names.every(name) ||
      !Array.isArray(g.messages) ||
      g.messages.length > 1000 ||
      !Array.isArray(g.games) ||
      g.games.length > 10000
    )
      return null;
    if (
      !g.messages.every(
        (m: unknown) =>
          object(m) &&
          text(m.id, 100) &&
          integer(m.at) &&
          (m.sender === 'self' || m.sender === 'peer') &&
          text(m.text, 640) &&
          ['sending', 'delivered', 'failed'].includes(String(m.status)),
      )
    )
      return null;
    if (
      !g.games.every(
        (m: unknown) =>
          object(m) &&
          integer(m.round) &&
          m.round > 0 &&
          integer(m.at) &&
          typeof m.finished === 'boolean' &&
          Array.isArray(m.scores) &&
          m.scores.length === 2 &&
          m.scores.every(
            (score: unknown) => integer(score) && score <= (m.gameId === undefined ? 375 : 1000000),
          ) &&
          (m.gameId === undefined
            ? m.winner === undefined
            : isNearbyGameId(m.gameId) &&
              (m.finished
                ? m.winner === 0 || m.winner === 1 || m.winner === 'draw'
                : m.winner === null)),
      )
    )
      return null;
  }
  return v as unknown as HistoryData;
}

// The single queue includes Reset Local Data. A queued write cannot resurrect a
// deleted transcript. Failures reject to the UI instead of falsely saying saved.
let operations: Promise<unknown> = Promise.resolve();
interface PendingSave {
  snapshot: Gathering;
  task: Promise<void>;
}
let pendingSaves = new WeakMap<HistoryIO, Map<string, PendingSave>>();
function queue<T>(operation: () => Promise<T>, barrier = true): Promise<T> {
  // Reads and explicit mutations observe call order. In particular, a later
  // save must not replace a snapshot queued before a delete or reset.
  if (barrier) pendingSaves = new WeakMap();
  const task = operations.then(operation, operation);
  operations = task.catch(() => undefined);
  return task;
}
async function read(io: HistoryIO): Promise<HistoryData> {
  const { data } = await io.readHistory();
  if (data === null) return { version: 1, identity: randomId(), blocked: [], gatherings: [] };
  if (new TextEncoder().encode(data).length > MAX_BYTES) throw new Error('History unavailable');
  const valid = validateHistory(JSON.parse(data));
  if (!valid) throw new Error('History unavailable');
  return valid;
}
async function write(value: HistoryData, io: HistoryIO) {
  const data = JSON.stringify(value);
  if (!validateHistory(value) || new TextEncoder().encode(data).length > MAX_BYTES)
    throw new Error('History full');
  await io.writeHistory({ data });
}
export function loadHistory(io: HistoryIO = nearbyPlugin): Promise<HistoryData> {
  return queue(async () => {
    const data = await read(io);
    // Persist installation identity before any radio session starts.
    await write(data, io);
    return data;
  });
}
export function saveDisplayName(displayName: string, io: HistoryIO = nearbyPlugin): Promise<void> {
  return queue(async () => {
    if (!strictName(displayName)) throw new Error('Invalid display name');
    const data = await read(io);
    data.displayName = displayName;
    await write(data, io);
  });
}
export function saveGathering(gathering: Gathering, io: HistoryIO = nearbyPlugin): Promise<void> {
  const snapshot = JSON.parse(JSON.stringify(gathering)) as Gathering;
  let pending = pendingSaves.get(io);
  if (!pending) {
    pending = new Map();
    pendingSaves.set(io, pending);
  }
  const existing = pending.get(snapshot.id);
  if (existing) {
    existing.snapshot = snapshot;
    return existing.task;
  }
  const batch: PendingSave = { snapshot, task: Promise.resolve() };
  pending.set(snapshot.id, batch);
  const index = pending;
  const gatheringId = snapshot.id;
  batch.task = queue(async () => {
    // Once execution begins, retain its immutable snapshot separately. Further
    // updates share just one pending batch instead of retaining every transcript.
    index.delete(gatheringId);
    const latest = batch.snapshot;
    const data = await read(io);
    const position = data.gatherings.findIndex((g) => g.id === latest.id);
    if (position < 0) data.gatherings.unshift(latest);
    else data.gatherings[position] = latest;
    await write(data, io);
  }, false);
  return batch.task;
}
export function deleteGathering(gatheringId: string, io: HistoryIO = nearbyPlugin): Promise<void> {
  return queue(async () => {
    const data = await read(io);
    data.gatherings = data.gatherings.filter((g) => g.id !== gatheringId);
    await write(data, io);
  });
}
export function blockIdentity(identity: string, io: HistoryIO = nearbyPlugin): Promise<void> {
  return queue(async () => {
    if (!id(identity)) throw new Error('Invalid identity');
    const data = await read(io);
    if (!data.blocked.includes(identity)) data.blocked.push(identity);
    await write(data, io);
  });
}
export function clearHistory(io: HistoryIO = nearbyPlugin): Promise<void> {
  return queue(() => io.clearHistory());
}
