/**
 * Session rules of docs/UNBLOCK_PUZZLE_RULES.md §4, §6, §9 and §12: what a
 * slide does to a session (and when two slides are one move), what undo and
 * reset take back, what the Hint says and that following it solves the board
 * in exactly the fewest moves, and the ways a session comes into being.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, dayDifference, localDateString } from './daily';
import { legalSlides } from './engine';
import { COMPONENT_LIMIT } from './generator';
import { createRng } from './rng';
import { exploreComponent, solve } from './search';
import { decodeBoard, encodeMoves, type Move } from './serialize';
import {
  MOVE_LIMIT,
  canUndo,
  cellsMoved,
  createDailySession,
  createFreeSession,
  doHintUse,
  doSlide,
  doUndo,
  findHint,
  freeSeed,
  hintFor,
  isDealtBoard,
  moveCount,
  newSeedToken,
  rangeOf,
  restartSession,
  restoreSession,
  withElapsedSeconds,
  type SessionRecord,
  type UnblockSession,
} from './session';
import { oracleSolve } from './test-helpers';
import { TARGET_BLOCK, type Block, type Board } from './types';

const easy = createFreeSession('easy', 'unblock-puzzle-easy-session');
const medium = createFreeSession('medium', 'unblock-puzzle-medium-session');

/** The first block that can move, and somewhere it can go. */
function firstSlide(session: UnblockSession): { block: number; to: number } {
  return legalSlides(session.board)[0]!;
}

/** Plays the forward solver's own solution from the session's board. */
function playSolution(session: UnblockSession): UnblockSession {
  const result = solve(session.board, 10_000);
  if (result.status !== 'solved') throw new Error('unsolved');
  let current = session;
  for (const move of result.solution) current = doSlide(current, move.block, move.to)!;
  return current;
}

/** Follows the Hint until the board is solved, counting the hints taken. */
function followHints(session: UnblockSession): { session: UnblockSession; hints: number } {
  let current = session;
  let hints = 0;
  for (;;) {
    const hint = hintFor(current);
    if (hint === null) return { session: current, hints };
    if (hint.kind !== 'move') throw new Error(`no hint: ${hint.reason}`);
    hints++;
    current = doSlide(current, hint.block, hint.to)!;
  }
}

const B_PAIR: Block = { orientation: 'v', length: 2, lane: 3 };
const C_TRIPLE: Block = { orientation: 'h', length: 3, lane: 5 };

/** A session around a hand-built board (the hint reads only the board and the moves). */
function sessionOn(board: Board, minMoves: number): UnblockSession {
  return { ...easy, start: board, board, minMoves, moves: [], status: 'playing' };
}

function withPosition(board: Board, block: number, position: number): Board {
  const positions = [...board.positions];
  positions[block] = position;
  return { blocks: board.blocks, positions };
}

/** The oracle's fewest moves for a board that has a way out. */
function oracleMoves(board: Board): number {
  const result = oracleSolve(board);
  if (result.minMoves === null) throw new Error('oracle: no way out');
  return result.minMoves;
}

/** Where the count ends along the hints of §6, by the oracle alone. */
function oracleTarget(session: UnblockSession): number {
  const last: Move | undefined = session.moves[session.moves.length - 1];
  if (last === undefined) return oracleMoves(session.board);
  return moveCount(session) - 1 + oracleMoves(withPosition(session.board, last.block, last.from));
}

/**
 * States met on seeded random walks from two dealt boards: any legal slide,
 * the same block again included, so moves merge and vanish as they do in
 * play (§4).
 */
function detourStates(): { name: string; session: UnblockSession }[] {
  const out: { name: string; session: UnblockSession }[] = [];
  for (const start of [easy, medium]) {
    const rng = createRng(`detours-${start.seed}`);
    let session = start;
    for (let step = 1; step <= 14; step++) {
      const moves = legalSlides(session.board);
      const move = moves[Math.floor(rng() * moves.length)]!;
      const next = doSlide(session, move.block, move.to);
      if (next === null || next.status === 'solved') continue;
      session = next;
      out.push({
        name: `${start.difficulty} step ${step} (${encodeMoves(session.moves)})`,
        session,
      });
    }
  }
  return out;
}

describe('sessions (§9)', () => {
  it('deals a Free Play board from the seed, nothing moved yet', () => {
    expect(easy.mode).toBe('free');
    expect(easy.dailyDate).toBeNull();
    expect(easy.moves).toEqual([]);
    expect(easy.board).toEqual(easy.start);
    expect(easy.status).toBe('playing');
    expect(easy.minMoves).toBeGreaterThan(0);
    expect(createFreeSession('easy', 'unblock-puzzle-easy-session').start).toEqual(easy.start);
  });

  it('seeds Free Play per token, and the daily per date, medium every day', () => {
    expect(freeSeed('hard', 'abc')).toBe('unblock-puzzle-hard-abc');
    expect(dailySeed('2026-10-17')).toBe('unblock-puzzle-daily-2026-10-17');
    const daily = createDailySession('2026-10-17');
    expect(daily.mode).toBe('daily');
    expect(daily.difficulty).toBe('medium');
    expect(daily.dailyDate).toBe('2026-10-17');
    expect(daily.seed).toBe('unblock-puzzle-daily-2026-10-17');
    expect(newSeedToken(0, () => 0)).toBe('0-0');
    expect(createFreeSession('medium').seed).toMatch(/^unblock-puzzle-medium-/);
  });
});

describe('slides and the move count (§4)', () => {
  it('records a legal slide as one move, whatever its distance', () => {
    const move = firstSlide(easy);
    const after = doSlide(easy, move.block, move.to)!;
    expect(moveCount(after)).toBe(1);
    expect(after.moves[0]).toEqual({ ...move, from: easy.board.positions[move.block] });
    expect(after.board.positions[move.block]).toBe(move.to);
    expect(cellsMoved(after)).toBe(Math.abs(move.to - easy.board.positions[move.block]!));
  });

  it('refuses an illegal slide and records nothing', () => {
    const range = rangeOf(easy, 0);
    expect(doSlide(easy, 0, range.max + 1)).toBeNull();
    expect(doSlide(easy, 0, easy.board.positions[0]!)).toBeNull();
    expect(doSlide(easy, 99, 0)).toBeNull();
  });

  it('counts consecutive slides of one block as one move, and none if it ends where it began', () => {
    // A block with room to move two cells or more in one direction.
    const board = easy.board;
    let block = -1;
    for (let b = 0; b < board.blocks.length && block < 0; b++) {
      const range = rangeOf(easy, b);
      if (range.max - board.positions[b]! >= 2) block = b;
    }
    expect(block).toBeGreaterThanOrEqual(0);
    const from = board.positions[block]!;
    const one = doSlide(easy, block, from + 1)!;
    const two = doSlide(one, block, from + 2)!;
    expect(moveCount(two)).toBe(1);
    expect(two.moves).toEqual([{ block, from, to: from + 2 }]);
    expect(cellsMoved(two)).toBe(2);
    const back = doSlide(two, block, from)!;
    expect(moveCount(back)).toBe(0);
    expect(back.board).toEqual(easy.board);
  });

  it('starts a new move when a different block slides', () => {
    const moves = legalSlides(easy.board);
    const first = moves[0]!;
    const after = doSlide(easy, first.block, first.to)!;
    const other = legalSlides(after.board).find((move) => move.block !== first.block)!;
    const next = doSlide(after, other.block, other.to)!;
    expect(moveCount(next)).toBe(2);
  });

  it('refuses a new move past MOVE_LIMIT, but still merges into the last one', () => {
    const move = firstSlide(easy);
    const after = doSlide(easy, move.block, move.to)!;
    const full: UnblockSession = {
      ...after,
      moves: [
        ...new Array<(typeof after.moves)[number]>(MOVE_LIMIT - 1).fill(after.moves[0]!),
        after.moves[0]!,
      ],
    };
    expect(full.moves).toHaveLength(MOVE_LIMIT);
    const other = legalSlides(full.board).find((m) => m.block !== move.block)!;
    expect(doSlide(full, other.block, other.to)).toBeNull();
    // Sliding the last move's block again continues that move (§4).
    const from = easy.board.positions[move.block]!;
    const same = legalSlides(full.board).find((m) => m.block === move.block && m.to !== from);
    const back = legalSlides(full.board).find((m) => m.block === move.block && m.to === from)!;
    expect(doSlide(full, back.block, back.to)?.moves).toHaveLength(MOVE_LIMIT - 1);
    if (same !== undefined) {
      expect(doSlide(full, same.block, same.to)?.moves).toHaveLength(MOVE_LIMIT);
    }
  });

  it('solves in exactly the fewest moves when the solver’s solution is played, and then stops', () => {
    for (const session of [easy, medium]) {
      const solved = playSolution(session);
      expect(solved.status).toBe('solved');
      expect(moveCount(solved)).toBe(session.minMoves);
      expect(doSlide(solved, 0, 0)).toBeNull();
      expect(canUndo(solved)).toBe(false);
      expect(doUndo(solved)).toBeNull();
      expect(hintFor(solved)).toBeNull();
    }
  });
});

describe('undo and reset (§6)', () => {
  it('takes back one whole move at a time, merged slides included, never the hint count', () => {
    const first = firstSlide(easy);
    const one = doHintUse(doSlide(easy, first.block, first.to)!);
    const other = legalSlides(one.board).find((move) => move.block !== first.block)!;
    const two = doSlide(one, other.block, other.to)!;
    const back = doUndo(two)!;
    expect(back.board).toEqual(one.board);
    expect(back.moves).toEqual(one.moves);
    expect(back.hintCount).toBe(1);
    const start = doUndo(back)!;
    expect(start.board).toEqual(easy.board);
    expect(canUndo(start)).toBe(false);
    expect(doUndo(start)).toBeNull();
  });

  it('undoes every move back to the dealt board, however many there were', () => {
    let session = easy;
    for (let n = 0; n < 50; n++) {
      const last = session.moves[session.moves.length - 1];
      const moves = legalSlides(session.board).filter(
        (move) => move.block !== 0 && move.block !== last?.block,
      );
      const move = moves[n % moves.length]!;
      session = doSlide(session, move.block, move.to)!;
    }
    expect(session.status).toBe('playing');
    expect(moveCount(session)).toBe(50);
    while (canUndo(session)) session = doUndo(session)!;
    expect(session.board).toEqual(easy.start);
    expect(moveCount(session)).toBe(0);
  });

  it('resets to the same board, fresh', () => {
    const move = firstSlide(medium);
    const played = withElapsedSeconds(doHintUse(doSlide(medium, move.block, move.to)!), 40);
    const again = restartSession(played);
    expect(again.board).toEqual(medium.start);
    expect(again.start).toEqual(medium.start);
    expect(again.minMoves).toBe(medium.minMoves);
    expect(again.moves).toEqual([]);
    expect(again.elapsedSeconds).toBe(0);
    expect(again.hintCount).toBe(0);
    expect(again.seed).toBe(medium.seed);
  });
});

describe('the Hint (§6)', () => {
  it('names a legal move whose board is one move nearer the exit', () => {
    const hint = hintFor(medium)!;
    expect(hint.kind).toBe('move');
    if (hint.kind !== 'move') return;
    expect(hint.remaining).toBe(medium.minMoves);
    const after = doSlide(medium, hint.block, hint.to)!;
    const left = solve(after.board, 10_000);
    expect(left.status === 'solved' && left.minMoves).toBe(medium.minMoves - 1);
    // Free and unlimited, and it never moves anything itself.
    expect(hintFor(medium)).toEqual(hint);
    expect(medium.moves).toEqual([]);
  });

  it('followed from the start, solves in exactly the fewest moves', () => {
    for (const session of [easy, medium, createDailySession('2026-10-17')]) {
      const { session: done, hints } = followHints(session);
      expect(done.status).toBe('solved');
      expect(hints).toBe(session.minMoves);
      expect(moveCount(done)).toBe(session.minMoves);
    }
  });

  it('after any one move from the dealt board, following the hints ends in exactly the fewest moves', () => {
    // A first move that helps is built on; one that does not is continued
    // into one that does, or put back — sliding a block back to where its
    // move began takes the move away (§4) — so the count still ends at the
    // fewest moves, never one above.
    for (const session of [easy, medium]) {
      for (const move of legalSlides(session.board)) {
        const after = doSlide(session, move.block, move.to)!;
        if (after.status === 'solved') continue;
        const hint = hintFor(after);
        expect(hint?.kind).toBe('move');
        if (hint?.kind !== 'move') continue;
        expect(moveCount(after) + hint.remaining, JSON.stringify(move)).toBe(session.minMoves);
        const { session: done } = followHints(after);
        expect(done.status).toBe('solved');
        expect(moveCount(done), JSON.stringify(move)).toBe(session.minMoves);
      }
    }
  });

  it('counts moves as play counts them: continues the move, puts it back, or builds on it', () => {
    // search.test.ts's board: the target, a vertical pair b in column 3
    // across the target's row, a triple in row 5. Two moves: b out of the
    // row, then the target to the exit.
    const board: Board = {
      blocks: [TARGET_BLOCK, B_PAIR, C_TRIPLE],
      positions: [0, 2, 0],
    };
    const start = sessionOn(board, 2);
    // b up one cell still covers the row. The plain answer from this board
    // is b on to the top — one more move by the board alone, but sliding b
    // on continues the move already counted, so one move remains.
    const up = doSlide(start, 1, 1)!;
    expect(hintFor(up)).toEqual({ kind: 'move', block: 1, to: 0, remaining: 1 });
    // The target right one cell does not help, and nothing it can still do
    // does: the hint puts it back, which takes the move away, and the count
    // still ends at 2.
    const nudge = doSlide(start, 0, 1)!;
    expect(hintFor(nudge)).toEqual({ kind: 'move', block: 0, to: 0, remaining: 1 });
    expect(moveCount(followHints(nudge).session)).toBe(2);
    // b all the way up helps: the hint builds on it from the board as it is.
    const out = doSlide(start, 1, 0)!;
    expect(hintFor(out)).toEqual({ kind: 'move', block: 0, to: 4, remaining: 1 });
    expect(moveCount(followHints(out).session)).toBe(2);
  });

  it.each(detourStates())('agrees with a merge-aware oracle at $name', ({ session }) => {
    // The independent oracle of test-helpers.ts gives the fewest moves of a
    // board. With a last move open, the way out ends at the count so far
    // minus one plus the fewest moves from the board before it (§6).
    const target = oracleTarget(session);
    const hint = hintFor(session);
    expect(hint?.kind).toBe('move');
    if (hint?.kind !== 'move') return;
    expect(moveCount(session) + hint.remaining).toBe(target);
    const after = doSlide(session, hint.block, hint.to);
    expect(after).not.toBeNull();
    if (after === null) return;
    const last = session.moves[session.moves.length - 1];
    const putsBack = last !== undefined && hint.block === last.block && hint.to === last.from;
    const reached = after.status === 'solved' ? moveCount(after) : oracleTarget(after);
    // Following a hint never raises where the count ends; only putting a
    // move back can lower it, by reopening the move before.
    if (putsBack) expect(reached).toBeLessThanOrEqual(target);
    else expect(reached).toBe(target);
    if (last === undefined) return;
    // Ties go to the player's own play: a hint puts a move back only when
    // neither building on it nor continuing it ends as low.
    const before = oracleMoves(withPosition(session.board, last.block, last.from));
    const range = rangeOf(session, last.block);
    let continues = false;
    for (let to = range.min; to <= range.max; to++) {
      if (to === last.from) continue;
      if (oracleMoves(withPosition(session.board, last.block, to)) === before - 1) continues = true;
    }
    expect(putsBack).toBe(!continues);
    if (oracleMoves(session.board) === before - 1) expect(hint.block).not.toBe(last.block);
  });

  it('says so honestly when it cannot help: no way out, or a search cut short', () => {
    const walled: Board = {
      blocks: [
        TARGET_BLOCK,
        { orientation: 'v', length: 3, lane: 5 },
        { orientation: 'v', length: 3, lane: 5 },
      ],
      positions: [0, 0, 3],
    };
    expect(findHint(walled)).toEqual({ kind: 'none', reason: 'unsolvable' });
    expect(findHint(medium.board, 5)).toEqual({ kind: 'none', reason: 'capped' });
    // A limit that admits no board at all is a search cut short, not "no way out".
    expect(findHint(medium.board, 0)).toEqual({ kind: 'none', reason: 'capped' });
    expect(findHint(medium.board, Number.NaN)).toEqual({ kind: 'none', reason: 'capped' });
  });

  it('has nothing to say about a solved board, and refuses a board that is not one', () => {
    const solved = playSolution(easy);
    expect(findHint(solved.board)).toBeNull();
    expect(hintFor(solved)).toBeNull();
    const overlapping: Board = {
      blocks: [TARGET_BLOCK, { orientation: 'v', length: 2, lane: 1 }],
      positions: [0, 2],
    };
    expect(findHint(overlapping)).toEqual({ kind: 'none', reason: 'invalid' });
    // A last move that did not lead to this board.
    const move = firstSlide(easy);
    const after = doSlide(easy, move.block, move.to)!;
    const last = after.moves[0]!;
    expect(findHint(after.board, undefined, { ...last, to: last.from })).toEqual({
      kind: 'none',
      reason: 'invalid',
    });
    expect(findHint(easy.board, undefined, last)).toEqual({ kind: 'none', reason: 'invalid' });
    expect(findHint(after.board, undefined, last)).toEqual(hintFor(after));
  });
});

describe('the dealt-board check and restore (§12)', () => {
  const record = (session: UnblockSession): SessionRecord => ({
    mode: session.mode,
    seed: session.seed,
    difficulty: session.difficulty,
    dailyDate: session.dailyDate,
    start: session.start,
    minMoves: session.minMoves,
    moves: encodeMoves(session.moves),
    elapsedSeconds: session.elapsedSeconds,
    hintCount: session.hintCount,
  });

  it('knows a board this game deals at its difficulty, and nothing else', () => {
    expect(isDealtBoard(easy.start, easy.minMoves, 'easy')).toBe(true);
    expect(isDealtBoard(medium.start, medium.minMoves, 'medium')).toBe(true);
    // The right board with the wrong count, or at the wrong difficulty.
    expect(isDealtBoard(easy.start, easy.minMoves + 1, 'easy')).toBe(false);
    expect(isDealtBoard(easy.start, easy.minMoves, 'hard')).toBe(false);
    // Already solved.
    expect(isDealtBoard(playSolution(easy).board, 0, 'easy')).toBe(false);
  });

  it('restores a game in progress exactly, undo included', () => {
    const move = firstSlide(medium);
    const played = withElapsedSeconds(doHintUse(doSlide(medium, move.block, move.to)!), 12);
    const restored = restoreSession(record(played))!;
    expect(restored).toEqual(played);
    expect(canUndo(restored)).toBe(true);
    expect(doUndo(restored)!.board).toEqual(medium.start);
  });

  it('drops a finished game: a result, not something to resume', () => {
    expect(restoreSession(record(playSolution(easy)))).toBeNull();
    expect(restoreSession(record(playSolution(medium)))).toBeNull();
  });

  it('restores a daily only as the board its date deals', () => {
    const daily = createDailySession('2026-10-17');
    const move = firstSlide(daily);
    const played = doSlide(daily, move.block, move.to)!;
    expect(restoreSession(record(played))).toEqual(played);
    // The right board under another date, or another date's seed.
    const other = createDailySession('2026-10-18');
    expect(
      restoreSession({ ...record(daily), dailyDate: '2026-10-18', seed: dailySeed('2026-10-18') }),
    ).toBeNull();
    expect(restoreSession({ ...record(other), seed: dailySeed('2026-10-17') })).toBeNull();
    // A board that is a fine medium board, just not that day's.
    expect(
      restoreSession({
        ...record(daily),
        start: medium.start,
        minMoves: medium.minMoves,
        moves: '',
      }),
    ).toBeNull();
    expect(restoreSession({ ...record(daily), dailyDate: '2026-02-30' })).toBeNull();
  });

  it('never throws on a malformed record, and drops it', () => {
    const base = record(medium);
    const broken: unknown[] = [
      null,
      undefined,
      42,
      'record',
      [],
      { ...base, difficulty: 'extreme' },
      { ...base, mode: 'weekly' },
      { ...base, seed: '' },
      { ...base, seed: 42 },
      { ...base, seed: 'unblock-puzzle-hard-x' },
      { ...base, seed: 'unblock-puzzle-medium-' },
      { ...base, start: null },
      { ...base, start: 'board' },
      { ...base, start: { blocks: [null], positions: [0] } },
      { ...base, start: { blocks: base.start.blocks, positions: null } },
      { ...base, start: { blocks: base.start.blocks, positions: ['0'] } },
      { ...base, minMoves: 0 },
      { ...base, minMoves: Number.NaN },
      { ...base, minMoves: '12' },
      { ...base, moves: 42 },
      { ...base, moves: null },
      { ...base, elapsedSeconds: Number.NaN },
      { ...base, elapsedSeconds: -5 },
      { ...base, elapsedSeconds: 1.5 },
      { ...base, elapsedSeconds: Number.POSITIVE_INFINITY },
      { ...base, hintCount: -1.5 },
      { ...base, hintCount: '1' },
      { ...base, dailyDate: undefined },
      { ...base, mode: 'daily', dailyDate: 20261017 },
    ];
    for (const value of broken) {
      expect(() => restoreSession(value as SessionRecord), JSON.stringify(value)).not.toThrow();
      expect(restoreSession(value as SessionRecord), JSON.stringify(value)).toBeNull();
    }
  });

  it('drops a record play could not have produced', () => {
    const base = record(medium);
    expect(restoreSession({ ...base, minMoves: base.minMoves - 1 })).toBeNull();
    expect(restoreSession({ ...base, difficulty: 'hard' })).toBeNull();
    expect(
      restoreSession({ ...base, mode: 'daily', dailyDate: '2026-10-17', difficulty: 'easy' }),
    ).toBeNull();
    expect(restoreSession({ ...base, dailyDate: '2026-10-17' })).toBeNull();
    expect(restoreSession({ ...base, mode: 'daily' })).toBeNull();
    expect(restoreSession({ ...base, moves: 'z9' })).toBeNull();
    expect(
      restoreSession({
        ...base,
        start: { ...base.start, positions: base.start.positions.map(() => 0) },
      }),
    ).toBeNull();
  });

  it('does not measure the component: a crafted board no deal would give passes (§6, §12)', () => {
    // From the independent verification: an Easy board in the tier (4 fewest moves, 494 boards
    // explored, 10 blocks) whose component holds more than 21,000 boards. A deal lists the
    // component and never gives it; the load check only searches forward from the start, so the
    // record loads. Every board of the component is solvable, so a Hint there can be cut short
    // (capped) but never says "no solution". If the load check ever lists the component, change
    // this test and §6 / §12 together.
    const start = decodeBoard('b.cc..bd.eee.daafghiiifghjj..g...kkk')!;
    expect(exploreComponent(start, COMPONENT_LIMIT).status).toBe('capped');
    expect(isDealtBoard(start, 4, 'easy')).toBe(true);
    const restored = restoreSession({
      mode: 'free',
      seed: 'unblock-puzzle-easy-crafted',
      difficulty: 'easy',
      dailyDate: null,
      start,
      minMoves: 4,
      moves: '',
      elapsedSeconds: 0,
      hintCount: 0,
    });
    expect(restored?.board).toEqual(start);
    expect(hintFor(restored!)?.kind).toBe('move');
  });
});

describe('the clock and the calendar (§10)', () => {
  it('only ever moves the clock forward', () => {
    const session = withElapsedSeconds(easy, 30.7);
    expect(session.elapsedSeconds).toBe(30);
    expect(withElapsedSeconds(session, 10).elapsedSeconds).toBe(30);
    expect(withElapsedSeconds(session, 30)).toBe(session);
  });

  it('ignores a clock reading that is not a number of seconds, and heals a held one', () => {
    const session = withElapsedSeconds(easy, 30);
    for (const bad of [Number.NaN, -5, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(withElapsedSeconds(session, bad)).toBe(session);
    }
    const poisoned: UnblockSession = { ...session, elapsedSeconds: Number.NaN };
    expect(withElapsedSeconds(poisoned, 31).elapsedSeconds).toBe(31);
    expect(withElapsedSeconds(poisoned, Number.NaN).elapsedSeconds).toBe(0);
  });

  it('walks local dates without skipping a day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayDifference('2026-10-01', '2026-11-01')).toBe(31);
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
