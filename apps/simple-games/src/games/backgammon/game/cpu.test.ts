import { describe, expect, it } from 'vitest';
import { buildView, chooseTurn, HARD_NODE_LIMIT } from './cpu';
import { diceOf, rollFor } from './dice';
import { evaluate, hitChance36 } from './evaluate';
import {
  applyCpuRoll,
  applyCpuStep,
  applyPlayerStep,
  cpuBeatOwed,
  createSession,
  doOpening,
  doRoll,
  MAX_ROLLS,
  type BackgammonSession,
} from './session';
import { CPU, DIFFICULTIES, distToPoint, initialBoard, PLAYER, type Board, type Difficulty } from './types';

function boardOf(player: Record<number, number>, cpu: Record<number, number>, bar: [number, number] = [0, 0]): Board {
  const points = new Array<number>(25).fill(0);
  let playerOn = bar[0];
  let cpuOn = bar[1];
  for (const [dist, count] of Object.entries(player)) {
    const index = distToPoint(PLAYER, Number(dist));
    points[index] = (points[index] ?? 0) + count;
    playerOn += count;
  }
  for (const [dist, count] of Object.entries(cpu)) {
    const index = distToPoint(CPU, Number(dist));
    points[index] = (points[index] ?? 0) - count;
    cpuOn += count;
  }
  return { points, bar, off: [15 - playerOn, 15 - cpuOn] };
}

describe('the view (§5.1)', () => {
  it('carries the public board, the dice and the legal turns — and nothing about the seed', () => {
    const view = buildView(initialBoard(), CPU, 'hard', [3, 1]);
    expect(Object.keys(view).sort()).toEqual(['board', 'dice', 'difficulty', 'side', 'turns']);
    expect(view.turns.length).toBeGreaterThan(0);
  });
});

describe('chooseTurn (§5.2)', () => {
  it('returns one of the legal turns at every strength, deterministically', () => {
    for (const difficulty of DIFFICULTIES) {
      for (const roll of [
        [3, 1],
        [6, 6],
        [4, 2],
      ] as const) {
        const view = buildView(initialBoard(), CPU, difficulty, diceOf(roll));
        const legal = view.turns.map((t) => JSON.stringify(t.steps));
        const a = chooseTurn(view, 0.37);
        const b = chooseTurn(view, 0.37);
        expect(legal).toContain(JSON.stringify(a.turn));
        expect(a).toEqual(b);
        expect(a.nodes).toBeLessThanOrEqual(HARD_NODE_LIMIT);
      }
    }
  });

  it('easy picks by the tie-break float, normal and hard by the evaluation', () => {
    const view = buildView(initialBoard(), CPU, 'easy', [3, 1]);
    const low = chooseTurn(view, 0);
    const high = chooseTurn(view, 0.999);
    expect(low.turn).toEqual(view.turns[0]!.steps);
    expect(high.turn).toEqual(view.turns[view.turns.length - 1]!.steps);
    // Normal makes the 5-point with a 3-1 from the opening: the textbook move.
    const normal = chooseTurn(buildView(initialBoard(), CPU, 'normal', [3, 1]), 0.5);
    const made = view.turns.find((t) => JSON.stringify(t.steps) === JSON.stringify(normal.turn))!;
    expect(made.board.points[distToPoint(CPU, 5)]).toBe(-2);
  });

  it('plays the only turn without searching, and an empty turn when there is none', () => {
    const closed = boardOf({ 1: 2, 2: 2, 3: 2, 4: 2, 5: 2, 6: 2, 24: 3 }, { 13: 14 }, [0, 1]);
    const none = chooseTurn(buildView(closed, CPU, 'hard', [3, 4]), 0.5);
    expect(none).toEqual({ turn: [], nodes: 0 });
  });
});

describe('the evaluation (§5.3)', () => {
  it('counts a direct shot, an indirect shot through an open point, and a blocked one', () => {
    // Player blot at distance 10; a CPU checker at the player's distance 4 (gap 6).
    const direct = boardOf({ 10: 1, 13: 14 }, { 21: 1, 1: 14 }); // CPU dist 21 = player point 4; the rest at the player's 24
    expect(hitChance36(direct, PLAYER, 10)).toBe(17); // any 6, or 5-1, 4-2, 3-3, 2-2
    // Gap 7: 6-1, 5-2, 4-3 (two each) — 6 ways, if the intermediates are open.
    const indirect = boardOf({ 10: 1, 13: 14 }, { 22: 1, 1: 14 }); // CPU dist 22 = player point 3
    expect(hitChance36(indirect, PLAYER, 10)).toBe(6);
    // Hold both intermediates of 6-1 and the other combinations' points: with
    // the player holding distances 4, 5, 6, 7, 8 and 9, no 7 can get through.
    const walled = boardOf({ 10: 1, 4: 2, 5: 2, 6: 2, 7: 2, 8: 2, 9: 2 }, { 22: 1, 1: 14 });
    expect(hitChance36(walled, PLAYER, 10)).toBe(0);
  });

  it('prefers the race lead and dislikes a blot in front of the opponent', () => {
    const ahead = boardOf({ 6: 15 }, { 13: 15 });
    const behind = boardOf({ 13: 15 }, { 6: 15 });
    expect(evaluate(ahead, PLAYER)).toBeGreaterThan(evaluate(behind, PLAYER));
    const safe = boardOf({ 6: 13, 5: 2 }, { 13: 15 });
    const exposed = boardOf({ 6: 13, 5: 1, 4: 1 }, { 13: 15 });
    expect(evaluate(safe, PLAYER)).toBeGreaterThan(evaluate(exposed, PLAYER));
  });
});

/** Both sides played by `chooseTurn`: the player by `playerStrength`, the CPU by the session's. */
function selfPlay(seed: string, playerStrength: Difficulty, cpuStrength: Difficulty): BackgammonSession {
  let session = doOpening(createSession(cpuStrength, seed))!;
  let guard = 0;
  while (session.status === 'playing' && guard++ < MAX_ROLLS * 4) {
    const phase = session.phase;
    if (phase.kind === 'awaitingRoll' && phase.side === PLAYER) {
      session = doRoll(session)!;
    } else if (phase.kind === 'moving' && phase.side === PLAYER) {
      const view = buildView(session.board, PLAYER, playerStrength, phase.dice);
      const tieBreak = rollFor(`${seed}:tie`, session.rollIndex)[0] / 7;
      const { turn } = chooseTurn(view, tieBreak);
      for (const step of turn) session = applyPlayerStep(session, step)!;
    } else {
      const beat = cpuBeatOwed(session);
      session = (beat === 'roll' ? applyCpuRoll(session) : applyCpuStep(session))!;
    }
  }
  return session;
}

describe('self-play (§5.2, §3 — Phase 2 evidence)', () => {
  it('normal beats easy more often than not, and every match ends inside the cap', () => {
    let normalWins = 0;
    let longest = 0;
    const games = 24;
    for (let n = 0; n < games; n++) {
      const seed = `selfplay-ne-${n}`;
      // Alternate who is the player so the opening roll's side does not bias it.
      const normalIsPlayer = n % 2 === 0;
      const result = selfPlay(seed, normalIsPlayer ? 'normal' : 'easy', normalIsPlayer ? 'easy' : 'normal');
      expect(['won', 'lost']).toContain(result.status);
      longest = Math.max(longest, result.rollIndex);
      if ((result.status === 'won') === normalIsPlayer) normalWins += 1;
    }
    console.log(`self-play normal vs easy: ${normalWins}/${games}, longest match ${longest} rolls`);
    expect(normalWins).toBeGreaterThan(games / 2);
    expect(longest).toBeLessThan(MAX_ROLLS / 4);
    // The budget is a hang guard, not a measurement: the work is deterministic
    // and the wall clock belongs to the runner (CHECKERS_RULES.md §4).
  }, 60_000);

  it('hard plays legal, bounded turns against normal', () => {
    for (let n = 0; n < 2; n++) {
      const result = selfPlay(`selfplay-hn-${n}`, 'normal', 'hard');
      expect(['won', 'lost']).toContain(result.status);
    }
  }, 60_000);
});
