import { describe, expect, it, vi } from 'vitest';
import { MAX_ROLLS, rollDie, rollDieValue, initialState } from '../../games/ludo/game/engine';
import { rollFor } from '../../games/ludo/game/dice';
import { createRng } from '../../games/ludo/game/rng';
import {
  applyLudo,
  createLudo,
  isLudoAction,
  isLudoState,
  ludoCpuAction,
  ludoResult,
  type State,
} from './ludo';

const drawSix = () => 0.99;
const drawOne = () => 0;
function openingAt(seat: number): State {
  let state = createLudo(drawOne);
  while (state.turn !== seat) state = applyLudo(state, state.turn, { kind: 'roll' }, drawOne)!;
  return state;
}

describe('Nearby Ludo rules', () => {
  it('keeps every solo seeded roll identical to the extracted face resolver', () => {
    const random = createRng('ludo-face-extraction');
    let state = createLudo(random);
    for (let beat = 0; beat < 2_000 && state.result === null; beat++) {
      if (state.die === null) {
        expect(rollDie(state, 'frozen-rolls')).toEqual(
          rollDieValue(state, rollFor('frozen-rolls', state.rollIndex)),
        );
      }
      state = applyLudo(state, state.turn, ludoCpuAction(state), random)!;
    }
    expect(state.result?.kind).toBe('win');
    expect(rollDieValue(initialState(), 0)).toBeNull();
    expect(rollDieValue(initialState(), 6.1)).toBeNull();
  });

  it.each([0, 1, 2, 3])(
    'allows seat %i to roll and CPU to take over the already rolled turn',
    (seat) => {
      const opening = openingAt(seat);
      const rolled = applyLudo(opening, seat, { kind: 'roll' }, drawSix)!;
      expect(rolled.die).toBe(6);
      const random = vi.fn(drawOne);
      const action = ludoCpuAction(rolled);
      expect(action?.kind).toBe('move');
      const moved = applyLudo(rolled, seat, action, random)!;
      expect(random).not.toHaveBeenCalled();
      expect(moved.rollIndex).toBe(rolled.rollIndex);
      expect(moved.lastRoll).toEqual(rolled.lastRoll);
      expect(moved.pawns[seat]!.filter((p) => p === 1)).toHaveLength(1);
      expect(moved.turn).toBe(seat);
      expect(isLudoState(moved)).toBe(true);
      expect(opening.pawns.every((pawns) => pawns.every((p) => p === 0))).toBe(true);
    },
  );

  it('rejects a wrong seat, reroll, extra action fields and invalid draws without consuming a legal turn', () => {
    const initial = createLudo(drawOne);
    const random = vi.fn(drawSix);
    expect(applyLudo(initial, 1, { kind: 'roll' }, random)).toBeNull();
    expect(applyLudo(initial, 0, { kind: 'roll', seat: 1 }, random)).toBeNull();
    expect(applyLudo(initial, 0, { kind: 'move', pawn: 0 }, random)).toBeNull();
    expect(random).not.toHaveBeenCalled();
    const rolled = applyLudo(initial, 0, { kind: 'roll' }, random)!;
    expect(applyLudo(rolled, 0, { kind: 'roll' }, random)).toBeNull();
    expect(random).toHaveBeenCalledTimes(1);
    for (const draw of [-0.1, 1, Infinity, NaN]) {
      expect(() => applyLudo(initial, 0, { kind: 'roll' }, () => draw)).toThrow('Invalid host RNG');
    }
    expect(isLudoAction({ kind: 'move', pawn: 4 })).toBe(false);
    expect(isLudoAction({ kind: 'move', pawn: 0, seed: 'private' })).toBe(false);
  });

  it('can complete all four seats under CPU control, with valid public snapshots at every beat', () => {
    const winners = new Set<number>();
    for (let seed = 0; seed < 32; seed++) {
      const random = createRng(`nearby-ludo-${seed}`);
      let state = createLudo(random);
      for (let beat = 0; beat <= 2 * MAX_ROLLS; beat++) {
        const publicState: unknown = JSON.parse(JSON.stringify(state));
        expect(isLudoState(publicState), `seed ${seed}, beat ${beat}`).toBe(true);
        expect(Object.keys(state)).not.toContain('seed');
        if (state.result !== null) break;
        const action = ludoCpuAction(state);
        expect(action).not.toBeNull();
        state = applyLudo(state, state.turn, action, random)!;
        expect(state).not.toBeNull();
      }
      expect(state.result?.kind).toBe('win');
      const result = ludoResult(state)!;
      expect(result.scores).toHaveLength(4);
      expect(result.scores[result.winner!]).toBe(4);
      winners.add(result.winner!);
      expect(ludoCpuAction(state)).toBeNull();
      expect(applyLudo(state, state.turn, { kind: 'roll' }, random)).toBeNull();
    }
    expect([...winners].sort()).toEqual([0, 1, 2, 3]);
  });

  it('finishes the roll cap as no-contest and never rerolls the final face', () => {
    const state = { ...openingAt(1), rollIndex: MAX_ROLLS - 1 };
    const ended = applyLudo(state, 1, { kind: 'roll' }, drawSix)!;
    expect(ended.result).toEqual({ kind: 'noContest' });
    expect(isLudoState(ended)).toBe(true);
    expect(ludoResult(ended)).toEqual({ winner: null, scores: [0, 0, 0, 0] });
  });

  it('rejects malformed or impossible public snapshots, including hidden/private state', () => {
    const initial = createLudo(drawOne);
    const rolled = applyLudo(initial, 0, { kind: 'roll' }, drawSix)!;
    const invalid: unknown[] = [
      null,
      [],
      {},
      { ...initial, seed: 'future' },
      { ...initial, turn: 4 },
      { ...initial, pawns: [[0], [], [], []] },
      { ...initial, rollIndex: Number.MAX_SAFE_INTEGER },
      { ...initial, lastRoll: {} },
      { ...rolled, die: 1 },
      { ...rolled, lastRoll: null },
      { ...rolled, lastRoll: { seat: 0, die: 6, kind: { toString: 'move' } } },
      { ...rolled, result: { kind: 'win', winner: 0 } },
      { ...rolled, result: { kind: 'noContest' } },
      {
        ...rolled,
        die: null,
        pawns: [
          [59, 59, 59, 59],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
          [0, 0, 0, 0],
        ],
      },
    ];
    for (const value of invalid) expect(isLudoState(value)).toBe(false);
  });
});
