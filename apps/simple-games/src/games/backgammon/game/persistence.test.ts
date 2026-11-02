import { describe, expect, it } from 'vitest';
import {
  canonicalRecordOf,
  decodeTurn,
  encodeTurn,
  isWithinWorkGate,
  restoreSession,
  SCHEMA_VERSION,
  type PersistedMatch,
} from './persistence';
import {
  applyCpuRoll,
  applyPlayerStep,
  createSession,
  currentAllowedSteps,
  doOpening,
  doRoll,
  MAX_ROLLS,
  type BackgammonSession,
} from './session';
import { playFirstSteps, playRound, settleCpu } from './selfPlay';
import { CPU, PLAYER } from './types';

const sameMatch = (a: BackgammonSession, b: BackgammonSession) => {
  expect(b.board).toEqual(a.board);
  expect(b.rollIndex).toBe(a.rollIndex);
  expect(b.turns).toEqual(a.turns);
  expect(b.phase).toEqual(a.phase);
  expect(b.opening).toEqual(a.opening);
  expect(b.status).toBe(a.status);
};

/** A match a few rounds in, resting at the player's throw. */
function midMatch(seed = 'backgammon-persist'): BackgammonSession {
  let session = createSession('normal', seed);
  for (let round = 0; round < 4; round++) session = playRound(session);
  expect(session.phase).toEqual({ kind: 'awaitingRoll', side: PLAYER });
  return session;
}

describe('the record (§9.1)', () => {
  it('encodes a turn as flat from/die pairs and decodes it back', () => {
    const turn = [
      { from: 24, die: 6 },
      { from: 18, die: 5 },
    ];
    expect(encodeTurn(turn)).toEqual([24, 6, 18, 5]);
    expect(decodeTurn([24, 6, 18, 5])).toEqual(turn);
    expect(decodeTurn([24])).toBeNull();
    expect(decodeTurn([26, 1])).toBeNull();
    expect(decodeTurn([1, 7])).toBeNull();
    expect(decodeTurn([1, 1, 1, 1, 1, 1, 1, 1, 1, 1])).toBeNull();
  });

  it('is the opening before anything was thrown', () => {
    const record = canonicalRecordOf(createSession('easy', 'fresh'), 1)!;
    expect(record).toEqual({
      schemaVersion: SCHEMA_VERSION,
      seed: 'fresh',
      difficulty: 'easy',
      rollCount: 0,
      turns: [],
      elapsedSeconds: 0,
      savedAt: 1,
    });
    sameMatch(createSession('easy', 'fresh'), restoreSession(record)!);
  });
});

describe('canonicalization (§9.2)', () => {
  it('round-trips a match resting at the player’s throw', () => {
    const session = { ...midMatch(), elapsedSeconds: 321 };
    const record = canonicalRecordOf(session, 5)!;
    expect(record.rollCount).toBe(session.rollIndex);
    expect(record.turns).toHaveLength(session.turns.length);
    const restored = restoreSession(record)!;
    sameMatch(session, restored);
    expect(restored.elapsedSeconds).toBe(321);
  });

  it('unmakes the player’s throw when saved mid-turn, and the dice come back the same', () => {
    const resting = midMatch();
    const rolled = doRoll(resting)!;
    const step = currentAllowedSteps(rolled)[0]!;
    const midTurn = applyPlayerStep(rolled, step)!;
    const record = canonicalRecordOf(midTurn, 7)!;
    expect(record.rollCount).toBe(resting.rollIndex);
    const restored = restoreSession(record)!;
    sameMatch(resting, restored);
    const again = doRoll(restored)!;
    expect(again.phase).toEqual(rolled.phase);
  });

  it('points at the opening when the player won it and is still on the first turn', () => {
    let seed = '';
    for (let n = 0; n < 500 && seed === ''; n++) {
      const opened = doOpening(createSession('easy', `first-${n}`))!;
      if (opened.opening?.winner === PLAYER && opened.phase.kind === 'moving') seed = `first-${n}`;
    }
    expect(seed).not.toBe('');
    const opened = doOpening(createSession('easy', seed))!;
    const step = currentAllowedSteps(opened)[0]!;
    const midTurn = applyPlayerStep(opened, step)!;
    const record = canonicalRecordOf(midTurn, 1)!;
    expect(record.rollCount).toBe(0);
    expect(record.turns).toEqual([]);
    const restored = restoreSession(record)!;
    expect(restored.phase.kind).toBe('opening');
    sameMatch(opened, doOpening(restored)!);
  });

  it('winds forward through the CPU’s turn to the player’s next throw', () => {
    const resting = midMatch('backgammon-persist-2');
    const played = playFirstSteps(doRoll(resting)!);
    expect(played.phase).toEqual({ kind: 'awaitingRoll', side: CPU });
    const rolledCpu = applyCpuRoll(played)!;
    for (const snapshot of [played, rolledCpu]) {
      const record = canonicalRecordOf(snapshot, 9)!;
      const settled = settleCpu(snapshot);
      expect(record.rollCount).toBe(settled.rollIndex);
      sameMatch(settled, restoreSession(record)!);
    }
  });

  it('refuses to save a decided match', () => {
    let session = createSession('normal', 'backgammon-decided');
    let guard = 0;
    while (session.status === 'playing' && guard++ < 5000) session = playRound(session);
    expect(canonicalRecordOf(session, 1)).toBeNull();
  });
});

describe('the work gate and the replay fail closed (§9.3)', () => {
  const good = (): PersistedMatch => canonicalRecordOf(midMatch(), 1)!;

  it('accepts its own records', () => {
    expect(isWithinWorkGate(good())).toBe(true);
  });

  it('turns away records it cannot afford to replay, before replaying anything', () => {
    expect(isWithinWorkGate({ ...good(), schemaVersion: 2 as 1 })).toBe(false);
    expect(isWithinWorkGate({ ...good(), rollCount: MAX_ROLLS })).toBe(false);
    expect(isWithinWorkGate({ ...good(), rollCount: -1 })).toBe(false);
    expect(isWithinWorkGate({ ...good(), seed: '' })).toBe(false);
    expect(isWithinWorkGate({ ...good(), difficulty: 'brutal' as 'easy' })).toBe(false);
    expect(isWithinWorkGate({ ...good(), turns: [[24, 6]], rollCount: 0 })).toBe(false);
    expect(isWithinWorkGate({ ...good(), turns: [[24, 6, 1]] })).toBe(false);
    expect(isWithinWorkGate({ ...good(), elapsedSeconds: -1 })).toBe(false);
  });

  it('rejects a step that was not allowed when it was played', () => {
    const record = good();
    const firstTurn = [...record.turns[0]!];
    firstTurn[1] = firstTurn[1] === 6 ? 5 : 6; // a different die than was thrown
    expect(restoreSession({ ...record, turns: [firstTurn, ...record.turns.slice(1)] })).toBeNull();
  });

  it('rejects a record that stops with the CPU to move, or with turns left over or missing', () => {
    const record = good();
    expect(restoreSession({ ...record, rollCount: record.rollCount - 1 })).toBeNull();
    expect(restoreSession({ ...record, turns: record.turns.slice(0, -1) })).toBeNull();
    expect(restoreSession({ ...record, turns: [...record.turns, [13, 1]] })).toBeNull();
  });

  it('golden: a literal v1 record restores (§9.4)', () => {
    const record = canonicalRecordOf(midMatch('backgammon-literal'), 1700000000000)!;
    expect(record).toMatchInlineSnapshot(`
      {
        "difficulty": "normal",
        "elapsedSeconds": 0,
        "rollCount": 8,
        "savedAt": 1700000000000,
        "schemaVersion": 1,
        "seed": "backgammon-literal",
        "turns": [
          [
            6,
            4,
            8,
            6,
          ],
          [
            24,
            4,
            20,
            5,
          ],
          [
            6,
            1,
            5,
            4,
          ],
          [
            25,
            4,
            15,
            2,
          ],
          [
            13,
            5,
            2,
            1,
          ],
          [
            13,
            4,
            13,
            4,
            13,
            4,
            13,
            4,
          ],
          [
            8,
            6,
            6,
            5,
          ],
        ],
      }
    `);
    const restored = restoreSession(record)!;
    expect(restored.phase).toEqual({ kind: 'awaitingRoll', side: PLAYER });
    expect(restored.rollIndex).toBe(record.rollCount);
  });
});
