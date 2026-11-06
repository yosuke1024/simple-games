import { describe, it, expect } from 'vitest';
import { createMemoryKV } from '@/storage/kv';
import { loadRecord } from '@/storage/repo';
import { createSession, step, cpuView, chooseCpuMove } from '../game';
import { sortHand } from '../game/handOrder';
import { loadSaved, loadSavedGame, saveGame, clearSavedGame } from './gamePersistence';
import { gameSchema, statsSchema } from './schemas';
describe('isolated CPU records', () => {
  it('round trips an interrupted turn and keeps the same legal continuation', async () => {
    const kv = createMemoryKV();
    let s = createSession(8);
    for (let i = 0; i < 5 && s.status === 'playing'; i++) s = step(s, chooseCpuMove(cpuView(s)))!;
    if (s.status !== 'playing') s = createSession(3);
    s.elapsedSeconds = 47;
    await saveGame(s, kv);
    const resumed = await loadSavedGame(kv);
    expect(resumed).toEqual(s);
    expect(step(resumed!, chooseCpuMove(cpuView(resumed!)))).toEqual(
      step(s, chooseCpuMove(cpuView(s))),
    );
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
  it('isolates a damaged save and rejects inconsistent statistics', async () => {
    const kv = createMemoryKV({ [gameSchema.key]: '{broken' });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await loadRecord(statsSchema, kv)).toEqual(statsSchema.defaultValue());
    expect(statsSchema.validate({ ...statsSchema.defaultValue(), completed: 1 })).toBeNull();
    expect(
      statsSchema.validate({
        ...statsSchema.defaultValue(),
        played: 1,
        completed: 1,
        wins: 1,
        draws: 1,
      }),
    ).toBeNull();
    expect(
      gameSchema.validate({
        schemaVersion: 3,
        savedAt: 0,
        session: createSession(1),
        handOrder: createSession(1).hands[0],
      }),
    ).toBeNull();
  });
  it("keeps the player's arrangement with the game", async () => {
    const kv = createMemoryKV(),
      s = createSession(4),
      order = [...s.hands[0]!].reverse();
    await saveGame(s, kv, order);
    expect(await loadSaved(kv)).toEqual({ session: s, handOrder: order });
    // A stale order is stored as the arrangement the screen shows.
    await saveGame(s, kv, order.slice(1));
    expect((await loadSaved(kv))!.handOrder).toEqual([...order.slice(1), order[0]]);
    // No order is the sorted hand.
    await saveGame(s, kv);
    expect((await loadSaved(kv))!.handOrder).toEqual(sortHand(s.hands[0]!));
  });
  it('resumes a v1 save in the suit order v1 showed, and a damaged order the same way', () => {
    const s = createSession(6),
      sorted = sortHand(s.hands[0]!);
    expect(gameSchema.validate({ schemaVersion: 1, savedAt: 9, session: s })).toEqual({
      schemaVersion: 2,
      savedAt: 9,
      session: s,
      handOrder: sorted,
    });
    for (const handOrder of [undefined, 'x', [...s.hands[0]!].slice(1), [...sorted, sorted[0]]])
      expect(
        gameSchema.validate({ schemaVersion: 2, savedAt: 9, session: s, handOrder })?.handOrder,
      ).toEqual(sorted);
    // The game itself is still checked as strictly as before.
    expect(
      gameSchema.validate({
        schemaVersion: 2,
        savedAt: 9,
        session: { ...s, seed: -1 },
        handOrder: sorted,
      }),
    ).toBeNull();
  });
});
