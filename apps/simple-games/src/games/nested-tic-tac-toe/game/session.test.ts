/**
 * One match from the player's side (docs/NESTED_TIC_TAC_TOE_RULES.md §1, §3,
 * §5): whose turn it is, what a move does to the status, and Undo — back to
 * the player's previous decision point, never past the CPU's opening move,
 * never after the end, and a take-back rather than a reroll.
 */
import { describe, expect, it } from 'vitest';
import { legalMoves, positionFromMoves } from './engine';
import {
  applyCpuMove,
  applyPlayerMove,
  canUndo,
  cpuMark,
  createSession,
  isCpuTurn,
  isPlayerTurn,
  matchSeed,
  newSeedToken,
  playerMark,
  restoreSession,
  takenBoards,
  undo,
  type NestedSession,
} from './session';
import { CIRCLE, CROSS, type Difficulty } from './types';

/** The player's stand-in: the lowest legal cell. Simple and fully determined. */
const firstLegal = (session: NestedSession): number => session.view.legal[0]!;

function playerThenCpu(session: NestedSession, cell = firstLegal(session)): NestedSession {
  const played = applyPlayerMove(session, cell)!.session;
  return played.status === 'playing' ? applyCpuMove(played)!.session : played;
}

/** Plays the stand-in against the CPU to the end. */
function playToEnd(difficulty: Difficulty, playerGoesFirst: boolean, seed: string): NestedSession {
  let session = createSession(difficulty, playerGoesFirst, seed);
  while (session.status === 'playing') {
    session = isCpuTurn(session)
      ? applyCpuMove(session)!.session
      : applyPlayerMove(session, firstLegal(session))!.session;
  }
  return session;
}

describe('a new match (§1)', () => {
  it('starts on the empty board with the player on cross when going first', () => {
    const session = createSession('normal', true, 'seed');
    expect(session.moves).toEqual([]);
    expect(session.status).toBe('playing');
    expect(playerMark(session)).toBe(CROSS);
    expect(cpuMark(session)).toBe(CIRCLE);
    expect(isPlayerTurn(session)).toBe(true);
    expect(session.view.legal).toHaveLength(81);
    expect(session.view.freeMove).toBe(true);
    expect(session.view.playable).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(session.view.lastMove).toBeNull();
  });

  it('starts on the CPU’s turn when the player goes second — on circle', () => {
    const session = createSession('normal', false, 'seed');
    expect(playerMark(session)).toBe(CIRCLE);
    expect(isCpuTurn(session)).toBe(true);
    expect(applyPlayerMove(session, 40)).toBeNull();
    const opened = applyCpuMove(session)!.session;
    expect(opened.moves).toHaveLength(1);
    expect(isPlayerTurn(opened)).toBe(true);
  });

  it('gets a seed of its own: nested-tic-tac-toe-<clock base 36>-<random>', () => {
    expect(matchSeed(newSeedToken(36 ** 3, () => 0.5))).toBe(
      `nested-tic-tac-toe-1000-${Math.floor(0.5 * 0xffffff).toString(36)}`,
    );
  });
});

describe('moves (§2, §3)', () => {
  it('accepts only the player’s legal moves on the player’s turn, and nothing else', () => {
    const session = applyPlayerMove(createSession('easy', true, 'seed'), 8)!.session;
    // The CPU's turn now: the player cannot move.
    expect(applyPlayerMove(session, 72)).toBeNull();
    expect(applyCpuMove(session)).not.toBeNull();
    const answered = applyCpuMove(session)!.session;
    // Sent somewhere: a cell outside that board is refused, silently.
    const outside = Array.from({ length: 81 }, (_, cell) => cell).find(
      (cell) => !answered.view.legal.includes(cell),
    )!;
    expect(applyPlayerMove(answered, outside)).toBeNull();
    expect(applyPlayerMove(answered, answered.moves[0]!)).toBeNull();
  });

  it('only lets the CPU move on its own turn — a stale timer lands as nothing', () => {
    const session = createSession('easy', true, 'seed');
    expect(applyCpuMove(session)).toBeNull();
  });

  it('keeps the view in step with the moves', () => {
    const session = playerThenCpu(createSession('easy', true, 'seed'), 8);
    const position = positionFromMoves(session.moves)!;
    expect(session.view.legal).toEqual(legalMoves(position));
    expect(session.view.cells).toEqual(Array.from(position.cells));
    expect(session.view.lastMove).toBe(session.moves[1]);
  });

  it('reports a move that takes its small board', () => {
    // Cross takes board 0 with 1-4-7 (the list of engine.test.ts): the
    // stand-in replays it by restoring at the move before and playing 7.
    const before = restoreSession({
      seed: 'seed',
      difficulty: 'easy',
      playerGoesFirst: true,
      moves: [1, 9, 4, 36],
      elapsedSeconds: 0,
    })!;
    const outcome = applyPlayerMove(before, 7)!;
    expect(outcome.took).toBe(true);
    expect(outcome.session.view.smalls[0]).toBe(CROSS);
    expect(takenBoards(outcome.session)).toEqual({ player: 1, cpu: 0 });
    const quiet = applyPlayerMove(before, 6)!;
    expect(quiet.took).toBe(false);
  });

  it('ends once, from the player’s side, and refuses every move after', () => {
    const outcomes = new Set<string>();
    for (const [difficulty, first] of [
      ['easy', true],
      ['easy', false],
      ['normal', true],
      ['normal', false],
    ] as const) {
      const session = playToEnd(difficulty, first, `end-${difficulty}-${first}`);
      expect(['won', 'lost', 'draw']).toContain(session.status);
      outcomes.add(session.status);
      expect(session.view.legal).toEqual([]);
      expect(applyPlayerMove(session, 0)).toBeNull();
      expect(applyCpuMove(session)).toBeNull();
      expect(canUndo(session)).toBe(false);
      expect(undo(session)).toBeNull();
      const position = positionFromMoves(session.moves)!;
      const winner = position.result;
      if (session.status === 'won') expect(winner).toBe(playerMark(session));
      if (session.status === 'lost') expect(winner).toBe(cpuMark(session));
      if (session.status === 'lost' || session.status === 'won') {
        expect(session.view.winningLine).not.toBeNull();
      }
    }
    // The stand-in plays the lowest cell — the CPU beats it.
    expect(outcomes.has('lost')).toBe(true);
  });
});

describe('Undo (§5)', () => {
  it('takes back the CPU’s reply and the player’s move together', () => {
    const start = createSession('normal', true, 'undo');
    const once = playerThenCpu(start, 40);
    const twice = playerThenCpu(once);
    expect(twice.moves).toHaveLength(4);
    const back = undo(twice)!;
    expect(back.moves).toEqual(once.moves);
    expect(back.view).toEqual(once.view);
    expect(isPlayerTurn(back)).toBe(true);
  });

  it('takes back only the player’s move during the CPU’s pause', () => {
    const once = playerThenCpu(createSession('normal', true, 'undo'), 40);
    const pending = applyPlayerMove(once, firstLegal(once))!.session;
    expect(isCpuTurn(pending)).toBe(true);
    expect(undo(pending)!.moves).toEqual(once.moves);
  });

  it('never takes back the CPU’s opening move when the player went second', () => {
    const opened = applyCpuMove(createSession('normal', false, 'undo'))!.session;
    expect(canUndo(opened)).toBe(false);
    expect(undo(opened)).toBeNull();
    const replied = playerThenCpu(opened);
    expect(undo(replied)!.moves).toEqual(opened.moves);
  });

  it('cannot undo before the player has moved', () => {
    expect(canUndo(createSession('easy', true, 'undo'))).toBe(false);
  });

  it('is a take-back, not a reroll: the same move brings the same reply', () => {
    for (const difficulty of ['easy', 'normal'] as const) {
      const once = playerThenCpu(createSession(difficulty, true, `reroll-${difficulty}`), 40);
      const cell = firstLegal(once);
      const twice = playerThenCpu(once, cell);
      const again = playerThenCpu(undo(twice)!, cell);
      expect(again.moves).toEqual(twice.moves);
    }
  });

  it('works on a restored match too — the list is the history (§8)', () => {
    const played = playerThenCpu(playerThenCpu(createSession('easy', true, 'resume'), 40));
    const restored = restoreSession({ ...played, moves: [...played.moves] })!;
    expect(restored.moves).toEqual(played.moves);
    expect(undo(restored)!.moves).toEqual(played.moves.slice(0, 2));
    expect(undo(undo(restored)!)!.moves).toEqual([]);
  });
});

describe('restoreSession (§8.2)', () => {
  const record = {
    seed: 's',
    difficulty: 'easy' as const,
    playerGoesFirst: true,
    elapsedSeconds: 12,
  };

  it('restores the turn and the send from the list alone', () => {
    const session = restoreSession({ ...record, moves: [8] })!;
    expect(isCpuTurn(session)).toBe(true);
    expect(session.view.playable).toEqual([8]);
    expect(session.elapsedSeconds).toBe(12);
  });

  it('refuses an illegal list and a finished one', () => {
    expect(restoreSession({ ...record, moves: [8, 0] })).toBeNull();
    const finished = playToEnd('easy', true, 'restore-finished');
    expect(restoreSession({ ...record, moves: finished.moves })).toBeNull();
  });
});
