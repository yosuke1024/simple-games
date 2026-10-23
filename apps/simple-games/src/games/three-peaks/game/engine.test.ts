import { describe, expect, it } from 'vitest';
import {
  adjacent,
  applyAction,
  canTake,
  COVERS,
  createSession,
  isExposed,
  remaining,
  restoreSession,
  statusOf,
  undo,
} from './index';
import { WINNING_ACTIONS, winningPrefix } from './fixtures';
describe('Three Peaks rules', () => {
  it('deals all 52 cards exactly once with a stable seed and 23 remaining draws', () => {
    for (let seed = 0; seed < 100; seed++) {
      const session = createSession(seed);
      expect(new Set(session.deck).size).toBe(52);
      expect([...session.deck].sort((a, b) => a - b)).toEqual(
        Array.from({ length: 52 }, (_, i) => i),
      );
      expect(session).toEqual(createSession(seed));
      expect(session.waste).toBe(session.deck[28]);
      expect(session.stockIndex).toBe(29);
      expect(remaining(session)).toBe(28);
    }
    expect(createSession(0).deck).not.toEqual(createSession(1).deck);
  });
  it('allows neighbouring ranks and K–A, independent of suit, but never equal ranks', () => {
    expect(adjacent(12, 0)).toBe(true);
    expect(adjacent(0, 12)).toBe(true);
    expect(adjacent(26, 14)).toBe(true);
    expect(adjacent(11, 0)).toBe(false);
    expect(adjacent(0, 13)).toBe(false);
  });
  it('requires both covers to be removed; the bottom row starts exposed', () => {
    const session = createSession(6);
    expect(session.removed.map((_, i) => isExposed(session, i))).toEqual([
      ...Array(18).fill(false),
      ...Array(10).fill(true),
    ]);
    session.removed[18] = true;
    expect(isExposed(session, 9)).toBe(false);
    session.removed[19] = true;
    expect(isExposed(session, 9)).toBe(true);
    for (let i = 0; i < 28; i++)
      expect(COVERS[i]!.every((child) => child > i && child < 28)).toBe(true);
  });
  it('refuses covered, removed, nonadjacent and out-of-range cards without mutation', () => {
    const session = createSession(6);
    const before = structuredClone(session);
    for (const index of [0, -1, 28, 1.5, Number.NaN])
      expect(applyAction(session, { kind: 'take', index })).toBeNull();
    expect(session).toEqual(before);
    const first = applyAction(session, { kind: 'take', index: 20 })!;
    expect(first.waste).toBe(session.deck[20]);
    expect(remaining(first)).toBe(27);
    expect(applyAction(first, { kind: 'take', index: 20 })).toBeNull();
  });
  it('allows drawing despite a legal move, exactly once through the stock', () => {
    let session = createSession(6);
    expect(canTake(session, 20)).toBe(true);
    for (let n = 0; n < 23; n++) {
      const next = applyAction(session, { kind: 'draw' });
      expect(next).not.toBeNull();
      session = next!;
      expect(session.waste).toBe(session.deck[29 + n]);
    }
    expect(session.stockIndex).toBe(52);
    expect(applyAction(session, { kind: 'draw' })).toBeNull();
  });
  it('does not declare stuck while an exposed match remains after the stock runs out', () => {
    const session = createSession(6);
    session.stockIndex = 52;
    session.waste = (session.deck[18]! + 1) % 13;
    expect(statusOf(session)).toBe('playing');
    session.removed = Array<boolean>(28).fill(true);
    session.removed[0] = false;
    session.waste = session.deck[0]!;
    expect(statusOf(session)).toBe('stuck');
    session.removed[0] = true;
    expect(statusOf(session)).toBe('won');
  });
  it('wins by removing the final card and can undo every take and draw back to the deal', () => {
    const beforeWin = winningPrefix(WINNING_ACTIONS.length - 1);
    expect(remaining(beforeWin)).toBe(1);
    expect(beforeWin.status).toBe('playing');
    let session = applyAction(beforeWin, WINNING_ACTIONS.at(-1)!)!;
    expect(session.status).toBe('won');
    expect(applyAction(session, { kind: 'draw' })).toBeNull();
    session = { ...session, elapsedSeconds: 91, countedWin: true };
    for (let n = WINNING_ACTIONS.length - 1; n >= 0; n--) {
      session = undo(session)!;
      expect(session.status).toBe('playing');
      expect(session.actions).toEqual(WINNING_ACTIONS.slice(0, n));
      expect(session.elapsedSeconds).toBe(91);
      expect(session.countedWin).toBe(true);
    }
    expect(session.deck).toEqual(createSession(6).deck);
    expect(session.removed.every((value) => !value)).toBe(true);
    expect(undo(session)).toBeNull();
  });
  it('undoes a stuck finish and replays valid saves but rejects impossible histories', () => {
    let session = createSession(0);
    while (session.status === 'playing') {
      const index = session.removed.findIndex((_, i) => canTake(session, i));
      session = applyAction(session, index < 0 ? { kind: 'draw' } : { kind: 'take', index })!;
    }
    expect(session.status).toBe('stuck');
    expect(undo(session)?.status).toBe('playing');
    expect(restoreSession(winningPrefix(12))).toEqual(winningPrefix(12));
    expect(
      restoreSession({ ...createSession(6), actions: [{ kind: 'take', index: 0 }] }),
    ).toBeNull();
    expect(
      restoreSession({ ...createSession(6), actions: Array(52).fill({ kind: 'draw' }) }),
    ).toBeNull();
    expect(restoreSession({ ...createSession(6), seed: -1 })).toBeNull();
    expect(restoreSession({ ...createSession(6), elapsedSeconds: Infinity })).toBeNull();
  });
});
