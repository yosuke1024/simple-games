/**
 * The session rules (docs/DOTS_AND_BOXES_RULES.md §2–§5): a closed box keeps
 * the move, anything else passes it, the CPU's run comes off with the
 * player's line on Undo, and the finished board says who won — including the
 * draw only 4×4 can produce.
 */
import { describe, expect, it } from 'vitest';
import { claim } from './engine';
import {
  applyCpuMove,
  applyPlayerMove,
  createSession,
  restoreSession,
  undo,
  UNDO_HISTORY_LIMIT,
  type DotsAndBoxesSession,
} from './session';
import {
  boxAt,
  CPU,
  edgeCount,
  edgesOfBox,
  emptyBoard,
  hEdge,
  PLAYER,
  vEdge,
  type Board,
  type BoardSize,
  type Side,
} from './types';

/** A session on `board`, mid-match, with `toMove` to draw. */
function sessionOn(
  size: BoardSize,
  board: Board,
  toMove: Side,
  seed = 'dots-and-boxes-test',
): DotsAndBoxesSession {
  let drawn = 0;
  for (const character of board.edges) if (character !== '0') drawn += 1;
  return restoreSession({ seed, size, board, toMove, moveCount: drawn, elapsedSeconds: 0 });
}

function drawAll(board: Board, side: Side, edges: readonly number[]): Board {
  let next = board;
  for (const edge of edges) next = claim(next, side, edge)!.board;
  return next;
}

/**
 * A 4×4 board with every line drawn but the top of box (0,0): the other
 * fifteen boxes are shared out as `players` to the player and the rest to
 * the CPU, and the last line closes the sixteenth for whoever draws it.
 */
function lastLineOn4x4(players: number): Board {
  const n = 4;
  const edges = '1'.repeat(edgeCount(n)).split('');
  edges[hEdge(n, 0, 0)] = '0';
  const boxes = ['.'];
  for (let i = 1; i < 16; i++) boxes.push(i <= players ? 'p' : 'c');
  return { n, edges: edges.join(''), boxes: boxes.join('') };
}

describe('turns (§2)', () => {
  it('starts with the player, and the CPU declines to move out of turn', () => {
    const session = createSession('small', 'dots-and-boxes-t1');
    expect(session.toMove).toBe(PLAYER);
    expect(session.board.edges).toBe('0'.repeat(24));
    expect(applyCpuMove(session)).toBeNull();
  });

  it('passes the turn when a line closes nothing', () => {
    const next = applyPlayerMove(createSession('small', 'dots-and-boxes-t2'), 0)!;
    expect(next.toMove).toBe(CPU);
    expect(next.moveCount).toBe(1);
    expect(next.lastMove).toEqual({ by: PLAYER, edge: 0, completed: [], moveCount: 1 });
    expect(next.status).toBe('playing');
    // The player cannot draw twice in a row without a box.
    expect(applyPlayerMove(next, 1)).toBeNull();
  });

  it('keeps the turn with whoever closes a box (§2)', () => {
    const [top, bottom, left, right] = edgesOfBox(3, 1, 1);
    const board = drawAll(emptyBoard(3), CPU, [top, bottom, left]);
    const session = sessionOn('small', board, PLAYER);

    const next = applyPlayerMove(session, right)!;
    expect(next.toMove).toBe(PLAYER);
    expect(next.lastMove?.completed).toEqual([boxAt(3, 1, 1)]);
    expect(next.board.boxes[boxAt(3, 1, 1)]).toBe('p');
    // …and the player draws again.
    expect(applyPlayerMove(next, 0)).not.toBeNull();
  });

  it('rejects a line already drawn, silently', () => {
    const next = applyPlayerMove(createSession('small', 'dots-and-boxes-t3'), 4)!;
    const back = { ...next, toMove: PLAYER } as DotsAndBoxesSession;
    expect(applyPlayerMove(back, 4)).toBeNull();
  });
});

describe('the CPU (§4)', () => {
  it('keeps drawing while it closes boxes, one line per call', () => {
    // Box (0,0) is one line from closed, and it is the CPU's move.
    const [top, bottom, left, right] = edgesOfBox(3, 0, 0);
    const board = drawAll(emptyBoard(3), PLAYER, [top, bottom, left]);
    const session = sessionOn('small', board, CPU);

    const took = applyCpuMove(session)!;
    expect(took.lastMove).toMatchObject({ by: CPU, edge: right, completed: [0] });
    expect(took.toMove).toBe(CPU);

    // Nothing more to close: the next line is a safe one, and the turn passes.
    const after = applyCpuMove(took)!;
    expect(after.lastMove?.completed).toEqual([]);
    expect(after.toMove).toBe(PLAYER);
  });

  it('replies deterministically for one seed', () => {
    const afterPlayer = applyPlayerMove(createSession('large', 'dots-and-boxes-t5'), 7)!;
    expect(applyCpuMove(afterPlayer)!.lastMove).toEqual(applyCpuMove(afterPlayer)!.lastMove);
  });
});

describe('undo (§5)', () => {
  it('returns to the previous decision point, CPU run and all', () => {
    // The player's line hands the CPU box (0,0); the CPU takes it and keeps
    // drawing. Undo takes back the player's line and every CPU line after it.
    const [top, , left] = edgesOfBox(3, 0, 0);
    const board = drawAll(emptyBoard(3), PLAYER, [top, left]);
    const start = sessionOn('small', board, PLAYER, 'dots-and-boxes-t6');

    let session = applyPlayerMove(start, hEdge(3, 1, 0))!;
    expect(session.toMove).toBe(CPU);
    session = applyCpuMove(session)!;
    expect(session.lastMove?.completed).toEqual([0]);
    expect(session.toMove).toBe(CPU);
    session = applyCpuMove(session)!;
    expect(session.toMove).toBe(PLAYER);
    expect(session.moveCount).toBe(start.moveCount + 3);

    const undone = undo(session)!;
    expect(undone.board).toEqual(start.board);
    expect(undone.moveCount).toBe(start.moveCount);
    expect(undone.toMove).toBe(PLAYER);
    expect(undone.lastMove).toBeNull();
    expect(undone.history).toEqual([]);
  });

  it('steps back one line at a time through the player’s own run', () => {
    const [top, bottom, left, right] = edgesOfBox(3, 2, 2);
    const board = drawAll(emptyBoard(3), CPU, [top, bottom, left]);
    const start = sessionOn('small', board, PLAYER);

    const closed = applyPlayerMove(start, right)!;
    const again = applyPlayerMove(closed, 0)!;
    expect(undo(again)!.board).toEqual(closed.board);
    expect(undo(undo(again)!)!.board).toEqual(start.board);
  });

  it('has nothing to undo before the first line', () => {
    expect(undo(createSession('small', 'dots-and-boxes-t7'))).toBeNull();
  });

  it('does not reroll: the same line brings the same reply (§4, §5)', () => {
    const session = createSession('medium', 'dots-and-boxes-t8');
    const first = applyCpuMove(applyPlayerMove(session, vEdge(4, 1, 2))!)!;
    const again = applyCpuMove(applyPlayerMove(undo(first)!, vEdge(4, 1, 2))!)!;
    expect(again.lastMove).toEqual(first.lastMove);
  });

  it('keeps a bounded history', () => {
    expect(UNDO_HISTORY_LIMIT).toBeGreaterThanOrEqual(edgeCount(5));
  });
});

describe('the end of the match (§3)', () => {
  it('is a win when the last line gives the player more boxes', () => {
    const session = sessionOn('medium', lastLineOn4x4(8), PLAYER);
    const end = applyPlayerMove(session, hEdge(4, 0, 0))!;
    expect(end.status).toBe('won');
    expect(end.board.boxes.split('p')).toHaveLength(10);
  });

  it('is a draw on 4×4 when the boxes split eight and eight', () => {
    const session = sessionOn('medium', lastLineOn4x4(7), PLAYER);
    const end = applyPlayerMove(session, hEdge(4, 0, 0))!;
    expect(end.status).toBe('draw');
    // A finished match takes no more lines from anyone.
    expect(applyPlayerMove(end, 0)).toBeNull();
    expect(applyCpuMove(end)).toBeNull();
  });

  it('is a loss when the CPU ends up ahead', () => {
    const session = sessionOn('medium', lastLineOn4x4(7), CPU);
    const end = applyCpuMove(session)!;
    expect(end.lastMove?.edge).toBe(hEdge(4, 0, 0));
    expect(end.status).toBe('lost');
  });

  it('recognises a finished board on restore, so the loader can discard it', () => {
    const board = claim(lastLineOn4x4(8), CPU, hEdge(4, 0, 0))!.board;
    expect(sessionOn('medium', board, PLAYER).status).toBe('draw');
  });
});
