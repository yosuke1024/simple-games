import { describe, expect, it } from 'vitest';
import { validSwaps } from './board';
import { createRound, gemSwapSeed, trySwap, type Round } from './round';
import {
  createSession,
  MAX_ELAPSED_SECONDS,
  restoreSession,
  toSessionRecord,
  type GemSwapSession,
} from './session';

/** A round a few swaps in, always taking the first valid swap. */
function playedRound(seed: string, swaps: number): Round {
  let round = createRound(gemSwapSeed(seed), 6);
  for (let i = 0; i < swaps && round.status === 'playing'; i++) {
    const [a, b] = validSwaps(round.board)[0]!;
    round = trySwap(round, a, b)!.round;
  }
  return round;
}

describe('the suspended session (§7)', () => {
  it('starts at zero seconds', () => {
    const round = createRound('s', 5);
    expect(createSession(round)).toEqual({ round, elapsedSeconds: 0 });
  });

  it('round-trips through JSON: the same round, the same seconds', () => {
    const session: GemSwapSession = { round: playedRound('trip', 7), elapsedSeconds: 93 };
    const record = toSessionRecord(session)!;
    const back = restoreSession(JSON.parse(JSON.stringify(record)));
    expect(back).not.toBeNull();
    expect(back!.elapsedSeconds).toBe(93);
    expect(JSON.stringify(back!.round)).toBe(JSON.stringify(session.round));
  });

  it('writes nothing for a finished round', () => {
    const over = playedRound('over', 30);
    expect(over.status).toBe('over');
    expect(toSessionRecord({ round: over, elapsedSeconds: 5 })).toBeNull();
  });

  it.each([
    ['missing', undefined],
    ['negative', -1],
    ['fractional', 1.5],
    ['a string', '12'],
    ['past the bound', MAX_ELAPSED_SECONDS + 1],
  ])('rejects seconds that are %s', (_, elapsedSeconds) => {
    const record = toSessionRecord({ round: playedRound('bad', 2), elapsedSeconds: 0 })!;
    expect(restoreSession({ ...record, elapsedSeconds })).toBeNull();
  });

  it('rejects what the round replay rejects, and non-objects', () => {
    const record = toSessionRecord({ round: playedRound('rej', 2), elapsedSeconds: 0 })!;
    expect(restoreSession(null)).toBeNull();
    expect(restoreSession('x')).toBeNull();
    expect(restoreSession({ ...record, colors: 7 })).toBeNull();
    expect(restoreSession({ ...record, swaps: [[0, 9]] })).toBeNull();
  });
});
