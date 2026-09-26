/**
 * One game, driven through the session functions the screen calls
 * (docs/HIT_AND_BLOW_RULES.md §3, §5): composing a row, the refusals, the
 * check, and the win.
 */
import { describe, expect, it } from 'vitest';
import {
  clearDraftSlot,
  createSession,
  gameSeed,
  guessCount,
  isDraftFull,
  newSeedToken,
  popSymbol,
  pushSymbol,
  restoreSession,
  setDraftSlot,
  submitGuess,
  type HitAndBlowSession,
} from './session';

const SEED = 'hit-and-blow-session-test';

/** Fills the row with `symbols`, left to right, through pushSymbol. */
function compose(session: HitAndBlowSession, symbols: readonly number[]): HitAndBlowSession {
  return symbols.reduce((current, symbol) => pushSymbol(current, symbol)!, session);
}

/** Any valid guess that is not the secret. */
function wrongGuess(session: HitAndBlowSession): number[] {
  const guess = [...session.secret].reverse();
  return guess.join() === session.secret.join() ? guess.slice(1).concat(guess[0]!) : guess;
}

describe('a new game', () => {
  it('starts empty, playing, with a secret dealt from its seed', () => {
    const session = createSession('hard', SEED);
    expect(session.guesses).toEqual([]);
    expect(session.draft).toEqual([null, null, null, null, null]);
    expect(session.status).toBe('playing');
    expect(session.secret).toHaveLength(5);
    expect(guessCount(session)).toBe(0);
  });

  it('seeds by difficulty and a token of its own', () => {
    expect(gameSeed('easy', 'abc')).toBe('hit-and-blow-easy-abc');
    expect(newSeedToken(0, () => 0)).toBe('0-0');
    expect(createSession('normal').seed).toMatch(/^hit-and-blow-normal-/);
  });
});

describe('composing a row (§3)', () => {
  it('fills the first empty slot, and a cleared slot is filled next', () => {
    let session = compose(createSession('easy', SEED), [3, 1, 4]);
    expect(session.draft).toEqual([3, 1, 4, null]);
    session = clearDraftSlot(session, 1)!;
    expect(session.draft).toEqual([3, null, 4, null]);
    session = pushSymbol(session, 5)!;
    expect(session.draft).toEqual([3, 5, 4, null]);
  });

  it('refuses a symbol already in the row', () => {
    const session = compose(createSession('easy', SEED), [2]);
    expect(pushSymbol(session, 2)).toBeNull();
    expect(setDraftSlot(session, 3, 2)).toBeNull();
  });

  it('refuses a symbol outside the pool, and a full row', () => {
    const easy = createSession('easy', SEED);
    expect(pushSymbol(easy, 6)).toBeNull();
    expect(pushSymbol(easy, -1)).toBeNull();
    const full = compose(easy, [0, 1, 2, 3]);
    expect(isDraftFull(full.draft)).toBe(true);
    expect(pushSymbol(full, 4)).toBeNull();
  });

  it('puts a symbol in a chosen slot, and refuses a slot that does not exist', () => {
    const session = createSession('normal', SEED);
    expect(setDraftSlot(session, 2, 7)!.draft).toEqual([null, null, 7, null]);
    expect(setDraftSlot(session, 4, 7)).toBeNull();
  });

  it('takes the last filled symbol off with pop, and nothing from an empty row', () => {
    let session = compose(createSession('normal', SEED), [0, 1, 2]);
    session = clearDraftSlot(session, 0)!;
    session = popSymbol(session)!;
    expect(session.draft).toEqual([null, 1, null, null]);
    session = popSymbol(session)!;
    expect(session.draft).toEqual([null, null, null, null]);
    expect(popSymbol(session)).toBeNull();
    expect(clearDraftSlot(session, 0)).toBeNull();
  });
});

describe('checking a guess (§3, §5)', () => {
  it('needs a full row', () => {
    const session = compose(createSession('easy', SEED), [0, 1, 2]);
    expect(submitGuess(session)).toBeNull();
  });

  it('adds the guess to the history, empties the row, and counts it', () => {
    const start = createSession('normal', SEED);
    const guess = wrongGuess(start);
    const next = submitGuess(compose(start, guess))!;
    expect(next.guesses).toEqual([guess]);
    expect(next.draft).toEqual([null, null, null, null]);
    expect(next.status).toBe('playing');
    expect(guessCount(next)).toBe(1);
  });

  it('does not refuse the same guess twice — it is counted again', () => {
    const start = createSession('easy', SEED);
    const guess = wrongGuess(start);
    const once = submitGuess(compose(start, guess))!;
    const twice = submitGuess(compose(once, guess))!;
    expect(guessCount(twice)).toBe(2);
  });

  it('wins on the secret, and nothing moves after that', () => {
    const start = createSession('hard', SEED);
    const missed = submitGuess(compose(start, wrongGuess(start)))!;
    const won = submitGuess(compose(missed, start.secret))!;
    expect(won.status).toBe('won');
    expect(guessCount(won)).toBe(2);
    // A finished game takes no more input (§5).
    expect(pushSymbol(won, start.secret[0]!)).toBeNull();
    expect(submitGuess(won)).toBeNull();
  });
});

describe('restoring (§8)', () => {
  it('deals the same secret again and gives back the history', () => {
    const start = createSession('normal', SEED);
    const played = submitGuess(compose(start, wrongGuess(start)))!;
    const restored = restoreSession({
      seed: played.seed,
      difficulty: played.difficulty,
      guesses: played.guesses,
      elapsedSeconds: 42,
    })!;
    expect(restored.secret).toEqual(start.secret);
    expect(restored.guesses).toEqual(played.guesses);
    expect(restored.draft).toEqual([null, null, null, null]);
    expect(restored.status).toBe('playing');
    expect(restored.elapsedSeconds).toBe(42);
  });

  it('refuses a history that play could not have produced', () => {
    const base = { seed: SEED, difficulty: 'easy' as const, elapsedSeconds: 0 };
    expect(restoreSession({ ...base, guesses: [[0, 1, 2]] })).toBeNull();
    expect(restoreSession({ ...base, guesses: [[0, 1, 2, 7]] })).toBeNull();
    expect(restoreSession({ ...base, guesses: [[0, 1, 1, 2]] })).toBeNull();
  });

  it('reads a history ending on the secret as won', () => {
    const start = createSession('easy', SEED);
    const restored = restoreSession({
      seed: SEED,
      difficulty: 'easy',
      guesses: [start.secret],
      elapsedSeconds: 0,
    })!;
    expect(restored.status).toBe('won');
  });
});
