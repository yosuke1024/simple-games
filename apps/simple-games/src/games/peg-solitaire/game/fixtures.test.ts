/**
 * The screen-test positions in fixtures.ts, replayed through the rules
 * (docs/PEG_SOLITAIRE_RULES.md §3, §11): each is a legal game from a problem
 * this game deals, and each ends exactly the way the screen tests say it
 * does. A fixture that drifted from the rules fails here, not as a confusing
 * failure three layers up.
 */
import { describe, expect, it } from 'vitest';
import { ENGLISH_PROBLEM, findProblem } from './problems';
import {
  ENGLISH_SOLUTION,
  ENGLISH_STUCK,
  parseEnglishJumps,
  TRIANGLE_APEX_PERFECT_LAST,
  TRIANGLE_APEX_PREFIX,
  TRIANGLE_APEX_SINGLE_LAST,
  TRIANGLE_APEX_STUCK,
  type JumpList,
} from './fixtures';
import { applyMove, createSession, restoreSession, type PegSolitaireSession } from './session';
import type { Problem } from './types';

function replay(problem: Problem, jumps: JumpList): PegSolitaireSession {
  let session = createSession(problem);
  for (const [from, to] of jumps) {
    const next = applyMove(session, from, to);
    expect(next, `jump ${from}→${to} is legal`).not.toBeNull();
    session = next!;
  }
  return session;
}

const APEX = findProblem('triangle', 0, 0)!;

describe('the screen tests’ positions (fixtures.ts)', () => {
  it('deal the apex problem of the triangle', () => {
    expect(APEX).toEqual({ kind: 'triangle', start: 0, target: 0 });
  });

  it('leave two pegs and two finishes after the twelve-jump prefix', () => {
    const before = replay(APEX, TRIANGLE_APEX_PREFIX);
    expect(before.status).toBe('playing');
    expect(before.pegs.filter(Boolean)).toHaveLength(2);
    // It is a position a save can hold, so a test can open the screen on it.
    const restored = restoreSession({
      board: 'triangle',
      start: 0,
      target: 0,
      jumps: TRIANGLE_APEX_PREFIX,
      elapsedSeconds: 0,
    });
    expect(restored.ok).toBe(true);

    const perfect = replay(APEX, [...TRIANGLE_APEX_PREFIX, TRIANGLE_APEX_PERFECT_LAST]);
    expect(perfect.outcome).toEqual({ kind: 'perfect', remaining: 1 });
    expect(perfect.pegs[0]).toBe(true);

    const single = replay(APEX, [...TRIANGLE_APEX_PREFIX, TRIANGLE_APEX_SINGLE_LAST]);
    expect(single.outcome).toEqual({ kind: 'single', remaining: 1 });
    expect(single.pegs[6]).toBe(true);
  });

  it('end the triangle walk stuck with three pegs, one jump after a playable save', () => {
    const stuck = replay(APEX, TRIANGLE_APEX_STUCK);
    expect(stuck.outcome).toEqual({ kind: 'stuck', remaining: 3 });
    expect(replay(APEX, TRIANGLE_APEX_STUCK.slice(0, -1)).status).toBe('playing');
  });

  it('end the cross walk stuck with seven pegs, and the written solution perfect', () => {
    const stuck = replay(ENGLISH_PROBLEM, parseEnglishJumps(ENGLISH_STUCK));
    expect(stuck.outcome).toEqual({ kind: 'stuck', remaining: 7 });
    const solved = replay(ENGLISH_PROBLEM, parseEnglishJumps(ENGLISH_SOLUTION));
    expect(solved.outcome).toEqual({ kind: 'perfect', remaining: 1 });
  });
});
