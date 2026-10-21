/**
 * The records' schemas (docs/SCOPA_RULES.md §9.2, §9.4). The saved match is
 * checked in full inside `gameSchema.validate` — the replay of
 * game/serialize.ts, which game/serialize.test.ts exercises refusal by refusal
 * — so these tests pin that the schema really runs it, that it never throws,
 * and that the record it hands back is rebuilt from the checked fields. A
 * backup is restored through the same `validate` (docs/architecture/backup.md),
 * so a record refused here cannot come back that way either.
 */
import { describe, expect, it } from 'vitest';
import {
  applyBeat,
  beatOwed,
  createSession,
  doPlay,
  legalMoves,
  toSavedMatch,
  type ScopaSession,
} from '../game';
import { flagsSchema, gameSchema, SC_STORAGE_KEYS, statsSchema } from './schemas';

/** A match a few cards in, reached by play: the CPU's beats and the first legal card. */
function fewCardsIn(seed = 'scopa-schema'): ScopaSession {
  let session = createSession(seed);
  for (let plays = 0; plays < 5;) {
    const beat = beatOwed(session);
    if (beat !== null) {
      session = applyBeat(session, beat)!.session;
      if (beat === 'cpu') plays += 1;
      continue;
    }
    session = doPlay(session, legalMoves(session.deal)[0]!)!.session;
    plays += 1;
  }
  return session;
}

const record = () => toSavedMatch(fewCardsIn(), 1_700_000_000_000);

describe('the keys', () => {
  it('are the three of §9 — no prefs', () => {
    expect(Object.values(SC_STORAGE_KEYS).sort()).toEqual(['sc.flags', 'sc.saveGame', 'sc.stats']);
    expect(gameSchema.key).toBe('sc.saveGame');
    expect(statsSchema.key).toBe('sc.stats');
    expect(flagsSchema.key).toBe('sc.flags');
  });
});

describe('sc.saveGame', () => {
  it('accepts a match reached by play, as the record it was', () => {
    const saved = record();
    expect(gameSchema.validate(JSON.parse(JSON.stringify(saved)))).toEqual(saved);
  });

  it('hands back only the fields it checked', () => {
    const extra = { ...record(), injected: 'x' };
    expect(gameSchema.validate(extra)).not.toHaveProperty('injected');
  });

  it('defaults to no match at all', () => {
    expect(gameSchema.defaultValue()).toBeNull();
  });

  it('refuses whatever is not a record, without throwing', () => {
    for (const raw of [null, undefined, 0, 'sc', [], {}, [record()], true]) {
      expect(gameSchema.validate(raw)).toBeNull();
    }
  });

  it('refuses a field of the wrong type or out of range', () => {
    const good = record();
    const bad: Record<string, unknown>[] = [
      { ...good, schemaVersion: 2 },
      { ...good, seed: '' },
      { ...good, seed: 'x'.repeat(65) },
      { ...good, dealNumber: 0 },
      { ...good, dealNumber: 1.5 },
      { ...good, scores: [0] },
      { ...good, scores: ['0', 0] },
      { ...good, elapsedSeconds: -1 },
      { ...good, elapsedSeconds: 1e7 + 1 },
      { ...good, savedAt: -1 },
      { ...good, savedAt: 1e15 + 1 },
      { ...good, deal: 42 },
    ];
    for (const raw of bad) expect(gameSchema.validate(raw), JSON.stringify(raw)).toBeNull();
  });

  it('runs the replay: a history the rules refuse, or a count it contradicts, is not a save', () => {
    const good = record();
    // The first card played, written as a card nobody held.
    const [version, rounds, plays] = good.deal.split('/');
    const tampered = [version, rounds, plays!.replace(/^../, 'zz')].join('/');
    expect(gameSchema.validate({ ...good, deal: tampered })).toBeNull();
    expect(gameSchema.validate({ ...good, moveCount: good.moveCount + 1 })).toBeNull();
    expect(gameSchema.validate({ ...good, dealer: 1 - good.dealer })).toBeNull();
    // A decided score is a finished match, and a finished match is never saved.
    expect(gameSchema.validate({ ...good, scores: [11, 3] })).toBeNull();
  });
});

describe('sc.stats', () => {
  const good = { schemaVersion: 1, played: 4, wins: 2, losses: 1, totalPlaySeconds: 900 };

  it('accepts the four numbers', () => {
    expect(statsSchema.validate(good)).toEqual(good);
  });

  it('does not reconcile the fields with each other', () => {
    // A match resumed after the statistics were reset can end with more wins
    // than matches played (§9.4); it is shown as it is.
    const odd = { ...good, played: 0, wins: 3 };
    expect(statsSchema.validate(odd)).toEqual(odd);
  });

  it('drops the whole record when any one field is wrong, never rescuing the rest', () => {
    for (const raw of [
      { ...good, played: -1 },
      { ...good, wins: 1e9 + 1 },
      { ...good, losses: 0.5 },
      { ...good, totalPlaySeconds: 1e12 + 1 },
      { ...good, totalPlaySeconds: '9' },
      { ...good, schemaVersion: 2 },
      { schemaVersion: 1, played: 3 },
    ]) {
      expect(statsSchema.validate(raw), JSON.stringify(raw)).toBeNull();
    }
    expect(statsSchema.defaultValue()).toEqual({
      schemaVersion: 1,
      played: 0,
      wins: 0,
      losses: 0,
      totalPlaySeconds: 0,
    });
  });
});

describe('sc.flags', () => {
  it('holds whether Quick Rules have been seen, and nothing else', () => {
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: true })).toEqual({
      schemaVersion: 1,
      tutorialCompleted: true,
    });
    expect(flagsSchema.validate({ schemaVersion: 1, tutorialCompleted: 'yes' })).toBeNull();
    expect(flagsSchema.defaultValue().tutorialCompleted).toBe(false);
  });
});
