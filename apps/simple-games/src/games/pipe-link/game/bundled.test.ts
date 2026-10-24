/**
 * The 72 bundled fallback boards of docs/PIPE_LINK_RULES.md §4 step 6,
 * proven rather than trusted: each one is what this generator makes from its
 * seed, has exactly one solution by both the counter and the independent
 * search of test-helpers.ts, grades into its own tier, carries an acceptable
 * scramble, and is solved from that scramble by hints alone without the
 * hint ever reaching its answer stage (§6).
 */
import { describe, expect, it } from 'vitest';
import { isSolved } from './board';
import { BUNDLED_BOARDS, decodeBundled } from './bundled';
import {
  TIERS,
  attemptCandidate,
  bundledPuzzle,
  isAcceptableScramble,
  meetsTier,
} from './generator';
import { findHint } from './hint';
import { encodeOrientations, encodeTypes } from './serialize';
import { countSolutions, solve } from './solver';
import { rotateCw } from './tiles';
import { independentCount } from './test-helpers';
import { DIFFICULTIES, PRESETS } from './types';

describe('bundled boards (§4 step 6)', () => {
  let maxIndependentNodes = 0;
  let maxHintWork = 0;
  let hints = 0;
  for (const difficulty of DIFFICULTIES) {
    const preset = PRESETS[difficulty];
    it(`${difficulty}: 24 boards, each its seed's own, unique twice over, in its tier, hint-solvable`, () => {
      const boards = BUNDLED_BOARDS[difficulty];
      expect(boards).toHaveLength(24);
      expect(new Set(boards.map((b) => b.types + b.source)).size).toBe(24);
      for (const entry of boards) {
        // Provenance: the generator still makes exactly this board from this seed.
        const made = attemptCandidate(entry.seed, difficulty);
        expect(made.outcome, entry.seed).toBe('shipped');
        const c = made.candidate!;
        expect(encodeTypes(c.board.types), entry.seed).toBe(entry.types);
        expect(c.board.source).toBe(entry.source);
        expect(encodeOrientations(c.solution)).toBe(entry.solution);
        expect(encodeOrientations(made.initial!)).toBe(entry.initial);
        expect(c.level).toBe(entry.level);
        expect(c.l1Open).toBe(entry.l1Open);

        const { board, solution, initial } = decodeBundled(difficulty, entry);
        expect(isSolved(board, solution)).toBe(true);
        // Unique by the counter and by the independent search.
        const count = countSolutions(board);
        expect(count, entry.seed).toMatchObject({ count: 1, complete: true });
        const independent = independentCount(preset.width, preset.height, entry.types.split(''));
        expect(independent.complete).toBe(true);
        expect(independent.count, entry.seed).toBe(1);
        expect(independent.solutions[0]).toEqual(solution);
        maxIndependentNodes = Math.max(maxIndependentNodes, independent.nodes);
        // Re-graded into its tier; an acceptable scramble.
        const techniques = solve(board);
        expect(techniques.status).toBe('solved');
        maxHintWork = Math.max(maxHintWork, techniques.work);
        const regraded = {
          board,
          solution,
          level: techniques.level,
          l1Open: techniques.stageOf.filter((s) => s >= 2).length,
          status: techniques.status,
          solveWork: techniques.work,
        };
        expect(meetsTier(regraded, TIERS[difficulty]), entry.seed).toBe(true);
        expect(isAcceptableScramble(board, solution, initial)).toBe(true);
        // Hints alone, from the scramble: always a technique hint, always a wrong tile, always the answer.
        const current = [...initial];
        for (let step = 0; !isSolved(board, current); step++) {
          expect(step, entry.seed).toBeLessThan(current.length);
          const hint = findHint(board, solution, current, techniques)!;
          expect(hint.kind, entry.seed).toBe('technique');
          expect(current[hint.cell]).not.toBe(solution[hint.cell]);
          expect(hint.orientation).toBe(solution[hint.cell]);
          while (current[hint.cell] !== hint.orientation) {
            current[hint.cell] = rotateCw(board.types[hint.cell]!, current[hint.cell]!);
          }
          hints++;
        }
        expect(current).toEqual(solution);
      }
    });
  }

  it('picks a board by the seed’s hash, the same one every time', () => {
    for (const difficulty of DIFFICULTIES) {
      const a = bundledPuzzle('some-seed', difficulty);
      const b = bundledPuzzle('some-seed', difficulty);
      expect(a).toEqual(b);
      expect(a.fallback).toBe(true);
    }
    console.log(
      `[pipe-link] bundled: 72 boards, independent search ≤ ${maxIndependentNodes} nodes, ` +
        `technique work ≤ ${maxHintWork}, ${hints} hints walked, all at the technique stage`,
    );
  });
});
