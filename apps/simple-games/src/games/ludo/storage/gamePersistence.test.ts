/**
 * The one saved-match slot: what gets written, what is refused on the way back
 * in, and the two rules that only this layer can get wrong — a decided match
 * empties the slot instead of filling it, and a record that could not have
 * come from play is dropped rather than repaired.
 *
 * The records here are produced by *playing*, never hand-written, for the same
 * reason the game's own tests do it: a Ludo record is only valid if the whole
 * match replays from it (game/serialize.ts), so a crafted one would prove
 * something about a match nobody could have played.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { createMemoryKV } from '../../../storage/kv';
import {
  applyCpuMove,
  applyCpuRoll,
  canonicalRecordOf,
  cpuBeatOwed,
  createSession,
  doMovePawn,
  doRoll,
  movablePawns,
  restoreSession,
  MAX_ROLLS,
  YOU,
  type LudoSession,
  type PersistedMatch,
} from '../game';
import { clearSavedGame, loadSavedGame, saveGame } from './gamePersistence';
import { gameSchema, LD_STORAGE_KEYS, statsSchema } from './schemas';

/** Drives a match forward one beat by whoever is due one, player included. */
function step(session: LudoSession): LudoSession {
  const beat = cpuBeatOwed(session);
  if (beat !== null) {
    return (beat.kind === 'roll' ? applyCpuRoll(session) : applyCpuMove(session))!;
  }
  if (session.state.die === null) return doRoll(session)!;
  // The player always takes the lowest-numbered pawn the rules allow, which
  // makes these matches deterministic without pretending to be clever.
  return doMovePawn(session, movablePawns(session)[0]!)!;
}

function played(seed: string, beats: number): LudoSession {
  let session = createSession('normal', seed);
  for (let beat = 0; beat < beats && session.status === 'playing'; beat++) session = step(session);
  return session;
}

/**
 * Plays until the match is where a case needs it. Positions are reached by
 * playing rather than written down, so every one of them is a position the
 * rules could actually have produced.
 */
function playUntil(seed: string, reached: (session: LudoSession) => boolean): LudoSession {
  let session = createSession('normal', seed);
  for (let beat = 0; beat < 20_000 && !reached(session) && session.status === 'playing'; beat++) {
    session = step(session);
  }
  if (!reached(session)) throw new Error(`never reached the position asked for (${seed})`);
  return session;
}

/** A match the player has made at least `n` moves in. */
const afterChoices = (seed: string, n: number): LudoSession =>
  playUntil(seed, (session) => session.choices.length >= n);

let kv = createMemoryKV();
beforeEach(() => {
  kv = createMemoryKV();
});

describe('saving', () => {
  it('writes the canonical record and reads back the same board', async () => {
    const session = played('ludo-save-round', 40);
    expect(session.status).toBe('playing');
    await saveGame(session, kv);

    const back = await loadSavedGame(kv);
    expect(back).not.toBeNull();
    // The record carries a seed, a strength, a roll count and the player's
    // choices — and the board comes back from replaying those.
    expect(back!.seed).toBe(session.seed);
    expect(back!.difficulty).toBe(session.difficulty);
    expect(back!.choices).toEqual(session.choices);
  });

  it('always comes back on the player’s throw, whatever it was saved on', async () => {
    // Saved mid-CPU-lap, saved mid-choice, saved on the player's throw: the
    // record cannot express any of those but the last (§10.2), so all three
    // resume into the same kind of position.
    for (const beats of [7, 8, 9, 10, 11, 12]) {
      const store = createMemoryKV();
      const session = played('ludo-save-canon', beats);
      if (session.status !== 'playing') continue;
      await saveGame(session, store);
      const back = await loadSavedGame(store);
      expect(back, `saved after ${beats} beats`).not.toBeNull();
      expect(back!.state.turn).toBe(YOU);
      expect(back!.state.die).toBeNull();
    }
  });

  it('empties the slot for a match that has already been decided', async () => {
    const session = played('ludo-save-decided', 20_000);
    expect(session.status).not.toBe('playing');

    await saveGame(played('ludo-save-decided', 20), kv);
    expect(await kv.get(LD_STORAGE_KEYS.game)).not.toBeNull();

    // A finished match is not a match to come back to: writing it clears the
    // slot rather than leaving the previous record there to be resumed into.
    await saveGame(session, kv);
    expect(await kv.get(LD_STORAGE_KEYS.game)).toBeNull();
    expect(await loadSavedGame(kv)).toBeNull();
  });

  it('clears on request', async () => {
    await saveGame(played('ludo-save-clear', 12), kv);
    await clearSavedGame(kv);
    expect(await loadSavedGame(kv)).toBeNull();
  });
});

describe('the schema’s gate', () => {
  const record = () => canonicalRecordOf(afterChoices('ludo-gate', 4), 1)!;

  it('accepts a record that came from play', () => {
    expect(gameSchema.validate(record())).not.toBeNull();
  });

  it('refuses a roll count past the rules’ own cap', () => {
    // The gate is the work bound: restoring costs one step per roll, so a
    // record claiming more rolls than a match may have is turned away before
    // any of them is walked (§10.4).
    expect(gameSchema.validate({ ...record(), rollCount: MAX_ROLLS })).toBeNull();
    expect(gameSchema.validate({ ...record(), rollCount: 5_000_000 })).toBeNull();
    expect(gameSchema.validate({ ...record(), rollCount: -1 })).toBeNull();
  });

  it('refuses choices that are not pawn numbers, or more of them than rolls', () => {
    expect(gameSchema.validate({ ...record(), choices: '01x3' })).toBeNull();
    expect(gameSchema.validate({ ...record(), choices: '4' })).toBeNull();
    expect(gameSchema.validate({ ...record(), choices: '0'.repeat(MAX_ROLLS + 1) })).toBeNull();
    expect(gameSchema.validate({ ...record(), rollCount: 1, choices: '000' })).toBeNull();
  });

  it('refuses a record of the wrong shape outright', () => {
    expect(gameSchema.validate(null)).toBeNull();
    expect(gameSchema.validate({ ...record(), schemaVersion: 2 })).toBeNull();
    expect(gameSchema.validate({ ...record(), seed: '' })).toBeNull();
    expect(gameSchema.validate({ ...record(), difficulty: 'brutal' })).toBeNull();
    expect(gameSchema.validate({ ...record(), elapsedSeconds: -3 })).toBeNull();
  });
});

describe('restoring, fail-closed', () => {
  it('drops a record whose choices were never legal moves', async () => {
    const source = canonicalRecordOf(afterChoices('ludo-fail-choice', 6), 1)!;
    expect(source.choices.length).toBeGreaterThan(0);

    // One digit of the choice list changed to a pawn the rules did not allow
    // at that moment. Which digit that is depends on the position, so it is
    // searched for rather than guessed — the point of the case is what the
    // storage layer does with such a record, not which one it is.
    let bent: PersistedMatch | null = null;
    for (let at = 0; at < source.choices.length && bent === null; at++) {
      for (const digit of ['0', '1', '2', '3']) {
        if (digit === source.choices[at]) continue;
        const candidate: PersistedMatch = {
          ...source,
          choices: source.choices.slice(0, at) + digit + source.choices.slice(at + 1),
        };
        if (restoreSession(candidate) === null) {
          bent = candidate;
          break;
        }
      }
    }
    expect(bent).not.toBeNull();

    // The shape gate lets it through — it is a record's shape, after all —
    // and the replay is what turns it down. Nothing is repaired (§10.3).
    expect(gameSchema.validate(bent)).not.toBeNull();
    const store = createMemoryKV({ [LD_STORAGE_KEYS.game]: JSON.stringify(bent) });
    expect(await loadSavedGame(store)).toBeNull();
  });

  it('drops a record that stops somewhere the player is not about to throw', async () => {
    const source = canonicalRecordOf(afterChoices('ludo-fail-stop', 4), 1)!;
    const store = createMemoryKV({
      [LD_STORAGE_KEYS.game]: JSON.stringify({ ...source, rollCount: source.rollCount + 1 }),
    });
    expect(await loadSavedGame(store)).toBeNull();
  });

  it('drops unparseable and half-written records', async () => {
    expect(await loadSavedGame(createMemoryKV({ [LD_STORAGE_KEYS.game]: 'not json' }))).toBeNull();
    expect(await loadSavedGame(createMemoryKV({ [LD_STORAGE_KEYS.game]: '{}' }))).toBeNull();
  });
});

describe('the other three records', () => {
  it('keeps statistics with no draws column, and defaults when corrupt', () => {
    expect(statsSchema.defaultValue().normal).toEqual({ played: 0, wins: 0, losses: 0 });
    expect(statsSchema.validate({ schemaVersion: 1 })).toBeNull();
    expect(
      statsSchema.validate({
        schemaVersion: 1,
        totalPlaySeconds: 5,
        easy: { played: 1, wins: 1, losses: 0 },
        normal: { played: 0, wins: 0, losses: 0 },
        hard: { played: 0, wins: 0, losses: 0 },
      }),
    ).not.toBeNull();
  });

  it('uses the ld. prefix and no daily slot', () => {
    // `dailyGame` is the name src/test/savedGameSlots.test.ts scans for; Ludo
    // has one slot and must not answer that scan.
    expect(Object.values(LD_STORAGE_KEYS).every((key) => key.startsWith('ld.'))).toBe(true);
    expect(Object.keys(LD_STORAGE_KEYS)).not.toContain('dailyGame');
  });
});
