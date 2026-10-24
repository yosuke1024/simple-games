/**
 * The round on screen plus the one number the rules do not hold: the play
 * seconds already spent on it (docs/GEM_SWAP_RULES.md §7). Pure, like the rest
 * of game/: storage reads and writes this shape, the state layer keeps it.
 *
 * The seconds are statistics only — never shown (§9) — and they travel in the
 * suspended record beside (seed, colors, swaps), so a resumed round's clock
 * picks up where it stopped and its seconds are not booked twice
 * (docs/ARCHITECTURE.md「状態と ref」).
 */
import { restoreRound, toRecord, type Round, type RoundRecord } from './round';

/** Whole seconds a suspended round can carry (about 31 years); anything above is corrupt. */
export const MAX_ELAPSED_SECONDS = 1e9;

export interface GemSwapSession {
  readonly round: Round;
  /** Whole play seconds spent on this round so far. */
  readonly elapsedSeconds: number;
}

/** What a suspended round is written as (§7): the replay triple and its seconds. */
export interface SessionRecord extends RoundRecord {
  readonly elapsedSeconds: number;
}

export const createSession = (round: Round): GemSwapSession => ({ round, elapsedSeconds: 0 });

/** The record of a round still being played; null for a finished one, which is never saved. */
export function toSessionRecord(session: GemSwapSession): SessionRecord | null {
  if (session.round.status !== 'playing') return null;
  return { ...toRecord(session.round), elapsedSeconds: session.elapsedSeconds };
}

const isElapsed = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_ELAPSED_SECONDS;

/**
 * The session a record holds, or null (fail-closed, §7): the seconds must be a
 * whole number in range, and the triple must replay through the rules to a
 * round that is still being played (`restoreRound`). Never repaired.
 */
export function restoreSession(record: unknown): GemSwapSession | null {
  if (typeof record !== 'object' || record === null) return null;
  const { elapsedSeconds } = record as Record<string, unknown>;
  if (!isElapsed(elapsedSeconds)) return null;
  const round = restoreRound(record);
  return round === null ? null : { round, elapsedSeconds };
}
