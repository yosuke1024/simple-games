import { describe, expect, it } from 'vitest';
import { rollFor } from './dice';
import { maximalTurns } from './engine';
import {
  applyCpuRoll,
  applyCpuStep,
  applyPlayerStep,
  canUndoStep,
  cpuBeatOwed,
  createSession,
  currentAllowedSteps,
  doOpening,
  doRoll,
  MAX_ROLLS,
  undoStep,
  type BackgammonSession,
} from './session';
import { playFirstSteps, playRound, settleCpu } from './selfPlay';
import { CPU, distToPoint, initialBoard, isValidBoard, PLAYER, type Board } from './types';

/** A board where the player is on the bar against a closed board (§2.4). */
function closedOut(): Board {
  const points = new Array<number>(25).fill(0);
  points[distToPoint(PLAYER, 13)] = 14;
  for (let dist = 1; dist <= 6; dist++) points[distToPoint(CPU, dist)] = -2;
  points[distToPoint(CPU, 24)] = -3;
  return { points, bar: [1, 0], off: [0, 0] };
}

describe('the opening (§1)', () => {
  it('throws one die each and gives both to the higher side', () => {
    const session = createSession('normal', 'backgammon-opening-a');
    expect(session.phase.kind).toBe('opening');
    const opened = doOpening(session)!;
    expect(opened.opening).not.toBeNull();
    const { player, cpu, winner } = opened.opening!;
    expect(player).not.toBe(cpu);
    expect(winner).toBe(player > cpu ? PLAYER : CPU);
    expect(opened.rollIndex).toBeGreaterThanOrEqual(1);
    // The dice on the table are the opening faces, for the winner.
    expect(opened.phase.kind).toBe('moving');
    if (opened.phase.kind === 'moving') {
      expect(opened.phase.side).toBe(winner);
      expect([...opened.phase.dice].sort()).toEqual([player, cpu].sort());
      expect(opened.phase.steps).toEqual([]);
    }
  });

  it('throws again on equal dice, counting every attempt (§4)', () => {
    // Find a seed whose first throw is a tie.
    let seed = '';
    for (let n = 0; n < 500; n++) {
      const candidate = `tie-${n}`;
      const [a, b] = rollFor(candidate, 0);
      if (a === b) {
        seed = candidate;
        break;
      }
    }
    expect(seed).not.toBe('');
    const opened = doOpening(createSession('easy', seed))!;
    expect(opened.rollIndex).toBeGreaterThanOrEqual(2);
    expect(opened.status).toBe('playing');
  });

  it('owes the CPU a step, not a throw, when the CPU wins the opening', () => {
    let seed = '';
    for (let n = 0; n < 500 && seed === ''; n++) {
      const opened = doOpening(createSession('easy', `cpu-opens-${n}`))!;
      if (opened.opening?.winner === CPU) seed = `cpu-opens-${n}`;
    }
    const opened = doOpening(createSession('easy', seed))!;
    expect(cpuBeatOwed(opened)).toBe('step');
    expect(settleCpu(opened).phase).toEqual({ kind: 'awaitingRoll', side: PLAYER });
  });

  it('cannot be done twice', () => {
    const opened = doOpening(createSession('easy', 'once'))!;
    expect(doOpening(opened)).toBeNull();
  });
});

describe('a turn (§2.5)', () => {
  it('completes itself when nothing more is owed, then hands over', () => {
    let session = doOpening(createSession('normal', 'backgammon-turn-1'))!;
    session = settleCpu(session);
    if (session.phase.kind === 'awaitingRoll') session = doRoll(session)!;
    expect(session.phase.kind).toBe('moving');
    const owed = session.phase.kind === 'moving' ? session.phase.owed.count : 0;
    let played = 0;
    while (session.phase.kind === 'moving' && session.phase.side === PLAYER) {
      const steps = currentAllowedSteps(session);
      expect(steps.length).toBeGreaterThan(0);
      session = applyPlayerStep(session, steps[0]!)!;
      played += 1;
    }
    expect(played).toBe(owed);
    expect(session.phase).toEqual({ kind: 'awaitingRoll', side: CPU });
    expect(session.lastTurn?.side).toBe(PLAYER);
    expect(session.lastTurn?.steps).toHaveLength(owed);
    expect(session.turns.at(-1)).toHaveLength(owed);
    expect(isValidBoard(session.board)).toBe(true);
  });

  it('refuses a step that is not allowed, and a step out of turn', () => {
    let session = settleCpu(doOpening(createSession('normal', 'backgammon-turn-2'))!);
    if (session.phase.kind === 'awaitingRoll') session = doRoll(session)!;
    expect(applyPlayerStep(session, { from: 24, die: 9 })).toBeNull();
    expect(doRoll(session)).toBeNull();
    const done = playFirstSteps(session);
    expect(applyPlayerStep(done, { from: 13, die: 1 })).toBeNull();
  });

  it('passes by itself when no step is allowed, writing no turn (§2.4)', () => {
    const base = createSession('easy', 'pass');
    const session: BackgammonSession = {
      ...base,
      board: closedOut(),
      phase: { kind: 'awaitingRoll', side: PLAYER },
      rollIndex: 10,
      opening: { player: 6, cpu: 1, winner: PLAYER },
    };
    const rolled = doRoll(session)!;
    expect(rolled.lastTurn).toEqual({ side: PLAYER, steps: [], passed: true });
    expect(rolled.phase).toEqual({ kind: 'awaitingRoll', side: CPU });
    expect(rolled.turns).toEqual([]);
    expect(rolled.rollIndex).toBe(11);
  });
});

describe('待った (§6)', () => {
  it('takes back one step at a time, dice and board alike, until the turn starts over', () => {
    let session = settleCpu(doOpening(createSession('normal', 'backgammon-undo'))!);
    if (session.phase.kind === 'awaitingRoll') session = doRoll(session)!;
    // Find a turn with at least two steps owed (not a pass).
    expect(session.phase.kind).toBe('moving');
    const start = session;
    expect(canUndoStep(start)).toBe(false);
    const first = currentAllowedSteps(start)[0]!;
    const after = applyPlayerStep(start, first)!;
    if (after.phase.kind !== 'moving') return; // a one-die turn: nothing to take back mid-turn
    expect(canUndoStep(after)).toBe(true);
    const back = undoStep(after)!;
    expect(back.board).toEqual(start.board);
    expect(back.phase).toEqual(start.phase);
    expect(undoStep(back)).toBeNull();
  });

  it('is not available once the turn has completed', () => {
    let session = settleCpu(doOpening(createSession('normal', 'backgammon-undo-2'))!);
    if (session.phase.kind === 'awaitingRoll') session = doRoll(session)!;
    const done = playFirstSteps(session);
    expect(canUndoStep(done)).toBe(false);
    expect(undoStep(done)).toBeNull();
  });
});

describe('the CPU beats (§5.4)', () => {
  it('rolls, then plays its plan one step per beat, then hands back', () => {
    // A seed the player wins the opening on, so the CPU's first beat is a throw.
    let seed = '';
    for (let n = 0; n < 500 && seed === ''; n++) {
      const opened = doOpening(createSession('hard', `cpu-beats-${n}`))!;
      if (opened.opening?.winner === PLAYER) seed = `cpu-beats-${n}`;
    }
    const session = playFirstSteps(doOpening(createSession('hard', seed))!);
    expect(cpuBeatOwed(session)).toBe('roll');
    const rolled = applyCpuRoll(session)!;
    if (rolled.phase.kind === 'moving') {
      expect(rolled.phase.side).toBe(CPU);
      expect(rolled.phase.plan).not.toBeNull();
      const legal = maximalTurns(rolled.board, CPU, rolled.phase.dice).map((t) => JSON.stringify(t.steps));
      expect(legal).toContain(JSON.stringify(rolled.phase.plan));
      let current = rolled;
      let beats = 0;
      while (cpuBeatOwed(current) === 'step') {
        current = applyCpuStep(current)!;
        beats += 1;
      }
      expect(beats).toBe(rolled.phase.plan!.length);
      expect(current.phase).toEqual({ kind: 'awaitingRoll', side: PLAYER });
    } else {
      expect(rolled.lastTurn?.passed).toBe(true);
    }
  });

  it('is deterministic: the same seed and the same player steps replay the same match', () => {
    const run = () => {
      let session = createSession('hard', 'backgammon-determinism');
      for (let round = 0; round < 6 && session.status === 'playing'; round++) session = playRound(session);
      return session;
    };
    const a = run();
    const b = run();
    expect(a.board).toEqual(b.board);
    expect(a.turns).toEqual(b.turns);
    expect(a.rollIndex).toBe(b.rollIndex);
  });
});

describe('a whole match (§3)', () => {
  it('ends with fifteen off and a named result, well inside MAX_ROLLS', () => {
    const lengths: number[] = [];
    for (const seed of ['match-1', 'match-2', 'match-3']) {
      let session = createSession('normal', `backgammon-${seed}`);
      let guard = 0;
      while (session.status === 'playing' && guard++ < 5000) session = playRound(session);
      expect(['won', 'lost']).toContain(session.status);
      expect(session.result).not.toBeNull();
      expect(['single', 'gammon', 'backgammon']).toContain(session.result!.kind);
      expect(session.phase.kind).toBe('finished');
      expect(session.rollIndex).toBeLessThan(MAX_ROLLS / 4);
      lengths.push(session.rollIndex);
    }
    expect(Math.max(...lengths)).toBeGreaterThan(20);
  });

  it('is abandoned as no result when the roll cap is reached', () => {
    const base = createSession('easy', 'cap');
    const session: BackgammonSession = {
      ...base,
      board: initialBoard(),
      phase: { kind: 'awaitingRoll', side: PLAYER },
      rollIndex: MAX_ROLLS - 1,
      opening: { player: 6, cpu: 1, winner: PLAYER },
    };
    const rolled = doRoll(session)!;
    expect(rolled.rollIndex).toBe(MAX_ROLLS);
    const done = playFirstSteps(rolled);
    expect(done.status).toBe('noResult');
    expect(done.phase.kind).toBe('finished');
    expect(done.result).toBeNull();
  });
});
