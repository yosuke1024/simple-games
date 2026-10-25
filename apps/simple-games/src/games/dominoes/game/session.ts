/** CPU scheduling facade; shared rules live in match.ts. */
import { buildCpuView, chooseCpuMove, type CpuAction, type CpuView } from './cpu';
import { createRng } from './rng';
import { CPU } from './types';
import { draw, pass, play, type DominoesSession } from './match';
export * from './match';

export const cpuViewOf = (session: DominoesSession): CpuView =>
  buildCpuView(session.cpuHand, session.line, session.boneyard.length, session.playerHand.length);

/** The coin the CPU's ties are settled with, one stream per action (§5). */
export const cpuTieBreak = (session: DominoesSession): (() => number) =>
  createRng(`${session.seed}:cpu:${session.moveCount}`);

export interface CpuOutcome {
  readonly session: DominoesSession;
  readonly action: CpuAction;
}

/**
 * One action of the CPU's turn (§5): play, draw or pass. Null when it is not
 * the CPU's action — the caller schedules this off the session state, and a
 * stale schedule must land as nothing.
 */
export function applyCpuAction(session: DominoesSession): CpuOutcome | null {
  if (session.status !== 'playing' || session.toMove !== CPU) return null;
  const action = chooseCpuMove(cpuViewOf(session), cpuTieBreak(session));
  const next =
    action.kind === 'play'
      ? play(session, CPU, action.tile, action.end)
      : action.kind === 'draw'
        ? draw(session, CPU)
        : pass(session, CPU);
  return next === null ? null : { session: next, action };
}
