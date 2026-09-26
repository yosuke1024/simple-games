/**
 * The session rules (docs/MANCALA_RULES.md §2–§5, §8): turns pass except
 * after an extra turn, the CPU is deterministic per seed, Undo returns to the
 * player's previous decision point with every CPU move since, and a restored
 * board comes back settled — finished if it is finished.
 */
import { describe, expect, it } from 'vitest';
import { sow } from './engine';
import {
  applyCpuMove,
  applyPlayerMove,
  canUndo,
  createSession,
  restoreSession,
  undo,
  UNDO_HISTORY_LIMIT,
  type MancalaSession,
} from './session';
import {
  BOARD_SIZE,
  CPU,
  CPU_STORE,
  initialPits,
  PLAYER,
  PLAYER_STORE,
  type Pits,
  type Side,
} from './types';

/** Builds a board from the screen picture (engine.test.ts has the same helper). */
function boardOf(
  cpuStore: number,
  cpuRow: readonly number[],
  playerRow: readonly number[],
  playerStore: number,
): Pits {
  const pits = new Array<number>(BOARD_SIZE).fill(0);
  playerRow.forEach((count, i) => (pits[i] = count));
  cpuRow.forEach((count, i) => (pits[12 - i] = count));
  pits[PLAYER_STORE] = playerStore;
  pits[CPU_STORE] = cpuStore;
  return pits;
}

/** A session on a given board, as a restore would hand it back. */
function sessionOn(pits: Pits, toMove: Side = PLAYER, moveCount = 10): MancalaSession {
  return restoreSession({
    seed: 'mancala-session',
    difficulty: 'normal',
    first: PLAYER,
    pits,
    toMove,
    moveCount,
    elapsedSeconds: 0,
  });
}

/** Plays CPU moves until it is the player's turn or the game ends. */
function cpuTurn(session: MancalaSession): MancalaSession {
  let current = session;
  while (current.status === 'playing' && current.toMove === CPU) {
    current = applyCpuMove(current)!;
  }
  return current;
}

describe('turns (§2)', () => {
  it('starts with the player, and the CPU declines to move out of turn', () => {
    const session = createSession('easy', PLAYER, 'mancala-t1');
    expect(session.toMove).toBe(PLAYER);
    expect(session.pits).toEqual(initialPits());
    expect(applyCpuMove(session)).toBeNull();
  });

  it('sows and hands the turn over', () => {
    const next = applyPlayerMove(createSession('easy', PLAYER, 'mancala-t2'), 0)!;
    expect(next.pits).toEqual([0, 5, 5, 5, 5, 4, 0, 4, 4, 4, 4, 4, 4, 0]);
    expect(next.toMove).toBe(CPU);
    expect(next.moveCount).toBe(1);
    expect(next.lastMove).toEqual({
      by: PLAYER,
      pit: 0,
      touched: [1, 2, 3, 4],
      captured: 0,
      lastIndex: 4,
      moveCount: 1,
    });
  });

  it('keeps the turn after an extra turn (§2.1)', () => {
    // Pit 2's four seeds end in the store.
    const next = applyPlayerMove(createSession('easy', PLAYER, 'mancala-t3'), 2)!;
    expect(next.toMove).toBe(PLAYER);
    expect(next.pits[PLAYER_STORE]).toBe(1);
    // And the CPU still may not move.
    expect(applyCpuMove(next)).toBeNull();
  });

  it('lets the CPU chain its own extra turns, one move per call', () => {
    // CPU pit 12 holds one (one from its store), pit 10 holds three.
    const session = sessionOn(boardOf(0, [1, 1, 3, 1, 1, 1], [4, 4, 4, 4, 4, 4], 16), CPU);
    const once = applyCpuMove(session)!;
    expect(once.lastMove!.by).toBe(CPU);
    expect(once.lastMove!.lastIndex).toBe(CPU_STORE);
    // One sowing per call: the next one is the next beat's (§2.1, §4).
    expect(once.moveCount).toBe(session.moveCount + 1);
    expect(once.toMove).toBe(CPU);
  });

  it('refuses an empty pit, a CPU pit, and a store — silently', () => {
    const session = sessionOn(boardOf(0, [4, 4, 4, 4, 4, 4], [0, 4, 4, 4, 4, 4], 4));
    expect(applyPlayerMove(session, 0)).toBeNull();
    expect(applyPlayerMove(session, 8)).toBeNull();
    expect(applyPlayerMove(session, PLAYER_STORE)).toBeNull();
  });

  it('starts on the CPU when the player takes second (§1)', () => {
    const session = createSession('easy', CPU, 'mancala-second');
    expect(session.toMove).toBe(CPU);
    expect(applyPlayerMove(session, 0)).toBeNull();
    const opened = cpuTurn(session);
    expect(opened.toMove).toBe(PLAYER);
    expect(opened.first).toBe(CPU);
  });
});

describe('the end of the game (§3)', () => {
  it('sweeps and settles the moment a row empties — a win', () => {
    // The player's last seed goes into the store (an extra turn) and empties
    // the player's row: the game is over anyway, and the CPU's row goes to
    // the CPU's store.
    const session = sessionOn(boardOf(10, [1, 1, 1, 1, 1, 1], [0, 0, 0, 0, 0, 1], 31));
    const next = applyPlayerMove(session, 5)!;
    expect(next.status).toBe('won');
    expect(next.pits[PLAYER_STORE]).toBe(32);
    expect(next.pits[CPU_STORE]).toBe(16);
    expect(next.pits.reduce((sum, count) => sum + count, 0)).toBe(48);
  });

  it('settles a loss', () => {
    const session = sessionOn(boardOf(30, [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1], 17));
    // The CPU row is already empty here, which a real game would have ended
    // on; restoring it settles it straight away (§8).
    expect(session.status).toBe('lost');
    expect(session.pits[PLAYER_STORE]).toBe(18);
  });

  it('calls 24–24 a draw', () => {
    // Sowing pit 5's single seed into the store leaves the player's row
    // empty: 24 each after the sweep.
    const session = sessionOn(boardOf(20, [0, 0, 0, 0, 1, 3], [0, 0, 0, 0, 0, 1], 23));
    const next = applyPlayerMove(session, 5)!;
    expect(next.status).toBe('draw');
    expect(next.pits[PLAYER_STORE]).toBe(24);
    expect(next.pits[CPU_STORE]).toBe(24);
  });

  it('refuses any move once the game is over', () => {
    const over = sessionOn(boardOf(30, [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1], 17));
    expect(applyPlayerMove(over, 5)).toBeNull();
    expect(applyCpuMove({ ...over, toMove: CPU })).toBeNull();
  });
});

describe('the CPU (§4)', () => {
  it('replies deterministically for one seed', () => {
    const afterPlayer = applyPlayerMove(createSession('normal', PLAYER, 'mancala-t5'), 0)!;
    expect(applyCpuMove(afterPlayer)!.lastMove).toEqual(applyCpuMove(afterPlayer)!.lastMove);
  });
});

describe('undo (§5)', () => {
  it('returns to the previous decision point, CPU reply and all', () => {
    const session = createSession('easy', PLAYER, 'mancala-t6');
    const replied = cpuTurn(applyPlayerMove(session, 0)!);
    expect(replied.toMove).toBe(PLAYER);
    expect(canUndo(replied)).toBe(true);

    const undone = undo(replied)!;
    expect(undone.pits).toEqual(session.pits);
    expect(undone.moveCount).toBe(0);
    expect(undone.toMove).toBe(PLAYER);
    expect(undone.lastMove).toBeNull();
    expect(undone.history).toEqual([]);
  });

  it('takes a whole chain of CPU extra turns back with the move before it', () => {
    // The player's pit 0 (one seed) goes to pit 1 and hands the CPU a board
    // where pit 12 (one seed) and then pit 10 (three) both end in its store.
    const start = sessionOn(boardOf(0, [1, 1, 3, 1, 1, 1], [1, 3, 4, 4, 4, 4], 20));
    const afterPlayer = applyPlayerMove(start, 0)!;
    const replied = cpuTurn(afterPlayer);
    expect(replied.moveCount - afterPlayer.moveCount).toBeGreaterThan(1);

    const undone = undo(replied)!;
    expect(undone.pits).toEqual(start.pits);
    expect(undone.moveCount).toBe(start.moveCount);
    expect(undone.toMove).toBe(PLAYER);
  });

  it('steps back through the player’s own extra turn one decision at a time', () => {
    const session = createSession('easy', PLAYER, 'mancala-t7');
    const extra = applyPlayerMove(session, 2)!; // into the store: go again
    const second = applyPlayerMove(extra, 5)!;
    expect(second.history).toHaveLength(2);

    const once = undo(second)!;
    expect(once.pits).toEqual(extra.pits);
    expect(once.toMove).toBe(PLAYER);
    const twice = undo(once)!;
    expect(twice.pits).toEqual(session.pits);
    expect(undo(twice)).toBeNull();
  });

  it('has nothing to undo before the first move, or after only the CPU has moved', () => {
    expect(undo(createSession('easy', PLAYER, 'mancala-t8'))).toBeNull();
    const cpuOpened = cpuTurn(createSession('easy', CPU, 'mancala-t9'));
    expect(canUndo(cpuOpened)).toBe(false);
  });

  it('does not reroll: the same move brings the same reply (§4, §5)', () => {
    const session = createSession('hard', PLAYER, 'mancala-t10');
    const first = cpuTurn(applyPlayerMove(session, 1)!);
    const again = cpuTurn(applyPlayerMove(undo(first)!, 1)!);
    expect(again.pits).toEqual(first.pits);
    expect(again.moveCount).toBe(first.moveCount);
  });

  it('keeps at most UNDO_HISTORY_LIMIT decision points', () => {
    // Hand the player extra turn after extra turn on a board built for it:
    // pit 5 holding one seed always ends in the store.
    let session = sessionOn(boardOf(0, [4, 4, 4, 4, 4, 4], [4, 4, 0, 0, 0, 1], 15));
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 5; i++) {
      const refilled = { ...session, pits: [...session.pits] };
      refilled.pits[5] = 1;
      refilled.pits[PLAYER_STORE]! -= 1;
      session = applyPlayerMove(refilled, 5)!;
    }
    expect(session.history).toHaveLength(UNDO_HISTORY_LIMIT);
  });
});

describe('restoring (§8)', () => {
  it('keeps the stored turn rather than deriving one', () => {
    // After an extra turn the player is to move again, on a board where the
    // counts alone would say nothing about it.
    const extra = sow(initialPits(), PLAYER, 2)!;
    const restored = sessionOn(extra.pits, PLAYER, 1);
    expect(restored.toMove).toBe(PLAYER);
    expect(restored.status).toBe('playing');
    expect(restored.history).toEqual([]);
    expect(restored.lastMove).toBeNull();
  });

  it('recognises a finished board so the loader can discard it', () => {
    const finished = sessionOn(boardOf(30, [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 1], 17));
    expect(finished.status).not.toBe('playing');
  });
});
