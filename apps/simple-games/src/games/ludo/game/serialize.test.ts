/**
 * The record itself: what it holds, what it refuses to hold, and the gate it
 * has to get through before anything believes a word of it.
 *
 * session.test.ts covers the seven properties a suspended match is accepted
 * on. What is left here is the format's own shape — the fields, the seed
 * token, the promise that writing a record never disturbs the match it was
 * written from, and the one property this format has that no validator can
 * give you: an automatic pass has no encoding, so a record cannot claim one
 * that did not happen.
 */
import { describe, expect, it } from 'vitest';
import { buildLudoView, chooseCpuMove } from './cpu';
import { rollFor } from './dice';
import { MAX_ROLLS } from './engine';
import { createRng } from './rng';
import {
  canonicalRecordOf,
  isWithinWorkGate,
  restoreSession,
  CHOICES_PATTERN,
  MAX_CHOICES_TEXT,
  SCHEMA_VERSION,
  type PersistedMatch,
} from './serialize';
import {
  applyCpuMove,
  applyCpuRoll,
  createSession,
  cpuBeatOwed,
  doMovePawn,
  doRoll,
  matchSeed,
  movablePawns,
  newSeedToken,
  statusOf,
  type LudoSession,
} from './session';
import { YOU } from './types';

const SAVED_AT = 1_754_640_000_000;

const BEAT_LIMIT = 20_000;

/** The same scripted player session.test.ts uses: the CPU's chooser, on this roll's key. */
function step(session: LudoSession): LudoSession {
  const beat = cpuBeatOwed(session);
  if (beat !== null) {
    return (beat.kind === 'roll' ? applyCpuRoll(session) : applyCpuMove(session))!;
  }
  if (session.state.die === null) return doRoll(session)!;
  const view = buildLudoView(session.state, session.difficulty)!;
  const tieBreak = createRng(`${session.seed}:cpu:${session.state.rollIndex - 1}`)();
  return doMovePawn(session, chooseCpuMove(view, tieBreak)!.pawn)!;
}

/** Plays until `stop` takes the session, or the match ends. */
function playUntil(session: LudoSession, stop: (session: LudoSession) => boolean): LudoSession {
  let played = session;
  for (let taken = 0; taken < BEAT_LIMIT && played.status === 'playing'; taken++) {
    if (stop(played)) return played;
    played = step(played);
  }
  return played;
}

const deepInto = (seed: string, choices: number): LudoSession =>
  playUntil(
    createSession('normal', seed),
    (session) =>
      session.choices.length >= choices && session.state.turn === YOU && session.state.die === null,
  );

describe('what a record is made of', () => {
  const session = deepInto('ludo-shape-of-record', 10);
  const record = canonicalRecordOf(session, SAVED_AT)!;

  it('holds identity, a roll count, the player choices and nothing else', () => {
    // Everything absent from this list is derived: the board, the faces, the
    // CPU seats' moves, whose turn it is, the run of sixes, the passes.
    expect(Object.keys(record).sort()).toEqual([
      'choices',
      'difficulty',
      'elapsedSeconds',
      'rollCount',
      'savedAt',
      'schemaVersion',
      'seed',
    ]);
    expect(record.schemaVersion).toBe(SCHEMA_VERSION);
    expect(record.seed).toBe(session.seed);
    expect(record.difficulty).toBe(session.difficulty);
    expect(record.savedAt).toBe(SAVED_AT);
    expect(CHOICES_PATTERN.test(record.choices)).toBe(true);
  });

  it('writes one digit per move the player made, in the order they made them', () => {
    expect(record.choices).toBe(session.choices.join(''));
    expect(record.choices.length).toBeLessThanOrEqual(record.rollCount);
  });

  it('carries the clock across, and hands it back on restore', () => {
    const timed = canonicalRecordOf({ ...session, elapsedSeconds: 1234 }, SAVED_AT)!;
    expect(timed.elapsedSeconds).toBe(1234);
    expect(restoreSession(timed)!.elapsedSeconds).toBe(1234);
  });

  it('restores a match that is still being played, and says so', () => {
    const restored = restoreSession(record)!;
    expect(restored.status).toBe('playing');
    expect(statusOf(restored.state)).toBe('playing');
    expect(restored.choices.join('')).toBe(record.choices);
    // The die the replay last threw, which is the one lying on the board when
    // the match is picked back up — derived like everything else, not stored.
    expect(restored.lastRoll!.die).toBe(rollFor(record.seed, record.rollCount - 1));
  });
});

describe('writing a record disturbs nothing', () => {
  it('leaves the live session exactly where it was, mid-CPU-lap and all', () => {
    const midLap = playUntil(
      createSession('hard', 'ludo-pure'),
      (session) => cpuBeatOwed(session) !== null && session.state.rollIndex > 6,
    );
    const before = JSON.stringify(midLap.state);
    const first = canonicalRecordOf(midLap, SAVED_AT);
    const second = canonicalRecordOf(midLap, SAVED_AT);

    // The forward walk runs on a copy — sessions are immutable, so "a copy" is
    // just a local name — and the record is the same however many times it is
    // asked for.
    expect(JSON.stringify(midLap.state)).toBe(before);
    expect(first).toEqual(second);
    expect(midLap.state.turn).not.toBe(YOU);
    expect(first!.rollCount).toBeGreaterThan(midLap.state.rollIndex - 1);
  });
});

describe('a pass that did not happen cannot be written down', () => {
  /**
   * The record has one digit per move the player made and no field of any
   * kind for a roll they could not answer. That is what makes "a position
   * where a legal move existed, recorded as a pass" unwritable rather than
   * merely rejected: there is nothing to write it in. What the replay does
   * instead is derive every pass from the rules at the moment it happens —
   * so the count of digits has to come out equal to the count of the player's
   * rolls that actually had a reply, every time, with nothing recorded to
   * make it so.
   */
  it('derives the passes, so the digits count the answered rolls exactly', () => {
    const record = canonicalRecordOf(deepInto('ludo-derived-passes', 14), SAVED_AT)!;

    let session = createSession(record.difficulty, record.seed);
    let answered = 0;
    let passed = 0;
    while (session.state.rollIndex < record.rollCount) {
      const beat = cpuBeatOwed(session);
      if (beat !== null) {
        session = (beat.kind === 'roll' ? applyCpuRoll(session) : applyCpuMove(session))!;
        continue;
      }
      if (session.state.die !== null) {
        session = step(session);
        continue;
      }
      const thrown = doRoll(session)!;
      // A forfeited third six answers nothing either, and is likewise not
      // recorded — it is the rules, not the record, that skip that turn.
      if (thrown.lastRoll!.kind === 'move') answered += 1;
      if (thrown.lastRoll!.kind === 'autoPass') passed += 1;
      session = thrown;
    }
    expect(answered).toBe(record.choices.length);
    // And the fixture is only worth anything if the player really did have
    // rolls they could not answer, which is the case the record has no room
    // to lie about.
    expect(passed).toBeGreaterThan(0);
  });
});

describe('the gate, before the record is believed', () => {
  const good = canonicalRecordOf(deepInto('ludo-gate', 6), SAVED_AT)!;

  it('lets a record the game wrote through', () => {
    expect(isWithinWorkGate(good)).toBe(true);
  });

  it('bounds the work by the rules cap, not by a limit of its own', () => {
    // The cap is §2.9's, and the choices can never outnumber the rolls that
    // called for them, which is what makes the replay's cost knowable from
    // the record's own two numbers.
    expect(MAX_CHOICES_TEXT).toBe(MAX_ROLLS);
    expect(isWithinWorkGate({ ...good, rollCount: MAX_ROLLS - 1 })).toBe(true);
    expect(isWithinWorkGate({ ...good, rollCount: MAX_ROLLS })).toBe(false);
  });

  it('turns away anything malformed before a match is even dealt', () => {
    expect(isWithinWorkGate({ ...good, schemaVersion: 2 as unknown as 1 })).toBe(false);
    expect(isWithinWorkGate({ ...good, seed: '' })).toBe(false);
    expect(isWithinWorkGate({ ...good, seed: 7 as unknown as string })).toBe(false);
    expect(isWithinWorkGate({ ...good, difficulty: 'brutal' as unknown as 'hard' })).toBe(false);
    expect(isWithinWorkGate({ ...good, rollCount: -1 })).toBe(false);
    expect(isWithinWorkGate({ ...good, rollCount: 4.5 })).toBe(false);
    expect(isWithinWorkGate({ ...good, rollCount: Number.NaN })).toBe(false);
    expect(isWithinWorkGate({ ...good, choices: 'x' })).toBe(false);
    expect(isWithinWorkGate({ ...good, choices: '04' })).toBe(false);
    expect(isWithinWorkGate({ ...good, choices: null as unknown as string })).toBe(false);
    expect(isWithinWorkGate({ ...good, choices: '3'.repeat(good.rollCount + 1) })).toBe(false);
    expect(isWithinWorkGate({ ...good, elapsedSeconds: -1 })).toBe(false);
    expect(isWithinWorkGate({ ...good, elapsedSeconds: Number.NaN })).toBe(false);
  });

  it('is the same answer restoring gives', () => {
    expect(restoreSession({ ...good, choices: 'x' })).toBeNull();
    expect(restoreSession({ ...good, rollCount: MAX_ROLLS })).toBeNull();
    expect(restoreSession(good)).not.toBeNull();
  });
});

describe('the opening is a record like any other', () => {
  it('saves and restores a match nobody has thrown for yet', () => {
    const fresh = createSession('easy', 'ludo-fresh');
    const record = canonicalRecordOf(fresh, SAVED_AT)!;
    expect(record.rollCount).toBe(0);
    expect(record.choices).toBe('');

    const restored = restoreSession(record)!;
    expect(restored.state).toEqual(fresh.state);
    expect(movablePawns(restored)).toEqual([]);
    expect(doRoll(restored)!.state.die).toBe(doRoll(fresh)!.state.die);
  });
});

describe('a match seed is its own', () => {
  it('names the game and stays inside base 36', () => {
    const token = newSeedToken(1_700_000_000_000, () => 0.5);
    expect(matchSeed(token)).toBe(`ludo-${token}`);
    expect(matchSeed(token)).toMatch(/^ludo-[0-9a-z]+-[0-9a-z]+$/);
  });

  it('gives two matches started in the same millisecond different dice', () => {
    let next = 0;
    const random = (): number => {
      next += 0.37;
      return next % 1;
    };
    const first = createSession('normal', matchSeed(newSeedToken(1_700_000_000_000, random)));
    const second = createSession('normal', matchSeed(newSeedToken(1_700_000_000_000, random)));
    expect(first.seed).not.toBe(second.seed);
  });
});

describe('records from a match that has been decided', () => {
  it('are not written, and are not read', () => {
    let finished = createSession('easy', 'ludo-finished');
    for (let taken = 0; taken < BEAT_LIMIT && finished.status === 'playing'; taken++) {
      finished = step(finished);
    }
    expect(finished.status).not.toBe('playing');
    expect(canonicalRecordOf(finished, SAVED_AT)).toBeNull();

    const pointingAtIt: PersistedMatch = {
      schemaVersion: 1,
      seed: finished.seed,
      difficulty: finished.difficulty,
      rollCount: finished.state.rollIndex,
      choices: finished.choices.join(''),
      elapsedSeconds: 0,
      savedAt: SAVED_AT,
    };
    expect(restoreSession(pointingAtIt)).toBeNull();
  });
});
