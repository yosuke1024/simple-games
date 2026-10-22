/**
 * EchoSession — a pure, immutable snapshot of one run. The React layer only
 * dispatches into these functions; all rules live here
 * (docs/ECHO_PADS_RULES.md §1, §4–§6, §8).
 *
 *   idle ──▶──> playing-back ──end/stop──> awaiting-input ──press…──> idle (k+1)
 *                    ^                         │  ▶ (before input) │
 *                    └─────────────────────────┘                   ├──> cleared
 *                                                                   └──> failed ⇄ reviewing
 *
 * Every function returns `null` for a move the rules do not allow, and the
 * caller keeps the session it had: a pad pressed during playback, ▶ after
 * input began, Stop with nothing playing. Nothing here is a timer; the
 * playback timetable is game/timetable.ts and the UI only walks it.
 */
import { DAILY_PAD_COUNT, DAILY_TARGET, dailySeed, isLocalDateString } from './daily';
import { FIRST_ROUND, isAttempt, levelSeed, levelSpec } from './levels';
import { generateSequence } from './sequence';
import { isPace, type EchoStatus, type GameMode, type Pace, type PadCount } from './types';

export interface EchoFailure {
  /** The round k the mistake was made in. */
  readonly round: number;
  /** 0-based position in the round's sequence of the wrong press. */
  readonly index: number;
  readonly pressed: number;
  readonly expected: number;
}

export interface EchoSession {
  readonly mode: GameMode;
  /** 1..22 for a level run, null for the daily. */
  readonly level: number | null;
  /** Local YYYY-MM-DD for the daily, null for a level run. */
  readonly dailyDate: string | null;
  readonly padCount: PadCount;
  readonly target: number;
  readonly attempt: number;
  readonly seed: string;
  /** The whole sequence, `target` long. Round k plays the first k. */
  readonly sequence: readonly number[];
  /** Round k: FIRST_ROUND..target. */
  readonly round: number;
  /** How many of this round's pads have been pressed correctly. */
  readonly inputCount: number;
  /**
   * The first press of the round happened. ▶ is gone until the round ends
   * (§6) — and stays gone across leaving and coming back (§8, decision 8 (B)).
   */
  readonly inputStarted: boolean;
  /** ▶ presses in this round, stops and interruptions included (§6). */
  readonly roundPlays: number;
  /** Second-and-later ▶ presses before input, over the whole run (§6). */
  readonly replays: number;
  /** Paces used to play this run's rounds, in first-use order (§9). */
  readonly pacesHeard: readonly Pace[];
  readonly status: EchoStatus;
  readonly failure: EchoFailure | null;
  readonly elapsedSeconds: number;
}

interface RunSpec {
  readonly mode: GameMode;
  readonly level: number | null;
  readonly dailyDate: string | null;
  readonly padCount: PadCount;
  readonly target: number;
  readonly attempt: number;
  readonly seed: string;
}

function freshSession(spec: RunSpec): EchoSession {
  return {
    ...spec,
    sequence: generateSequence(spec.seed, spec.padCount, spec.target).pads,
    round: FIRST_ROUND,
    inputCount: 0,
    inputStarted: false,
    roundPlays: 0,
    replays: 0,
    pacesHeard: [],
    status: 'idle',
    failure: null,
    elapsedSeconds: 0,
  };
}

function levelRun(level: number, attempt: number): RunSpec | null {
  const spec = levelSpec(level);
  if (!spec || !isAttempt(attempt)) return null;
  return {
    mode: 'level',
    level,
    dailyDate: null,
    padCount: spec.padCount,
    target: spec.target,
    attempt,
    seed: levelSeed(level, attempt),
  };
}

function dailyRun(dateString: string, attempt: number): RunSpec | null {
  if (!isLocalDateString(dateString) || !isAttempt(attempt)) return null;
  return {
    mode: 'daily',
    level: null,
    dailyDate: dateString,
    padCount: DAILY_PAD_COUNT,
    target: DAILY_TARGET,
    attempt,
    seed: dailySeed(dateString, attempt),
  };
}

/** A new run at a level; null for a level or attempt that cannot exist. */
export function createLevelSession(level: number, attempt: number): EchoSession | null {
  const run = levelRun(level, attempt);
  return run ? freshSession(run) : null;
}

/** A new daily run for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string, attempt: number): EchoSession | null {
  const run = dailyRun(dateString, attempt);
  return run ? freshSession(run) : null;
}

/** The pads round k plays: the first k of the run's sequence. */
export function roundSequence(session: EchoSession): readonly number[] {
  return session.sequence.slice(0, session.round);
}

/** Whether ▶ is offered right now (§6). */
export function canPlay(session: EchoSession): boolean {
  switch (session.status) {
    case 'idle':
    case 'failed':
      return true;
    case 'awaiting-input':
      return !session.inputStarted;
    default:
      return false;
  }
}

/** Whether a playback is running, so Stop is offered (§4). */
export function isPlayingBack(session: EchoSession): boolean {
  return session.status === 'playing-back' || session.status === 'reviewing';
}

/** Pace can change only while nothing is playing (§4). */
export function canChangePace(session: EchoSession): boolean {
  return !isPlayingBack(session);
}

/** Whether the pads take presses right now (§5). */
export function canPress(session: EchoSession): boolean {
  return session.status === 'awaiting-input';
}

/**
 * ▶. In a round it plays the round and counts the second and later presses
 * as replays; after a failure it plays the failed round as a review, which
 * is not counted — the run is over (§6). Null when ▶ is not offered.
 */
export function play(session: EchoSession, pace: Pace): EchoSession | null {
  if (!canPlay(session) || !isPace(pace)) return null;
  if (session.status === 'failed') return { ...session, status: 'reviewing' };
  const pacesHeard = session.pacesHeard.includes(pace)
    ? session.pacesHeard
    : [...session.pacesHeard, pace];
  return {
    ...session,
    status: 'playing-back',
    roundPlays: session.roundPlays + 1,
    replays: session.roundPlays >= 1 ? session.replays + 1 : session.replays,
    pacesHeard,
  };
}

/**
 * The playback is over — it reached its end, or Stop, the background, blur,
 * Back or a dialog stopped it (§4). A stopped round playback still counted
 * as heard; nothing resumes by itself. Null when nothing was playing.
 */
export function endPlayback(session: EchoSession): EchoSession | null {
  if (session.status === 'playing-back') return { ...session, status: 'awaiting-input' };
  if (session.status === 'reviewing') return { ...session, status: 'failed' };
  return null;
}

/**
 * A pad press, compared with the next item of the round (§5). A mismatch
 * ends the run. A completed round moves to the next one and waits for ▶;
 * the target round completed clears the run. Null when presses are not
 * taken or the pad does not exist.
 */
export function press(session: EchoSession, pad: number): EchoSession | null {
  if (!canPress(session)) return null;
  if (!Number.isInteger(pad) || pad < 0 || pad >= session.padCount) return null;
  const expected = session.sequence[session.inputCount]!;
  if (pad !== expected) {
    return {
      ...session,
      inputStarted: true,
      status: 'failed',
      failure: { round: session.round, index: session.inputCount, pressed: pad, expected },
    };
  }
  const inputCount = session.inputCount + 1;
  if (inputCount < session.round) return { ...session, inputCount, inputStarted: true };
  if (session.round === session.target) {
    return { ...session, inputCount, inputStarted: true, status: 'cleared' };
  }
  return {
    ...session,
    round: session.round + 1,
    inputCount: 0,
    inputStarted: false,
    roundPlays: 0,
    status: 'idle',
  };
}

/** Whether the run is over. */
export function isFinished(session: EchoSession): boolean {
  return (
    session.status === 'cleared' || session.status === 'failed' || session.status === 'reviewing'
  );
}

/**
 * The longest length returned in full (§9's result): the target on a clear,
 * k − 1 when round k failed, 0 when round 3 failed (nothing was returned).
 */
export function longestReturned(session: EchoSession): number {
  if (session.status === 'cleared') return session.target;
  const failedRound = session.failure ? session.failure.round : session.round;
  return failedRound > FIRST_ROUND ? failedRound - 1 : 0;
}

/** Adds play seconds; the play clock is the UI's, the total is the run's. */
export function addElapsed(session: EchoSession, seconds: number): EchoSession {
  if (!Number.isFinite(seconds) || seconds <= 0) return session;
  return { ...session, elapsedSeconds: session.elapsedSeconds + seconds };
}

/** What a suspended run keeps (§9's record, minus schemaVersion). */
export interface EchoSnapshot {
  readonly mode: GameMode;
  readonly level: number | null;
  readonly dailyDate: string | null;
  readonly attempt: number;
  readonly round: number;
  readonly inputStarted: boolean;
  readonly roundPlays: number;
  readonly replays: number;
  readonly pacesHeard: readonly Pace[];
  readonly elapsedSeconds: number;
}

/** The record for a run that is not over; null for a finished one (§8). */
export function snapshotOf(session: EchoSession): EchoSnapshot | null {
  if (isFinished(session)) return null;
  // A run left during playback is a run whose playback stopped (§8).
  return {
    mode: session.mode,
    level: session.level,
    dailyDate: session.dailyDate,
    attempt: session.attempt,
    round: session.round,
    inputStarted: session.inputStarted,
    roundPlays: session.roundPlays,
    replays: session.replays,
    pacesHeard: session.pacesHeard,
    elapsedSeconds: session.elapsedSeconds,
  };
}

const isCount = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

/**
 * Rebuilds a suspended run from its record, or null when the record cannot
 * have come from the rules (§8, §9's fail-closed list — the part that needs
 * no other key; unlocks, today's date and the attempt counter are the
 * storage layer's checks).
 *
 * The sequence comes from the seed again. A round left before input stands
 * before its first press with ▶ offered; a round left after input began
 * stands at its first press with ▶ withheld — the pads are pressed again
 * from the start, and where they had got to is not kept (decision 8 (B)).
 * Playback never restarts on its own.
 */
export function restoreSession(snapshot: EchoSnapshot): EchoSession | null {
  const { mode, level, dailyDate, attempt, round, inputStarted, roundPlays, replays } = snapshot;
  const { pacesHeard, elapsedSeconds } = snapshot;
  let run: RunSpec | null = null;
  if (mode === 'level' && dailyDate === null && typeof level === 'number') {
    run = levelRun(level, attempt);
  } else if (mode === 'daily' && level === null && typeof dailyDate === 'string') {
    run = dailyRun(dailyDate, attempt);
  }
  if (!run) return null;
  if (!Number.isInteger(round) || round < FIRST_ROUND || round > run.target) return null;
  if (typeof inputStarted !== 'boolean' || !isCount(roundPlays) || !isCount(replays)) return null;
  // Input cannot start before the round was heard once.
  if (inputStarted && roundPlays === 0) return null;
  // This round's own replays are part of the run's; in round 3 there is no
  // earlier round, so they are all of it.
  if (replays < roundPlays - 1) return null;
  if (round === FIRST_ROUND && replays !== Math.max(0, roundPlays - 1)) return null;
  if (!Array.isArray(pacesHeard) || !pacesHeard.every(isPace)) return null;
  if (new Set(pacesHeard).size !== pacesHeard.length) return null;
  // Past round 3, or once this round was played, some pace was heard. In
  // round 3 every pace heard came from one of its own plays.
  if ((round > FIRST_ROUND || roundPlays > 0) && pacesHeard.length === 0) return null;
  if (round === FIRST_ROUND && pacesHeard.length > roundPlays) return null;
  if (
    typeof elapsedSeconds !== 'number' ||
    !Number.isFinite(elapsedSeconds) ||
    elapsedSeconds < 0
  ) {
    return null;
  }
  return {
    ...freshSession(run),
    round,
    inputStarted,
    roundPlays,
    replays,
    pacesHeard: [...pacesHeard],
    elapsedSeconds,
    status: roundPlays === 0 ? 'idle' : 'awaiting-input',
  };
}

/** The pad a digit key names (§11: 1..padCount in reading order), or null. */
export function padForKey(key: string, padCount: PadCount): number | null {
  if (!/^[1-9]$/.test(key)) return null;
  const pad = Number(key) - 1;
  return pad < padCount ? pad : null;
}
