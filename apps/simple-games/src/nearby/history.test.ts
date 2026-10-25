import { describe, expect, it } from 'vitest';
import {
  clearHistory,
  deleteGathering,
  loadHistory,
  saveGathering,
  validateHistory,
  blockIdentity,
  savedGameId,
  savedGameResult,
  type Gathering,
} from './history';
function store() {
  let data: string | null = null;
  return {
    readHistory: async () => ({ data }),
    writeHistory: async (input: { data: string }) => {
      data = input.data;
    },
    clearHistory: async () => {
      data = null;
    },
  };
}
const gathering = (): Gathering => ({
  id: 'a'.repeat(32),
  at: 100,
  label: 'F-ABC123',
  transport: 'ble',
  host: true,
  names: ['Alice', 'Bob'],
  messages: [{ id: 'one', sender: 'self', text: 'Hello', status: 'delivered', at: 101 }],
  games: [{ round: 1, at: 100, finished: true, scores: [40, 32] }],
  endedAt: 110,
});

async function slowStore() {
  const storage = store();
  await loadHistory(storage);
  let release!: () => void;
  let began!: () => void;
  const blocked = new Promise<void>((resolve) => {
    release = resolve;
  });
  const started = new Promise<void>((resolve) => {
    began = resolve;
  });
  const writes: string[] = [];
  const io = {
    ...storage,
    writeHistory: async (input: { data: string }) => {
      writes.push(input.data);
      if (writes.length === 1) {
        began();
        await blocked;
      }
      await storage.writeHistory(input);
    },
  };
  return { io, started, release, writes };
}

describe('device-only nearby history', () => {
  it('keeps legacy v1 Yacht intact while storing explicit game results in new records', async () => {
    const io = store();
    await loadHistory(io);
    const legacy = gathering();
    await saveGathering(legacy, io);
    const current = gathering();
    current.id = 'b'.repeat(32);
    current.games = [
      { gameId: 'gin-rummy', round: 1, at: 100, finished: true, scores: [500, 200], winner: 0 },
      { gameId: 'chess', round: 2, at: 105, finished: true, scores: [0, 0], winner: 'draw' },
      { gameId: 'nim', round: 3, at: 110, finished: false, scores: [0, 0], winner: null },
    ];
    await saveGathering(current, io);
    const saved = await loadHistory(io);
    expect(saved.version).toBe(1);
    expect(saved.gatherings).toEqual([current, legacy]);
    expect(savedGameId(legacy.games[0]!)).toBe('yacht');
    expect(savedGameResult(legacy.games[0]!)).toEqual({ scores: [40, 32], winner: 0 });
    expect(savedGameResult(current.games[1]!)).toEqual({ scores: [0, 0], winner: 'draw' });
    expect(savedGameResult(current.games[2]!)).toEqual({ scores: [0, 0], winner: null });
  });
  it.each([
    { gameId: 'unknown', winner: 0 },
    { gameId: 'chess' },
    { winner: 0 },
    { gameId: 'chess', winner: 2 },
    { gameId: 'chess', winner: null },
    { gameId: 'chess', winner: 0, scores: [NaN, 0] },
    { gameId: 'chess', winner: 0, scores: [1000001, 0] },
    { gameId: 'chess', winner: 0, finished: false },
  ])(
    'refuses an invalid new result without overwriting existing v1 history (%#)',
    async (fields) => {
      const io = store();
      await loadHistory(io);
      const legacy = gathering();
      await saveGathering(legacy, io);
      const before = (await io.readHistory()).data;
      const invalid = { ...legacy, games: [{ ...legacy.games[0], ...fields }] };
      await expect(saveGathering(invalid as Gathering, io)).rejects.toThrow('History full');
      expect((await io.readHistory()).data).toBe(before);
    },
  );
  it('retains transcripts after closing and rereading, independently of other participants', async () => {
    const a = store(),
      b = store();
    await Promise.all([loadHistory(a), loadHistory(b)]);
    await Promise.all([saveGathering(gathering(), a), saveGathering(gathering(), b)]);
    expect((await loadHistory(a)).gatherings).toEqual([gathering()]);
    await deleteGathering(gathering().id, a);
    expect((await loadHistory(a)).gatherings).toEqual([]);
    expect((await loadHistory(b)).gatherings).toHaveLength(1);
  });
  it('orders reset behind pending writes and deletes local blocks too', async () => {
    const io = store();
    await loadHistory(io);
    await blockIdentity('b'.repeat(32), io);
    const write = saveGathering(gathering(), io);
    const reset = clearHistory(io);
    await Promise.all([write, reset]);
    expect((await loadHistory(io)).gatherings).toEqual([]);
    expect((await loadHistory(io)).blocked).toEqual([]);
  });
  it('does not overwrite corrupt/unknown records and reports write failures', async () => {
    const io = store();
    await io.writeHistory({ data: '{"version":999}' });
    await expect(loadHistory(io)).rejects.toThrow();
    await expect(saveGathering(gathering(), io)).rejects.toThrow();
    expect((await io.readHistory()).data).toBe('{"version":999}');
    await io.clearHistory();
    await expect(
      loadHistory({
        ...io,
        writeHistory: async () => {
          throw new Error('disk full');
        },
      }),
    ).rejects.toThrow('disk full');
    expect(
      validateHistory({
        version: 1,
        identity: 'a'.repeat(32),
        blocked: [],
        gatherings: [{ ...gathering(), games: [{ round: 1, scores: ['wrong'] }] }],
      }),
    ).toBeNull();
  });
  it('refuses the cap without evicting existing history', async () => {
    const io = store();
    const data = await loadHistory(io);
    data.gatherings = Array.from({ length: 100 }, (_, i) => ({
      ...gathering(),
      id: i.toString(16).padStart(32, '0'),
    }));
    await io.writeHistory({ data: JSON.stringify(data) });
    await expect(saveGathering(gathering(), io)).rejects.toThrow('History full');
    expect((await loadHistory(io)).gatherings).toHaveLength(100);
  });

  it('retains only an active write and the newest pending snapshot during 1000 changes', async () => {
    const { io, started, release, writes } = await slowStore();
    const current = gathering();
    const active = saveGathering(current, io);
    await started;
    const updates = Array.from({ length: 1000 }, (_, index) => {
      current.messages[0]!.text = `Change ${index}`;
      return saveGathering(current, io);
    });
    current.messages[0]!.text = 'Changed after queuing';
    const pendingCount = new Set(updates).size;
    const callsWhileBlocked = writes.length;
    release();
    await Promise.all([active, ...updates]);

    expect(pendingCount).toBe(1);
    expect(updates[0]).not.toBe(active);
    expect(callsWhileBlocked).toBe(1);
    expect(writes).toHaveLength(2);
    expect(validateHistory(JSON.parse(writes[0]!))?.gatherings[0]?.messages[0]?.text).toBe('Hello');
    expect(validateHistory(JSON.parse(writes[1]!))?.gatherings[0]?.messages[0]?.text).toBe(
      'Change 999',
    );
  });

  it('does not revive coalesced transcripts after a reset queued during a slow write', async () => {
    const { io, started, release, writes } = await slowStore();
    const current = gathering();
    const active = saveGathering(current, io);
    await started;
    const updates = Array.from({ length: 1000 }, (_, index) => {
      current.messages[0]!.text = `Before reset ${index}`;
      return saveGathering(current, io);
    });
    const reset = clearHistory(io);
    release();
    await Promise.all([active, ...updates, reset]);

    expect(writes).toHaveLength(2);
    expect((await io.readHistory()).data).toBeNull();
  });

  it.each(['load', 'delete', 'clear', 'block'] as const)(
    'does not coalesce saves across a %s barrier',
    async (kind) => {
      const { io, started, release } = await slowStore();
      const current = gathering();
      const active = saveGathering(current, io);
      await started;
      current.messages[0]!.text = 'Before barrier';
      const before = saveGathering(current, io);
      const barrier =
        kind === 'load'
          ? loadHistory(io)
          : kind === 'delete'
            ? deleteGathering(current.id, io)
            : kind === 'clear'
              ? clearHistory(io)
              : blockIdentity('b'.repeat(32), io);
      current.messages[0]!.text = 'Explicit save after barrier';
      const after = saveGathering(current, io);
      release();
      const [, , observed] = await Promise.all([active, before, barrier, after]);

      expect(before).not.toBe(after);
      if (kind === 'load') {
        if (!observed) throw new Error('The load barrier did not return history');
        expect(observed?.gatherings[0]?.messages[0]?.text).toBe('Before barrier');
      }
      const saved = validateHistory(JSON.parse((await io.readHistory()).data!));
      expect(saved?.gatherings).toHaveLength(1);
      expect(saved?.gatherings[0]?.messages[0]?.text).toBe('Explicit save after barrier');
      expect(saved?.blocked).toEqual(kind === 'block' ? ['b'.repeat(32)] : []);
    },
  );
});
