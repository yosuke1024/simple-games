/**
 * Golden boards, v2: fixed seeds, exact strings.
 *
 * A seed is a promise. A daily is the same board for everyone, and a player's
 * suspended game or best time only means something if the board it was set
 * on still exists. Any change to the rng, to the crown search, to the region
 * growth, to the repair, or to the technique set that moves a board will fail
 * here, which is the point: changing these strings is a decision, not a side
 * effect. The beta channel allows a schema change — never a silent one
 * (docs/WEB_VERSION.md「先行公開」).
 *
 * v1 → v2 was such a decision (§8, MIN_REGION_SIZE). Most v1 boards had a
 * region of a single cell — a crown handed over before the player read
 * anything — so growth now starts every region at two cells and repair never
 * thins one below that, and every board moved on purpose while the game is in
 * beta. What it costs: a game suspended on a v1 board still restores, because
 * the save holds its regions verbatim and a v1 board is still unique (§11), but
 * Retry and every daily now build the v2 board for the same seed, so a daily
 * already cleared on v1 shows a different board if reopened. The save format
 * below did not change and is still v1: only the boards a seed builds moved.
 *
 * **Fix the implementation, not the test.** A saved game holds the region and
 * solution strings verbatim (§11), so a change to the encoding strands every
 * game in progress. If a change here is intended, regenerate the strings and
 * say so in the commit message, along with what it costs existing players.
 */
import { describe, expect, it } from 'vitest';
import { isSolved, marksOf } from './engine';
import { decodeBoards, encodeMarks, encodeRegions, encodeSolution } from './serialize';
import { createDailySession, createDifficultySession, doMarkCross, doTap } from './session';
import { countSolutions, grade } from './solver';

describe('golden puzzles (v2)', () => {
  it('the easy board for a fixed seed — the 6×6 — is unchanged', () => {
    const session = createDifficultySession('easy', 'crown-grid-easy-golden');
    expect(session.size).toBe(6);
    expect(encodeRegions(session.regions)).toBe(
      'bbbaac' + 'bbbccc' + 'ebbdcc' + 'ebbdff' + 'ebffff' + 'bbffff',
    );
    expect(encodeSolution(session.solution)).toBe('415302');
  });

  it('the medium board for a fixed seed — the 8×8 — is unchanged', () => {
    const session = createDifficultySession('medium', 'crown-grid-medium-golden');
    expect(session.size).toBe(8);
    expect(encodeRegions(session.regions)).toBe(
      'daaaabbb' +
        'ddacbbbb' +
        'ddccfbbb' +
        'fdffffee' +
        'ffffffhe' +
        'ffggffhh' +
        'gggffffh' +
        'gggfffhh',
    );
    expect(encodeSolution(session.solution)).toBe('25317406');
  });

  it('the hard board for a fixed seed — the 9×9 — is unchanged', () => {
    const session = createDifficultySession('hard', 'crown-grid-hard-golden');
    expect(session.size).toBe(9);
    expect(encodeRegions(session.regions)).toBe(
      'dbbbbaaaa' +
        'dddbbcccc' +
        'ddddbbbce' +
        'iidddbbce' +
        'idddddeee' +
        'iiddddffe' +
        'igghhffee' +
        'iiiihfeeh' +
        'iiiihhhhh',
    );
    expect(encodeSolution(session.solution)).toBe('537286140');
  });

  it('the daily for 2026-08-01 is unchanged', () => {
    const session = createDailySession('2026-08-01');
    expect(session.size).toBe(8);
    expect(encodeRegions(session.regions)).toBe(
      'bbaaaaaa' +
        'baafaaca' +
        'baafaacc' +
        'bdfffhhh' +
        'bdfffeeh' +
        'ggggffhh' +
        'gggghhhh' +
        'gghhhhhh',
    );
    expect(encodeSolution(session.solution)).toBe('30716425');
  });

  /**
   * The tier a golden board grades at is the difficulty curve of §7 made
   * concrete, and its uniqueness is the promise of §8. Pinned here because a
   * grader that drifted would quietly retire the meaning of the three buttons.
   */
  it('ships boards that are unique and grade at their tier', () => {
    for (const difficulty of ['easy', 'medium', 'hard'] as const) {
      const session = createDifficultySession(difficulty, `crown-grid-${difficulty}-golden`);
      expect(countSolutions(session.regions, session.size), difficulty).toBe(1);
      expect(grade(session.regions, session.size).tier, difficulty).toBe(difficulty);
      expect(isSolved(marksOf(session.solution, session.size), session.regions, session.size)).toBe(
        true,
      );
    }
    const daily = createDailySession('2026-08-01');
    expect(grade(daily.regions, daily.size).tier).toBe('medium');
  });
});

/**
 * The save format of §11, v1: regions and marks as one character per cell,
 * the solution as one digit per row, plus the counters.
 */
describe('the saved game format (v1)', () => {
  it('writes the three strings a save holds', () => {
    let session = createDifficultySession('easy', 'crown-grid-easy-golden');
    session = doTap(session, 2)!; // a cross
    session = doTap(doTap(session, 3)!, 3)!; // a crown, two taps around
    session = doMarkCross(session, [4, 5])!; // a stroke

    expect(encodeMarks(session.marks)).toBe('..xqxx' + '.'.repeat(30));
  });

  it('reads back exactly what it wrote', () => {
    const session = doTap(createDifficultySession('easy', 'crown-grid-easy-golden'), 2)!;
    const decoded = decodeBoards(
      {
        regions: encodeRegions(session.regions),
        solution: encodeSolution(session.solution),
        marks: encodeMarks(session.marks),
      },
      session.size,
    );
    expect(decoded?.regions).toEqual([...session.regions]);
    expect(decoded?.solution).toEqual([...session.solution]);
    expect(decoded?.marks).toEqual([...session.marks]);
  });
});
