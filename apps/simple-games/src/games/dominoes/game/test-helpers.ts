/**
 * Test fixture helpers: positions reached by actually playing, never written
 * by hand. A hand-built position can drift from what the rules produce — and
 * the loader rejects anything its seed could not have dealt (serialize.ts) —
 * so the tests find the position they need by playing seeded games forward.
 *
 * The stand-in player is deliberately simple and fully determined: it plays
 * the first tile in its hand that fits (on the first end that fits), else
 * draws, else passes. The CPU plays as itself.
 */
import { legalEnds } from './engine';
import { applyCpuAction, canDraw, canPass, createSession, draw, pass, play } from './session';
import type { DominoesSession } from './session';
import { PLAYER } from './types';

/** The stand-in player's one action. Null when it is not the player's action. */
export function playerStep(session: DominoesSession): DominoesSession | null {
  if (session.status !== 'playing' || session.toMove !== PLAYER) return null;
  for (const tile of session.playerHand) {
    const ends = legalEnds(session.line, tile);
    if (ends.length > 0) return play(session, PLAYER, tile, ends[0]!);
  }
  if (canDraw(session, PLAYER)) return draw(session, PLAYER);
  if (canPass(session, PLAYER)) return pass(session, PLAYER);
  return null;
}

/** One action by whichever side is to move. Null once the game is over. */
export function step(session: DominoesSession): DominoesSession | null {
  if (session.status !== 'playing') return null;
  return session.toMove === PLAYER
    ? playerStep(session)
    : (applyCpuAction(session)?.session ?? null);
}

/** Every position of one seeded game, from the deal to the end. */
export function playThrough(seed: string): DominoesSession[] {
  const positions = [createSession(seed)];
  for (let guard = 0; guard < 200; guard++) {
    const next = step(positions[positions.length - 1]!);
    if (next === null) break;
    positions.push(next);
  }
  return positions;
}

/**
 * The first position, over seeds `${prefix}-0`, `${prefix}-1`, …, that
 * satisfies `wanted`. Throws when none of the seeds reaches one — a fixture
 * that silently fell back to something else would test nothing.
 */
export function findPosition(
  prefix: string,
  wanted: (session: DominoesSession) => boolean,
  seeds = 400,
): DominoesSession {
  for (let i = 0; i < seeds; i++) {
    const found = playThrough(`${prefix}-${i}`).find(wanted);
    if (found) return found;
  }
  throw new Error(`no position for ${prefix} in ${seeds} seeds`);
}
