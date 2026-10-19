/**
 * Session rules of docs/BRIDGES_RULES.md §3, §4, §8–§10: what a tap does to
 * a session, what undo takes back, what the hint answers, the two ways a
 * session comes into being, and the saved record — round trip and every
 * fail-closed refusal.
 */
import { describe, expect, it } from 'vitest';
import { addDays, dailySeed, dayDifference, localDateString } from './daily';
import { buildGraph, edgeBetween, isSolved } from './engine';
import { SEARCH_NODE_LIMIT, countSolutions } from './solver';
import {
  UNDO_HISTORY_LIMIT,
  candidatesFor,
  canUndo,
  createDailySession,
  createDifficultySession,
  difficultySeed,
  doConnect,
  doCycle,
  doHintUse,
  doUndo,
  factsOf,
  fromRecord,
  hintFor,
  newSeedToken,
  restartSession,
  toRecord,
  withElapsedSeconds,
  type BridgesSession,
} from './session';
import { decodeBoard } from './serialize';
import { PRESETS } from './types';

/** Builds the answer edge by edge, with the taps a player would make. */
function solveByTapping(session: BridgesSession): BridgesSession {
  let current = session;
  session.solution.forEach((count, edge) => {
    for (let tap = 0; tap < count; tap++) current = doCycle(current, edge) ?? current;
  });
  return current;
}

/** The first edge the answer leaves empty. */
const emptyEdge = (session: BridgesSession): number =>
  session.solution.findIndex((count) => count === 0);

describe('sessions (§8)', () => {
  it('creates a difficulty session sized by its preset, with nothing built', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `bridges-${difficulty}-test`);
      expect(session.mode).toBe('difficulty');
      expect([session.width, session.height]).toEqual([
        PRESETS[difficulty].width,
        PRESETS[difficulty].height,
      ]);
      expect(session.bridges.every((count) => count === 0)).toBe(true);
      expect(session.bridges).toHaveLength(session.graph.edges.length);
      expect(session.status).toBe('playing');
    }
  });

  it('seeds difficulty games per token, and the daily per date, medium every day', () => {
    expect(difficultySeed('medium', 'abc')).toBe('bridges-medium-abc');
    expect(dailySeed('2026-10-17')).toBe('bridges-daily-2026-10-17');
    const daily = createDailySession('2026-10-18');
    expect(daily.mode).toBe('daily');
    expect(daily.difficulty).toBe('medium');
    expect(daily.dailyDate).toBe('2026-10-18');
    expect(daily.seed).toBe('bridges-daily-2026-10-18');
    expect(newSeedToken(0, () => 0)).toBe('0-0');
  });

  it('gives the same board for the same seed', () => {
    const a = createDifficultySession('hard', 'bridges-hard-same');
    const b = createDifficultySession('hard', 'bridges-hard-same');
    expect(a.islands).toEqual(b.islands);
    expect(a.solution).toEqual(b.solution);
  });

  it('restarts the same board clean', () => {
    const session = createDifficultySession('easy', 'bridges-easy-test');
    const played = doHintUse(withElapsedSeconds(doCycle(session, 0)!, 40));
    const again = restartSession(played);
    expect(again.islands).toEqual(session.islands);
    expect(again.bridges).toEqual(session.bridges);
    expect(again.history).toEqual([]);
    expect([again.hintCount, again.elapsedSeconds]).toEqual([0, 0]);
  });
});

describe('tapping (§4)', () => {
  it('cycles one pair 0 → 1 → 2 → 0', () => {
    const session = createDifficultySession('easy', 'bridges-easy-test');
    const one = doCycle(session, 0)!;
    const two = doCycle(one, 0)!;
    const none = doCycle(two, 0)!;
    expect([one.bridges[0], two.bridges[0], none.bridges[0]]).toEqual([1, 2, 0]);
  });

  it('joins two islands by their ordinals, and refuses two that do not see each other', () => {
    const session = createDifficultySession('easy', 'bridges-easy-test');
    const edge = session.graph.edges[0]!;
    expect(doConnect(session, edge.a, edge.b)!.bridges[0]).toBe(1);
    expect(doConnect(session, edge.b, edge.a)!.bridges[0]).toBe(1);
    // An island never sees itself; find a pair with no edge between them.
    expect(doConnect(session, 0, 0)).toBeNull();
    const islands = session.islands.length;
    let unseen: [number, number] | null = null;
    for (let a = 0; a < islands && unseen === null; a++) {
      for (let b = a + 1; b < islands; b++) {
        if (edgeBetween(session.graph, a, b) === -1) {
          unseen = [a, b];
          break;
        }
      }
    }
    expect(unseen).not.toBeNull();
    expect(doConnect(session, ...unseen!)).toBeNull();
  });

  it('refuses an edge id that is not one, and records nothing for it', () => {
    const session = createDifficultySession('easy', 'bridges-easy-test');
    for (const id of [Number.NaN, 1.5, -1, session.graph.edges.length, null]) {
      expect(doCycle(session, id as number), String(id)).toBeNull();
    }
    expect(session.history).toEqual([]);
    expect(Object.keys(session.bridges)).toHaveLength(session.graph.edges.length);
  });

  it('refuses an edge a crossing bridge blocks, and records nothing for it', () => {
    const session = createDifficultySession('hard', 'bridges-hard-test');
    const crossed = session.graph.crossings.findIndex((list) => list.length > 0);
    expect(crossed).toBeGreaterThanOrEqual(0);
    const built = doCycle(session, crossed)!;
    const blocker = session.graph.crossings[crossed]![0]!;
    expect(doCycle(built, blocker)).toBeNull();
    expect(candidatesFor(built, session.graph.edges[blocker]!.a).map((c) => c.edge)).not.toContain(
      blocker,
    );
  });

  it('solves on the last bridge of the answer, and refuses every move after', () => {
    const session = createDifficultySession('medium', 'bridges-medium-test');
    const solved = solveByTapping(session);
    expect(solved.status).toBe('solved');
    expect(isSolved(solved.graph, solved.bridges)).toBe(true);
    expect(factsOf(solved)).toMatchObject({ allNumbersMet: true, groups: 1 });
    expect(doCycle(solved, 0)).toBeNull();
    expect(canUndo(solved)).toBe(false);
    expect(doUndo(solved)).toBeNull();
    expect(hintFor(solved)).toBeNull();
  });

  it('shows an island over its number, without refusing the tap', () => {
    const session = createDifficultySession('easy', 'bridges-easy-test');
    const one = session.islands.findIndex((island) => island.value === 1);
    expect(one).toBeGreaterThanOrEqual(0);
    const edge = session.graph.islandEdges[one]![0]!;
    const single = doCycle(session, edge)!;
    expect(factsOf(single).states[one]).toBe('complete');
    const double = doCycle(single, edge)!;
    expect(double.bridges[edge]).toBe(2);
    expect(factsOf(double).states[one]).toBe('over');
    expect(double.status).toBe('playing');
  });
});

describe('undo (§9)', () => {
  it('takes back one tap at a time, and never the hint count', () => {
    const session = createDifficultySession('easy', 'bridges-easy-test');
    const one = doCycle(session, 0)!;
    const two = doHintUse(doCycle(one, 1)!);
    const back = doUndo(two)!;
    expect(back.bridges).toEqual(one.bridges);
    expect(back.hintCount).toBe(1);
    const start = doUndo(back)!;
    expect(start.bridges).toEqual(session.bridges);
    expect(canUndo(start)).toBe(false);
    expect(doUndo(start)).toBeNull();
  });

  it('keeps at most the history limit', () => {
    let session = createDifficultySession('easy', 'bridges-easy-test');
    for (let i = 0; i < UNDO_HISTORY_LIMIT + 5; i++) session = doCycle(session, 0) ?? session;
    expect(session.history.length).toBe(UNDO_HISTORY_LIMIT);
  });
});

describe('hints (§9)', () => {
  it('names a bridge over the answer before anything else, and a step otherwise', () => {
    const session = createDifficultySession('easy', 'bridges-easy-test');
    const step = hintFor(session);
    expect(step?.kind).toBe('step');
    const edge = emptyEdge(session);
    const wrong = doCycle(session, edge);
    if (wrong !== null) expect(hintFor(wrong)).toMatchObject({ kind: 'wrong', edge });
  });

  it('never writes to the board, and is counted only when used', () => {
    const session = createDifficultySession('medium', 'bridges-medium-test');
    hintFor(session);
    expect(session.bridges.every((count) => count === 0)).toBe(true);
    expect(session.hintCount).toBe(0);
    expect(doHintUse(doHintUse(session)).hintCount).toBe(2);
  });

  it('takes a player from an empty board to the win, one proven bridge at a time', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      let session = createDifficultySession(difficulty, `bridges-${difficulty}-hinted`);
      for (let guard = 0; session.status === 'playing' && guard < 200; guard++) {
        const hint = hintFor(session);
        expect(hint?.kind, difficulty).toBe('step');
        if (hint?.kind !== 'step') break;
        while (session.bridges[hint.edge]! < hint.atLeast) session = doCycle(session, hint.edge)!;
      }
      expect(session.status, difficulty).toBe('solved');
    }
  });
});

describe('the clock and the calendar (§8, §11)', () => {
  it('only ever moves the clock forward', () => {
    const session = withElapsedSeconds(createDailySession('2026-10-19'), 30.7);
    expect(session.elapsedSeconds).toBe(30);
    expect(withElapsedSeconds(session, 10).elapsedSeconds).toBe(30);
  });

  it('ignores a clock that is not a number, and stops at the record’s ceiling', () => {
    const session = withElapsedSeconds(doCycle(createDailySession('2026-10-19'), 0)!, 30);
    for (const bad of [Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(withElapsedSeconds(session, bad), String(bad)).toBe(session);
    }
    const long = withElapsedSeconds(session, 1e12);
    expect(long.elapsedSeconds).toBe(1e9);
    // Either way the game stays one the record can hold and give back.
    expect(fromRecord(toRecord(long))?.elapsedSeconds).toBe(1e9);
    expect(fromRecord(toRecord(withElapsedSeconds(session, Number.NaN)))?.elapsedSeconds).toBe(30);
  });

  it('walks local dates without skipping a day', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(dayDifference('2026-10-01', '2026-11-01')).toBe(31);
    expect(localDateString(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('the saved record (§10)', () => {
  const playing = () => {
    const session = createDifficultySession('medium', 'bridges-medium-record');
    return doHintUse(withElapsedSeconds(doCycle(session, 0)!, 75));
  };

  it('round-trips a difficulty game and a daily, history aside', () => {
    const session = playing();
    const restored = fromRecord(toRecord(session))!;
    expect(restored).not.toBeNull();
    const { history: _a, graph: _b, ...expected } = session;
    const { history, graph, ...actual } = restored;
    expect(actual).toEqual({
      ...expected,
      solution: [...expected.solution],
      bridges: [...expected.bridges],
    });
    expect(history).toEqual([]);
    expect(graph.edges).toEqual(session.graph.edges);
    const daily = doCycle(createDailySession('2026-10-17'), 1)!;
    expect(fromRecord(toRecord(daily))?.dailyDate).toBe('2026-10-17');
  });

  it('drops a record that is not an object, or names a mode, difficulty or seed it cannot be', () => {
    const record = toRecord(playing());
    expect(fromRecord(null)).toBeNull();
    expect(fromRecord('save')).toBeNull();
    expect(fromRecord({ ...record, mode: 'endless' })).toBeNull();
    expect(fromRecord({ ...record, difficulty: 'expert' })).toBeNull();
    expect(fromRecord({ ...record, seed: '' })).toBeNull();
    expect(fromRecord({ ...record, seed: 7 })).toBeNull();
    expect(fromRecord({ ...record, seed: 'x'.repeat(201) })).toBeNull();
    expect(fromRecord({ ...record, dailyDate: '2026-10-17' })).toBeNull();
  });

  it('drops a daily without a date, or one that is not medium', () => {
    const daily = toRecord(doCycle(createDailySession('2026-10-17'), 1)!);
    expect(fromRecord({ ...daily, dailyDate: null })).toBeNull();
    expect(fromRecord({ ...daily, dailyDate: '17/10/2026' })).toBeNull();
    const easy = toRecord(doCycle(createDifficultySession('easy', 'bridges-easy-test'), 0)!);
    expect(fromRecord({ ...easy, mode: 'daily', dailyDate: '2026-10-17' })).toBeNull();
  });

  it('drops counters that are not whole, non-negative numbers', () => {
    const record = toRecord(playing());
    expect(fromRecord({ ...record, hintCount: -1 })).toBeNull();
    expect(fromRecord({ ...record, hintCount: 1.5 })).toBeNull();
    expect(fromRecord({ ...record, elapsedSeconds: '75' })).toBeNull();
    expect(fromRecord({ ...record, elapsedSeconds: 2e9 })).toBeNull();
  });

  it('drops a size that is not the difficulty’s, and a corrupt board, answer or bridges', () => {
    const record = toRecord(playing());
    expect(fromRecord({ ...record, width: 10 })).toBeNull();
    expect(fromRecord({ ...record, difficulty: 'hard' })).toBeNull();
    expect(fromRecord({ ...record, board: record.board.slice(1) })).toBeNull();
    expect(fromRecord({ ...record, board: record.board.replace(/[1-8]/, '9') })).toBeNull();
    expect(fromRecord({ ...record, solution: record.solution.replace('1', '0') })).toBeNull();
    expect(fromRecord({ ...record, bridges: record.bridges.slice(1) })).toBeNull();
    expect(fromRecord({ ...record, bridges: '3' + record.bridges.slice(1) })).toBeNull();
  });

  it('drops bridges that cross', () => {
    const session = createDifficultySession('hard', 'bridges-hard-test');
    const crossed = session.graph.crossings.findIndex((list) => list.length > 0);
    const other = session.graph.crossings[crossed]![0]!;
    const bridges = session.bridges.map((_, edge) => (edge === crossed || edge === other ? 1 : 0));
    expect(fromRecord({ ...toRecord(session), bridges: bridges.join('') })).toBeNull();
  });

  it('drops a finished game: it is history, not a game to resume', () => {
    const solved = solveByTapping(createDifficultySession('easy', 'bridges-easy-test'));
    expect(solved.status).toBe('solved');
    expect(fromRecord(toRecord(solved))).toBeNull();
  });

  it('drops a board with more than one answer, or with an island count outside its tier', () => {
    // A legal 7×7 board with a winning answer — but two answers (found by
    // `buildCandidate('bridges-multi-2', …)`, which the generator rejects).
    const board = '........2..5.4.....1.........3..2........2.4...3.';
    const layout = decodeBoard(board, 7, 7)!;
    const graph = buildGraph(layout);
    expect(countSolutions(layout)).toMatchObject({ solutions: 2, complete: true });
    const base = toRecord(createDifficultySession('easy', 'bridges-easy-test'));
    const record = {
      ...base,
      board,
      solution: '112221022',
      bridges: '0'.repeat(graph.edges.length),
    };
    expect(isSolved(graph, [1, 1, 2, 2, 2, 1, 0, 2, 2])).toBe(true);
    expect(fromRecord(record)).toBeNull();
    // A board of the right size with one answer — but four islands, below
    // the eight an easy board carries.
    const small = '1.1....' + '.......' + '2.2....' + '.'.repeat(28);
    const smallLayout = decodeBoard(small, 7, 7)!;
    expect(countSolutions(smallLayout)).toMatchObject({ solutions: 1, complete: true });
    expect(fromRecord({ ...base, board: small, solution: '0111', bridges: '0000' })).toBeNull();
  });

  it('drops a board whose answer the counter cannot prove within its node cap', () => {
    // A crafted 10×10 lattice of 23 islands with a winning answer: the
    // counter needs 555 nodes to find its second answer, past the cap of
    // SEARCH_NODE_LIMIT — an unfinished count proves nothing, so the record
    // goes (§10). No shipped board comes near the cap (§6).
    const board =
      '1.4.3.2.2.' +
      '..........' +
      '..3.2.2.3.' +
      '..........' +
      '2.3.3.3.2.' +
      '..........' +
      '2.5.4.3.2.' +
      '..........' +
      '..3.3.2.1.' +
      '..........';
    const solution = '101211101010111111011110011211111110';
    const layout = decodeBoard(board, 10, 10)!;
    const graph = buildGraph(layout);
    expect(isSolved(graph, solution.split('').map(Number))).toBe(true);
    expect(countSolutions(layout, 2, SEARCH_NODE_LIMIT, graph).complete).toBe(false);
    expect(countSolutions(layout, 2, 10_000, graph)).toMatchObject({
      solutions: 2,
      complete: true,
    });
    const base = toRecord(createDifficultySession('hard', 'bridges-hard-test'));
    const record = { ...base, board, solution, bridges: '0'.repeat(graph.edges.length) };
    expect(fromRecord(record)).toBeNull();
  });
});
