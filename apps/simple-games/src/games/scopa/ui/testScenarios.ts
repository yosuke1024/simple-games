/**
 * Read by the tests only: real matches driven forward to the positions the UI
 * tests need. A saved match is replayed from its seed and refused if any card
 * of it could not have been played (game/serialize.ts), so a position cannot
 * be crafted by hand — it has to be reached. The player's side is driven by
 * the same evaluation the CPU uses, seated on the player's chair.
 */
import {
  applyBeat,
  beatOwed,
  buildCpuView,
  canDealNextDeal,
  captureOptions,
  chooseCpuMove,
  createSession,
  doNextDeal,
  doPlay,
  isPlayersTurn,
  YOU,
  type Move,
  type ScopaSession,
} from '../game';

/** The move the player's side would make here. */
export function driverMove(session: ScopaSession): Move {
  const move = chooseCpuMove(buildCpuView(session.deal, YOU, session.scores), 0.5);
  if (move === null) throw new Error('no move for the player');
  return move;
}

/** One step of a match, whoever owes it; null once the match is over. */
export function step(session: ScopaSession): ScopaSession | null {
  const beat = beatOwed(session);
  if (beat !== null) return applyBeat(session, beat)?.session ?? null;
  if (isPlayersTurn(session)) return doPlay(session, driverMove(session))?.session ?? null;
  if (canDealNextDeal(session)) return doNextDeal(session);
  return null;
}

/**
 * The first position, over seeds `scopa-ui-<i>`, that satisfies `wanted`.
 * Bounded: a search that finds nothing throws rather than spinning.
 */
export function findPosition(
  wanted: (session: ScopaSession) => boolean,
  seeds = 400,
): ScopaSession {
  for (let i = 0; i < seeds; i++) {
    let session: ScopaSession | null = createSession(`scopa-ui-${i}`);
    for (let guard = 0; session !== null && guard < 2000; guard++) {
      if (wanted(session)) return session;
      session = step(session);
    }
  }
  throw new Error('no such position in the searched seeds');
}

/** The player's turn, with nothing owed, and a hand card matching `shape`. */
export const playerCardWith =
  (shape: (options: ReturnType<typeof captureOptions>) => boolean) =>
  (session: ScopaSession): boolean =>
    isPlayersTurn(session) &&
    session.deal.hands[YOU].some((card) => shape(captureOptions(session.deal.table, card)));
