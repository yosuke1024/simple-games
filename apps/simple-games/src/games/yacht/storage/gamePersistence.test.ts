/**
 * What a saved match has to prove before it is handed back (§8). Every
 * rejection below is a record play could not have produced — and the answer
 * to each is the same: discard it, and let the player land on the home
 * screen rather than in an invented match.
 */
import { describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import { loadRecord } from '../../../storage/repo';
import {
  applyCpuStep,
  CATEGORIES,
  createSession,
  roll,
  score,
  statusOf,
  toggleHold,
  toMove,
  type YachtSession,
} from '../game';
import { loadSavedGame, toPersisted } from './gamePersistence';
import { gameSchema, statsSchema, YT_STORAGE_KEYS } from './schemas';

const saved = (record: unknown) =>
  createMemoryKV({ [YT_STORAGE_KEYS.game]: JSON.stringify(record) });

/**
 * Both sheets non-trivial, on the CPU's turn: the player's first two boxes,
 * the CPU's whole first turn played out, and the CPU one throw into its
 * second turn with a die held.
 */
function midGame(): YachtSession {
  let session = roll(createSession('yacht-persist'), 'player')!;
  session = score(session, 'player', 'choice')!;
  while (statusOf(session) === 'playing' && toMove(session) === 'cpu') {
    session = applyCpuStep(session)!;
  }
  session = roll(session, 'player')!;
  session = score(session, 'player', 'ones')!;
  session = roll(session, 'cpu')!;
  return toggleHold(session, 'cpu', 1)!;
}

/** Plays a whole match to its end: the player takes the first open box in
 * `CATEGORIES` order off one throw; the CPU plays itself out. */
function playToFinish(seed: string): YachtSession {
  let session = createSession(seed);
  for (const category of CATEGORIES) {
    session = score(roll(session, 'player')!, 'player', category)!;
    while (statusOf(session) === 'playing' && toMove(session) === 'cpu') {
      session = applyCpuStep(session)!;
    }
  }
  return session;
}

const record = () => toPersisted({ ...midGame(), elapsedSeconds: 42 }, 1);

describe('resuming a saved match (§8)', () => {
  it('gives back exactly the match that was saved, on the CPU’s turn, both sheets intact', async () => {
    const original = { ...midGame(), elapsedSeconds: 42 };
    expect(await loadSavedGame(saved(toPersisted(original, 1)))).toEqual(original);
  });

  it('gives back a sheet saved before its first throw', async () => {
    const fresh = createSession('yacht-persist-fresh');
    expect(await loadSavedGame(saved(toPersisted(fresh, 1)))).toEqual(fresh);
  });

  it('has nothing to resume when nothing was saved', async () => {
    expect(await loadSavedGame(createMemoryKV())).toBeNull();
  });

  it('does not bring back a finished match', async () => {
    const session = playToFinish('yacht-persist-full');
    expect(statusOf(session)).toBe('finished');
    expect(await loadSavedGame(saved(toPersisted(session, 1)))).toBeNull();
  });
});

describe('discarding a record play could not have produced (§8)', () => {
  it('refuses a v1 record outright: a solo sheet is not a match (§8)', async () => {
    expect(await loadSavedGame(saved({ ...record(), schemaVersion: 1 }))).toBeNull();
  });

  it('refuses a record of some other version', async () => {
    expect(await loadSavedGame(saved({ ...record(), schemaVersion: 3 }))).toBeNull();
  });

  it('refuses an empty or missing seed', async () => {
    expect(await loadSavedGame(saved({ ...record(), seed: '' }))).toBeNull();
    const { seed: _dropped, ...withoutSeed } = record();
    expect(await loadSavedGame(saved(withoutSeed))).toBeNull();
  });

  it('refuses dice that are not five faces of 1..6', async () => {
    expect(await loadSavedGame(saved({ ...record(), dice: [1, 2, 3, 4] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), dice: [1, 2, 3, 4, 7] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), dice: [0, 2, 3, 4, 5] }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), dice: [1, 2, 3, 4, 2.5] }))).toBeNull();
  });

  it('refuses holds that are not five flags', async () => {
    expect(
      await loadSavedGame(saved({ ...record(), held: [true, false, false, false] })),
    ).toBeNull();
    expect(
      await loadSavedGame(saved({ ...record(), held: [1, 0, 0, 0, 0] as unknown as boolean[] })),
    ).toBeNull();
  });

  it('refuses a throw count outside a turn', async () => {
    expect(await loadSavedGame(saved({ ...record(), rollsUsed: 4 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), rollsUsed: -1 }))).toBeNull();
  });

  it('refuses holds before the first throw of a turn', async () => {
    // Keeping exists only after a throw (§2).
    expect(await loadSavedGame(saved({ ...record(), rollsUsed: 0, rollIndex: 1 }))).toBeNull();
  });

  it('refuses a sheet that is not twelve boxes, on either side', async () => {
    expect(
      await loadSavedGame(saved({ ...record(), scores: record().scores.slice(1) })),
    ).toBeNull();
    expect(
      await loadSavedGame(saved({ ...record(), cpuScores: record().cpuScores.slice(1) })),
    ).toBeNull();
  });

  it('refuses a box holding points no throw could score there, on either sheet', async () => {
    const scores = [...record().scores];
    scores[CATEGORIES.indexOf('sixes')] = 7;
    expect(await loadSavedGame(saved({ ...record(), scores }))).toBeNull();
    scores[CATEGORIES.indexOf('sixes')] = null;
    scores[CATEGORIES.indexOf('yacht')] = 49;
    expect(await loadSavedGame(saved({ ...record(), scores }))).toBeNull();

    const cpuScores = [...record().cpuScores];
    cpuScores[CATEGORIES.indexOf('fours')] = 13;
    expect(await loadSavedGame(saved({ ...record(), cpuScores }))).toBeNull();
  });

  it('refuses a throw count the sheets cannot explain', async () => {
    // Three boxes filled between the two sheets and one throw this turn: four
    // to ten throws in all. The throw count is half of every draw still to
    // come (§4), so a record where it disagrees would resume onto dice this
    // match was never going to get.
    expect(await loadSavedGame(saved({ ...record(), rollIndex: 3 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), rollIndex: 11 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), rollIndex: 4 }))).not.toBeNull();
    expect(await loadSavedGame(saved({ ...record(), rollIndex: 10 }))).not.toBeNull();
  });

  it('refuses the CPU’s sheet fuller than the player’s, or the player’s fuller by two (§1)', async () => {
    const base = record();
    // The CPU fuller than the player: not reachable — the player always
    // throws first (§1). `base` has the CPU one box behind the player;
    // filling two more of its open boxes puts it ahead instead.
    const cpuScores = [...base.cpuScores];
    const open = cpuScores.reduce<number[]>(
      (indices, points, index) => (points === null ? [...indices, index] : indices),
      [],
    );
    cpuScores[open[0]!] = 0;
    cpuScores[open[1]!] = 0;
    expect(await loadSavedGame(saved({ ...base, cpuScores }))).toBeNull();

    // The player two boxes ahead of the CPU: also not reachable (§1).
    expect(
      await loadSavedGame(saved({ ...base, cpuScores: base.cpuScores.map(() => null) })),
    ).toBeNull();
  });

  it('refuses a negative or fractional elapsed time', async () => {
    expect(await loadSavedGame(saved({ ...record(), elapsedSeconds: -1 }))).toBeNull();
    expect(await loadSavedGame(saved({ ...record(), elapsedSeconds: 1.5 }))).toBeNull();
  });

  it('refuses text that is not a record at all', async () => {
    const kv = createMemoryKV({ [YT_STORAGE_KEYS.game]: '{not json' });
    expect(await loadSavedGame(kv)).toBeNull();
    expect(await loadRecord(gameSchema, saved([1, 2, 3]))).toBeNull();
  });
});

describe('statistics record (§7)', () => {
  const stats = (value: unknown) =>
    loadRecord(statsSchema, createMemoryKV({ [YT_STORAGE_KEYS.stats]: JSON.stringify(value) }));

  const v1 = {
    schemaVersion: 1,
    played: 4,
    completed: 3,
    bestScore: 211,
    totalScore: 540,
    totalPlaySeconds: 1800,
  };

  it('migrates a v1 record to v2 with no result yet, keeping its best and its average', async () => {
    expect(await stats(v1)).toEqual({ ...v1, schemaVersion: 2, wins: 0, losses: 0, draws: 0 });
  });

  const v2 = {
    schemaVersion: 2,
    played: 5,
    completed: 4,
    bestScore: 220,
    totalScore: 700,
    totalPlaySeconds: 2000,
    wins: 2,
    losses: 1,
    draws: 1,
  };

  it('keeps a valid v2 record, with or without a best score', async () => {
    expect(await stats(v2)).toEqual(v2);
    expect(
      await stats({
        ...v2,
        completed: 0,
        bestScore: null,
        totalScore: 0,
        wins: 0,
        losses: 0,
        draws: 0,
      }),
    ).toEqual({
      ...v2,
      completed: 0,
      bestScore: null,
      totalScore: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    });
  });

  it('falls back to an empty record rather than keep a best no sheet can reach', async () => {
    expect(await stats({ ...v2, bestScore: 298 })).toEqual(statsSchema.defaultValue());
    expect(await stats({ ...v2, bestScore: '211' })).toEqual(statsSchema.defaultValue());
  });

  it('falls back to an empty record rather than keep a result count that cannot be trusted', async () => {
    expect(await stats({ ...v2, wins: -1 })).toEqual(statsSchema.defaultValue());
    expect(await stats({ ...v2, losses: '1' })).toEqual(statsSchema.defaultValue());
    expect(await stats({ ...v2, draws: 1.5 })).toEqual(statsSchema.defaultValue());
  });
});
