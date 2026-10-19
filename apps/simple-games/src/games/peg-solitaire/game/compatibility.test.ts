/**
 * What must never change silently (docs/PEG_SOLITAIRE_RULES.md §1, §8, §11).
 *
 * A save names holes by index and replays jumps by index, so the order of
 * the holes is part of every saved game: reorder them and a resumed game
 * replays different jumps — or, worse, still-legal different jumps. The jump
 * table's order is what the solver searches in. The problem table and the
 * deal decide which board a seed is: "Retry" and a resumed game rest on
 * the same problem coming back.
 *
 * This pins behaviour; do not edit these strings to go green. If a change is
 * intended, it is a schema change (§11): during the web beta it may reset
 * saves only with the notice WEB_VERSION.md「先行公開」requires, and after
 * graduation it needs a migration. Say so in the commit message.
 */
import { describe, expect, it } from 'vitest';
import { ENGLISH, ENGLISH_CENTER, TRIANGLE, type BoardGeometry } from './boards';
import { parseEnglishJumps, TRIANGLE_APEX_PERFECT_LAST, TRIANGLE_APEX_PREFIX } from './fixtures';
import { ENGLISH_PROBLEM, TRIANGLE_PROBLEMS, dealProblem, dealSeed, findProblem } from './problems';
import { applyMove, createSession, toRecord, undo } from './session';

const holeOrder = (geometry: BoardGeometry) =>
  geometry.holes.map((hole) => `${hole.row}${hole.col}`).join(' ');
const jumpOrder = (geometry: BoardGeometry) =>
  geometry.jumps.map((jump) => `${jump.from}>${jump.over}>${jump.to}`).join(' ');

describe('board layouts that must never change (§1)', () => {
  it('numbers the cross’s holes row by row from the top left', () => {
    expect(holeOrder(ENGLISH)).toBe(
      '02 03 04 12 13 14 20 21 22 23 24 25 26 30 31 32 33 34 35 36 40 41 42 43 44 45 46 52 53 54 62 63 64',
    );
    expect(ENGLISH_CENTER).toBe(16);
  });

  it('numbers the triangle’s holes row by row from the apex', () => {
    expect(holeOrder(TRIANGLE)).toBe('00 10 11 20 21 22 30 31 32 33 40 41 42 43 44');
  });

  it('lists the triangle’s jumps in the same order', () => {
    expect(jumpOrder(TRIANGLE)).toBe(
      '0>2>5 0>1>3 1>4>8 1>3>6 2>5>9 2>4>7 3>1>0 3>4>5 3>7>12 3>6>10 4>8>13 4>7>11 ' +
        '5>2>0 5>9>14 5>8>12 5>4>3 6>3>1 6>7>8 7>4>2 7>8>9 8>4>1 8>7>6 9>5>2 9>8>7 ' +
        '10>6>3 10>11>12 11>7>4 11>12>13 12>7>3 12>8>5 12>13>14 12>11>10 13>8>4 ' +
        '13>12>11 14>9>5 14>13>12',
    );
  });

  it('lists the cross’s jumps in the same order', () => {
    expect(jumpOrder(ENGLISH)).toBe(
      '0>1>2 0>3>8 1>4>9 2>5>10 2>1>0 3>4>5 3>8>15 4>9>16 5>10>17 5>4>3 6>7>8 6>13>20 ' +
        '7>8>9 7>14>21 8>3>0 8>9>10 8>15>22 8>7>6 9>4>1 9>10>11 9>16>23 9>8>7 10>5>2 ' +
        '10>11>12 10>17>24 10>9>8 11>18>25 11>10>9 12>19>26 12>11>10 13>14>15 14>15>16 ' +
        '15>8>3 15>16>17 15>22>27 15>14>13 16>9>4 16>17>18 16>23>28 16>15>14 17>10>5 ' +
        '17>18>19 17>24>29 17>16>15 18>17>16 19>18>17 20>13>6 20>21>22 21>14>7 21>22>23 ' +
        '22>15>8 22>23>24 22>27>30 22>21>20 23>16>9 23>24>25 23>28>31 23>22>21 24>17>10 ' +
        '24>25>26 24>29>32 24>23>22 25>18>11 25>24>23 26>19>12 26>25>24 27>22>15 ' +
        '27>28>29 28>23>16 29>24>17 29>28>27 30>27>22 30>31>32 31>28>23 32>29>24 32>31>30',
    );
  });
});

describe('problems that must never change (§8)', () => {
  it('deals the cross its standard problem', () => {
    expect(ENGLISH_PROBLEM).toEqual({ kind: 'english', start: 16, target: 16 });
  });

  it('keeps the triangle’s 54 problems', () => {
    expect(TRIANGLE_PROBLEMS.map((p) => `${p.start}>${p.target}`).join(' ')).toBe(
      '0>0 0>6 0>9 0>12 1>1 1>5 1>10 1>13 2>2 2>3 2>11 2>14 3>2 3>3 3>8 3>11 3>14 ' +
        '4>12 5>1 5>5 5>7 5>10 5>13 6>0 6>6 6>9 6>12 7>5 8>3 9>0 9>6 9>9 9>12 ' +
        '10>1 10>5 10>10 10>13 11>2 11>3 11>11 11>14 12>0 12>4 12>6 12>9 12>12 ' +
        '13>1 13>5 13>10 13>13 14>2 14>3 14>11 14>14',
    );
  });

  // One case per seed (issue #158): each deal stands on its own.
  const GOLDEN: Record<string, { deal: string; avoidingFirst: string }> = {
    'golden-a': { deal: '0>6', avoidingFirst: '0>9' },
    'golden-b': { deal: '1>13', avoidingFirst: '2>2' },
    'golden-c': { deal: '3>3', avoidingFirst: '3>8' },
    'golden-d': { deal: '4>12', avoidingFirst: '4>12' },
    'golden-e': { deal: '12>0', avoidingFirst: '12>0' },
    'golden-f': { deal: '14>3', avoidingFirst: '14>3' },
  };
  for (const [token, expected] of Object.entries(GOLDEN)) {
    it(`deals the same triangle problem for ${token}`, () => {
      const seed = dealSeed('triangle', token);
      expect(seed).toBe(`peg-solitaire-triangle-${token}`);
      const show = (p: { start: number; target: number }) => `${p.start}>${p.target}`;
      expect(show(dealProblem('triangle', seed))).toBe(expected.deal);
      expect(show(dealProblem('triangle', seed, TRIANGLE_PROBLEMS[0]))).toBe(
        expected.avoidingFirst,
      );
    });
  }
});

describe('the save record that must never change (§11)', () => {
  it('writes a game as its problem, its jumps as [from, to], and its clock', () => {
    let session = createSession(ENGLISH_PROBLEM);
    for (const [from, to] of parseEnglishJumps('d2-d4 f3-d3 e1-e3')) {
      session = applyMove(session, from, to)!;
    }
    expect(JSON.stringify(toRecord({ ...session, elapsedSeconds: 61 }))).toBe(
      '{"board":"english","start":16,"target":16,"jumps":[[4,16],[11,9],[2,10]],"elapsedSeconds":61}',
    );
  });

  it('adds `cleared: true`, last, only for a game whose perfect clear was undone (§10)', () => {
    let session = createSession(findProblem('triangle', 0, 0)!);
    for (const [from, to] of [...TRIANGLE_APEX_PREFIX, TRIANGLE_APEX_PERFECT_LAST]) {
      session = applyMove(session, from, to)!;
    }
    expect(session.outcome?.kind).toBe('perfect');
    expect(JSON.stringify(toRecord({ ...undo(session)!, elapsedSeconds: 61 }))).toBe(
      '{"board":"triangle","start":0,"target":0,"jumps":[[3,0],[5,3],[0,5],[6,1],[9,2],[11,4],[13,11],[10,12],[12,5],[2,9],[14,5],[5,3]],"elapsedSeconds":61,"cleared":true}',
    );
  });
});
