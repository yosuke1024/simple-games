/**
 * The solver's contract (docs/PEG_SOLITAIRE_RULES.md §8, §14): an answer it
 * calls solved replays through the rules to one peg in the target; an
 * exhausted search is a proof; a search stopped by the node limit says so
 * ('capped') and never pretends to be a proof.
 */
import { describe, expect, it } from 'vitest';
import { ENGLISH, ENGLISH_CENTER, TRIANGLE } from './boards';
import { initialPegs } from './engine';
import { englishNotation } from './fixtures';
import { pegsFromPicture } from './picture';
import { ENGLISH_PROBLEM } from './problems';
import { applyMove, createSession } from './session';
import { SOLVER_NODE_LIMIT, solve } from './solver';

const opening = () => initialPegs(ENGLISH, ENGLISH_CENTER);

describe('solving (§8)', () => {
  it('solves the cross’s standard problem inside the limit, and the answer replays', () => {
    const t0 = performance.now();
    const result = solve(ENGLISH, opening(), ENGLISH_CENTER);
    const ms = performance.now() - t0;
    expect(result.status).toBe('solved');
    if (result.status !== 'solved') return;
    console.log(
      `[peg-solitaire] cross, middle → middle: solved in ${result.nodes} nodes ` +
        `(limit ${SOLVER_NODE_LIMIT}), ${ms.toFixed(1)} ms`,
    );
    // The regression gate is work, not time (§14): measured 30,786.
    expect(result.nodes).toBeLessThan(60_000);
    expect(result.jumps).toHaveLength(31);
    let session = createSession(ENGLISH_PROBLEM);
    for (const jump of result.jumps) {
      const next = applyMove(session, jump.from, jump.to);
      expect(next, englishNotation([jump])).not.toBeNull();
      session = next!;
    }
    expect(session.outcome).toEqual({ kind: 'perfect', remaining: 1 });
  });

  it('is deterministic and leaves the position it was given alone', () => {
    const pegs = opening();
    const copy = [...pegs];
    const a = solve(ENGLISH, pegs, ENGLISH_CENTER);
    const b = solve(ENGLISH, pegs, ENGLISH_CENTER);
    expect(a).toEqual(b);
    expect(pegs).toEqual(copy);
  });

  it('answers a position that is already one peg in the target with no jumps', () => {
    const one = initialPegs(TRIANGLE, 0).map((_, i) => i === 7);
    expect(solve(TRIANGLE, one, 7)).toEqual({ status: 'solved', jumps: [], nodes: 1 });
  });
});

describe('proving there is no way (§8)', () => {
  it('proves a scattered position unsolvable after a short search', () => {
    const scattered = pegsFromPicture(ENGLISH, [
      '  o..  ',
      '  ...  ',
      '.......',
      '...oo..',
      '.......',
      '  ...  ',
      '  ..o  ',
    ]);
    const result = solve(ENGLISH, scattered, ENGLISH_CENTER);
    expect(result.status).toBe('unsolvable');
    expect(result.nodes).toBeLessThan(10);
  });

  it('proves one peg in the wrong hole unsolvable at once', () => {
    const one = initialPegs(TRIANGLE, 0).map((_, i) => i === 7);
    expect(solve(TRIANGLE, one, 0)).toEqual({ status: 'unsolvable', nodes: 1 });
  });

  it('calls a target that is not a hole unsolvable without searching', () => {
    expect(solve(ENGLISH, opening(), -1)).toEqual({ status: 'unsolvable', nodes: 0 });
    expect(solve(ENGLISH, opening(), 33)).toEqual({ status: 'unsolvable', nodes: 0 });
    expect(solve(ENGLISH, opening(), 16.5)).toEqual({ status: 'unsolvable', nodes: 0 });
  });

  it('exhausts the triangle: the middle hole cannot finish where it started', () => {
    // (2,1) empty → one peg in (2,1). The whole reachable space is searched.
    const result = solve(TRIANGLE, initialPegs(TRIANGLE, 4), 4);
    expect(result.status).toBe('unsolvable');
    expect(result.nodes).toBeLessThan(SOLVER_NODE_LIMIT);
    // …while the same start can finish at (4,2), the one hole it can reach.
    expect(solve(TRIANGLE, initialPegs(TRIANGLE, 4), 12).status).toBe('solved');
  });
});

describe('the node limit (§8, §14)', () => {
  /** Every limit below the full cost must stop the search, honestly, exactly there. */
  const expectCappedAt = (
    pegs: readonly boolean[],
    target: number,
    limits: Iterable<number>,
    geometry = TRIANGLE,
  ) => {
    for (const limit of limits) {
      expect(solve(geometry, pegs, target, limit), `limit ${limit}`).toEqual({
        status: 'capped',
        nodes: limit,
      });
    }
  };
  const below = (full: number) => Array.from({ length: full }, (_, limit) => limit);
  /** 0, 1, 2, full − 2, full − 1, and a stride between: the edges of the cap and its middle. */
  const edgesBelow = (full: number, stride: number) => {
    const limits = new Set([0, 1, 2, full - 2, full - 1]);
    for (let limit = 0; limit < full; limit += stride) limits.add(limit);
    return [...limits].filter((limit) => limit >= 0 && limit < full);
  };

  it('stops at the limit and says it stopped, not that there is no way', () => {
    const result = solve(ENGLISH, opening(), ENGLISH_CENTER, 1_000);
    expect(result).toEqual({ status: 'capped', nodes: 1_000 });
    // The same search with room to finish finds the answer: the cap proved nothing.
    expect(solve(ENGLISH, opening(), ENGLISH_CENTER).status).toBe('solved');
  });

  it('a capped search never answers solved or unsolvable — at every limit, solvable pairs', () => {
    // Apex → apex (244 nodes) and (2,1) → (4,2) (1,307): every limit from 0
    // to one below the full cost is tried. At and past the full cost the
    // answer is exactly the uncapped one.
    for (const [start, target] of [
      [0, 0],
      [4, 12],
    ] as const) {
      const pegs = initialPegs(TRIANGLE, start);
      const full = solve(TRIANGLE, pegs, target);
      expect(full.status, `${start}→${target}`).toBe('solved');
      expectCappedAt(pegs, target, below(full.nodes));
      expect(solve(TRIANGLE, pegs, target, full.nodes)).toEqual(full);
      expect(solve(TRIANGLE, pegs, target, full.nodes + 1)).toEqual(full);
    }
  });

  it('a capped search never answers unsolvable — unsolvable pairs, at the edges of the cap', () => {
    // A search with no answer stopped early is exactly where a false
    // 'unsolvable' would come from. (2,1) → (2,1) exhausts in 4,847 nodes;
    // (2,0) → apex in 15,773, the most any triangle pair costs (§8).
    for (const [start, target, stride] of [
      [4, 4, 97],
      [3, 0, 523],
    ] as const) {
      const pegs = initialPegs(TRIANGLE, start);
      const full = solve(TRIANGLE, pegs, target);
      expect(full.status, `${start}→${target}`).toBe('unsolvable');
      expectCappedAt(pegs, target, edgesBelow(full.nodes, stride));
      expect(solve(TRIANGLE, pegs, target, full.nodes)).toEqual(full);
      expect(solve(TRIANGLE, pegs, target, full.nodes + 1)).toEqual(full);
    }
  });

  it('caps the cross’s standard problem one node short of its answer, and not at it', () => {
    const full = solve(ENGLISH, opening(), ENGLISH_CENTER);
    expect(full.status).toBe('solved');
    expectCappedAt(opening(), ENGLISH_CENTER, [full.nodes - 1], ENGLISH);
    expect(solve(ENGLISH, opening(), ENGLISH_CENTER, full.nodes)).toEqual(full);
  });

  it('gives up honestly when the limit comes before an answer', () => {
    // Middle → (3,0) on the cross: 50,000 nodes end in 'capped'. Nothing here
    // claims either way whether it can be done — the game never deals this
    // problem, and the solver must not decide it on a guess.
    const result = solve(ENGLISH, opening(), 13, 50_000);
    expect(result).toEqual({ status: 'capped', nodes: 50_000 });
  });
});

describe('caller mistakes throw rather than answer (§8)', () => {
  it('refuses a limit that is not a whole number from 0 up — no search without a cap', () => {
    const pegs = initialPegs(TRIANGLE, 4);
    for (const limit of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      Number.NEGATIVE_INFINITY,
      -1,
      1.5,
      2 ** 53,
    ]) {
      expect(() => solve(TRIANGLE, pegs, 4, limit), String(limit)).toThrow(RangeError);
    }
    // A limit of 0 is a real limit: nothing is visited, and that is not a proof.
    expect(solve(TRIANGLE, pegs, 4, 0)).toEqual({ status: 'capped', nodes: 0 });
  });

  it('refuses a position of the wrong length instead of calling it unsolvable', () => {
    // A triangle position is not a cross position; there is no answer to give.
    expect(() => solve(ENGLISH, initialPegs(TRIANGLE, 0), 0)).toThrow(RangeError);
    expect(() => solve(TRIANGLE, opening(), 0)).toThrow(RangeError);
    expect(() => solve(TRIANGLE, [], 0)).toThrow(RangeError);
  });
});
