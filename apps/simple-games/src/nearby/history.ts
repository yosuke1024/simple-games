import { nearbyPlugin, randomId, type NearbyPlugin, type Transport } from './native';

export interface SavedMessage {
  id: string;
  sender: 'self' | 'peer';
  text: string;
  status: 'sending' | 'delivered' | 'failed';
  at: number;
}
export interface SavedGame {
  round: number;
  at: number;
  finished: boolean;
  scores: [number, number];
}
export interface Gathering {
  id: string;
  at: number;
  endedAt?: number;
  label: string;
  transport: Transport;
  host: boolean;
  names: [string, string];
  messages: SavedMessage[];
  games: SavedGame[];
}
export interface HistoryData {
  version: 1;
  identity: string;
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
const MAX_BYTES = 1024 * 1024;

/** Never trusts files, even though they are never accepted from another device. */
export function validateHistory(v: unknown): HistoryData | null {
  if (
    !object(v) ||
    v.version !== 1 ||
    !id(v.identity) ||
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
      (g.endedAt !== undefined && !integer(g.endedAt)) ||
      !text(g.label, 32) ||
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
          m.scores.every((score: unknown) => integer(score) && score <= 375),
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
