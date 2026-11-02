/**
 * Driving a match without a screen (docs/BACKGAMMON_RULES.md §5, §9): the
 * CPU's beats settled in a loop, and the player played by the simplest policy
 * there is. Pure, and used by the engine's tests and the Phase 2 self-play;
 * nothing in `ui/` or `state/` imports it.
 */
import {
  applyCpuRoll,
  applyCpuStep,
  applyPlayerStep,
  cpuBeatOwed,
  currentAllowedSteps,
  doOpening,
  doRoll,
  type BackgammonSession,
} from './session';
import { PLAYER } from './types';

/** Drives a session to the player's next throw (or the end), the CPU playing its beats. */
export function settleCpu(session: BackgammonSession): BackgammonSession {
  let current = session;
  for (;;) {
    const beat = cpuBeatOwed(current);
    if (beat === null) return current;
    const next = beat === 'roll' ? applyCpuRoll(current) : applyCpuStep(current);
    if (next === null) throw new Error('the CPU owed a beat it could not play');
    current = next;
  }
}

/** The player plays the first allowed step until the turn completes. */
export function playFirstSteps(session: BackgammonSession): BackgammonSession {
  let current = session;
  while (current.phase.kind === 'moving' && current.phase.side === PLAYER) {
    const [step] = currentAllowedSteps(current);
    if (!step) throw new Error('a moving player with no allowed step');
    const next = applyPlayerStep(current, step);
    if (next === null) throw new Error('an allowed step was refused');
    current = next;
  }
  return current;
}

/** One full exchange: the player throws and moves, then the CPU settles. */
export function playRound(session: BackgammonSession): BackgammonSession {
  let current = session;
  if (current.phase.kind === 'opening') current = doOpening(current)!;
  if (current.phase.kind === 'awaitingRoll' && current.phase.side === PLAYER) {
    current = doRoll(current)!;
  }
  current = playFirstSteps(current);
  return settleCpu(current);
}
