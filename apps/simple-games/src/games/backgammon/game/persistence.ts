/**
 * The saved match (docs/BACKGAMMON_RULES.md §9): a seed, a strength, a count
 * of rolls and the steps each side played. Nothing else — no board, no dice,
 * no turn marker, no opening result. All of those are functions of the
 * fields above, so writing them down would only create a second copy that
 * could disagree with the first (Ludo §10 is the precedent).
 *
 * Unlike Ludo, the CPU's steps are recorded too (§9.1): replaying a hard
 * match would otherwise re-run a two-ply search for every CPU turn on load.
 * The replay checks those steps for legality and nothing more.
 *
 * The canonical state is the player about to throw — or, before anything has
 * been thrown, the opening (§9.2). Saving from anywhere else moves to one of
 * those: back one roll when the player has thrown and not yet finished the
 * turn (the dice come back unchanged on the next throw), forward through the
 * CPU's beats when it is the CPU's turn. A record cannot express any other
 * state.
 *
 * Restoring **fails closed** (§9.3): it replays the match from the opening
 * through the very functions the screen drives, and demands that every
 * recorded step be allowed at the moment it is played. Nothing is repaired.
 */
import {
  applyCpuRoll,
  applyCpuStep,
  applyTurnStep,
  cpuBeatOwed,
  createSession,
  doOpening,
  doRoll,
  MAX_ROLLS,
  type BackgammonSession,
} from './session';
import { BAR, CPU, isDifficulty, PLAYER, type Difficulty, type Step, type Turn } from './types';

/** Bumped only if the shape below changes; see compatibility.test.ts. */
export const SCHEMA_VERSION = 1;

/** The most steps one turn can hold: four, for doubles (§2.1). */
export const MAX_STEPS_PER_TURN = 4;

export interface PersistedMatch {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Rolls completed at the canonical state; 0 means "before the opening". */
  readonly rollCount: number;
  /** Each turn's steps flattened as `[from, die, from, die, …]`, turns in order. */
  readonly turns: readonly (readonly number[])[];
  readonly elapsedSeconds: number;
  readonly savedAt: number;
}

export const encodeTurn = (turn: Turn): number[] => turn.flatMap((step) => [step.from, step.die]);

export function decodeTurn(flat: readonly number[]): Turn | null {
  if (flat.length % 2 !== 0 || flat.length > MAX_STEPS_PER_TURN * 2) return null;
  const steps: Step[] = [];
  for (let i = 0; i < flat.length; i += 2) {
    const from = flat[i]!;
    const die = flat[i + 1]!;
    if (!Number.isInteger(from) || from < 1 || from > BAR) return null;
    if (!Number.isInteger(die) || die < 1 || die > 6) return null;
    steps.push({ from, die });
  }
  return steps;
}

/**
 * The gate goes up before the record is believed (§9.3): every bound on the
 * replay's work is established from the record's own numbers, never from
 * anything the replay discovers.
 */
export function isWithinWorkGate(record: PersistedMatch): boolean {
  if (record.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof record.seed !== 'string' || record.seed.length === 0) return false;
  if (!isDifficulty(record.difficulty)) return false;
  if (!Number.isInteger(record.rollCount) || record.rollCount < 0 || record.rollCount >= MAX_ROLLS) {
    return false;
  }
  if (!Array.isArray(record.turns) || record.turns.length > record.rollCount) return false;
  for (const turn of record.turns) {
    if (!Array.isArray(turn) || decodeTurn(turn) === null) return false;
  }
  if (!Number.isFinite(record.elapsedSeconds) || record.elapsedSeconds < 0) return false;
  return true;
}

const isCanonical = (session: BackgammonSession): boolean =>
  session.phase.kind === 'opening' ||
  (session.phase.kind === 'awaitingRoll' && session.phase.side === PLAYER);

/**
 * The record for a session, canonicalized (§9.2). Null when there is nothing
 * worth coming back to — the match is decided, or decides while being wound
 * forward to the canonical state.
 */
export function canonicalRecordOf(
  session: BackgammonSession,
  savedAt: number = Date.now(),
): PersistedMatch | null {
  if (session.status !== 'playing') return null;
  const shared = {
    schemaVersion: SCHEMA_VERSION,
    seed: session.seed,
    difficulty: session.difficulty,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  } as const;

  if (session.phase.kind === 'opening') return { ...shared, rollCount: 0, turns: [] };

  if (session.phase.kind === 'moving' && session.phase.side === PLAYER) {
    // The player's own throw is unmade. If this is the first turn of the match
    // — won at the opening — the throw is the opening itself, which replays
    // whole: the record points at "before the opening".
    if (session.turns.length === 0 && session.opening?.winner === PLAYER) {
      return { ...shared, rollCount: 0, turns: [] };
    }
    return { ...shared, rollCount: session.rollIndex - 1, turns: session.turns.map(encodeTurn) };
  }

  let ahead = session;
  while (!isCanonical(ahead)) {
    const beat = cpuBeatOwed(ahead);
    if (beat === null) return null;
    const next = beat === 'roll' ? applyCpuRoll(ahead) : applyCpuStep(ahead);
    if (next === null || next.status !== 'playing') return null;
    ahead = next;
  }
  return { ...shared, rollCount: ahead.rollIndex, turns: ahead.turns.map(encodeTurn) };
}

/**
 * Replays a record into the session it describes, or null (§9.3). Every roll
 * is derived; every recorded step — the player's and the CPU's alike — is
 * accepted only if it is allowed at the moment it is played. The walk is
 * O(rollCount × move generation): each loop either throws (at most
 * `rollCount` times) or resolves the turn a throw opened.
 */
export function restoreSession(record: PersistedMatch): BackgammonSession | null {
  if (!isWithinWorkGate(record)) return null;
  const turns: Turn[] = [];
  for (const flat of record.turns) {
    const turn = decodeTurn(flat);
    if (turn === null) return null;
    turns.push(turn);
  }

  const fresh = createSession(record.difficulty, record.seed);
  if (record.rollCount === 0) {
    return turns.length === 0 ? { ...fresh, elapsedSeconds: record.elapsedSeconds } : null;
  }

  const opened = doOpening(fresh);
  if (opened === null) return null;
  let session: BackgammonSession = opened;
  let consumed = 0;
  for (;;) {
    if (session.status !== 'playing') return null;
    const phase = session.phase;
    if (phase.kind === 'awaitingRoll') {
      if (session.rollIndex === record.rollCount) {
        if (phase.side !== PLAYER) return null;
        break;
      }
      if (session.rollIndex > record.rollCount) return null;
      const rolled = phase.side === PLAYER ? doRoll(session) : applyCpuRoll(session, false);
      if (rolled === null) return null;
      session = rolled;
      continue;
    }
    if (phase.kind !== 'moving') return null;
    if (consumed >= turns.length) return null;
    const turn = turns[consumed]!;
    consumed += 1;
    for (const step of turn) {
      const stepped = applyTurnStep(session, step);
      if (stepped === null) return null;
      session = stepped;
    }
    // The recorded turn must have used everything it owed: a turn that stops
    // short is a record the game would not have written.
    if (session.phase.kind === 'moving' && session.phase.side === phase.side) return null;
  }
  if (consumed !== turns.length) return null;
  // A record written at "the player about to throw" never stops with the CPU
  // mid-turn; the check above already guarantees `phase.side === PLAYER`.
  return { ...session, elapsedSeconds: record.elapsedSeconds };
}

export { CPU, PLAYER };
