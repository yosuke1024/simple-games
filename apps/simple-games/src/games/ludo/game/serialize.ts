/**
 * The saved match: a seed, a strength, a count of rolls, and the pawns the
 * player chose. Nothing else — no board, no faces, no CPU moves, no turn, no
 * run of sixes. All of those are functions of the four fields above, so
 * writing them down would only create a second copy that could disagree with
 * the first (docs/LUDO_RULES.md §10, design doc §C).
 *
 * **A lying pass is not expressible.** An automatic pass — the rule that skips
 * a seat with no legal reply (§2.6) — is never recorded here; it is derived,
 * every time, from the position the replay is standing in. So there is no
 * field in which to claim a seat passed a roll it could actually have played,
 * and no way to write one: the record has no room for the claim. That is a
 * stronger thing than a validator that rejects the claim, because a validator
 * has to be right about every position, and this has nothing to be right
 * about.
 *
 * The canonical state is **one** state: the player, about to throw. Saving
 * from anywhere else moves to it — back one roll when the player has thrown
 * and not yet moved (the face is `rollFor(seed, rollIndex)`, so throwing again
 * returns it unchanged and no progress is lost), forward through the CPU seats
 * when they are mid-lap, animation and all. Because a record cannot express
 * any other state, "several runtime states must canonicalize to one saved
 * state" holds as a property of the format rather than as a check somebody has
 * to remember to run.
 *
 * Restoring **fails closed**. It replays the match from the opening, deriving
 * every roll and every CPU move and taking the player's moves from `choices`,
 * and it demands each of those be legal at the moment it is played. A record
 * that could not have come from play — a choice that was not a legal move, a
 * stop that is not the player's throw, choices left over or run out, a match
 * that had already been decided — returns null, and the caller drops the save
 * and goes home rather than dealing the player into an invented position.
 * Nothing here repairs anything.
 */
import { MAX_ROLLS } from './engine';
import {
  applyCpuMove,
  applyCpuRoll,
  createSession,
  cpuBeatOwed,
  doMovePawn,
  doRoll,
  type LudoSession,
} from './session';
import { isCpuSeat, isDifficulty, YOU, type Difficulty } from './types';

/** Bumped only if the shape below changes; see compatibility.test.ts. */
export const SCHEMA_VERSION = 1;

/**
 * One suspended match, as it is written to storage. `rollCount` is the only
 * field that is not either identity or bookkeeping: it is the count of rolls
 * completed at the canonical state, and it is **not derivable** from the
 * choices — the opening and "the player auto-passed and the CPU seats went
 * round once" both have an empty `choices`, and only the roll count tells them
 * apart.
 */
export interface PersistedMatch {
  readonly schemaVersion: typeof SCHEMA_VERSION;
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Rolls completed. The `rollIndex` of the canonical state — the player, about to throw. */
  readonly rollCount: number;
  /** The pawns the player moved, in order, one digit `0`..`3` each. */
  readonly choices: string;
  readonly elapsedSeconds: number;
  readonly savedAt: number;
}

/**
 * The longest `choices` string a record may carry before anything else is
 * done with it. A player move always answers a roll of its own, so a legal
 * match cannot have more choices than rolls, and a match cannot have more
 * rolls than the cap (§2.9). The per-record check below is tighter still
 * (`choices.length <= rollCount`); this one exists to be applied to a raw
 * string, before any number on the record has been believed.
 */
export const MAX_CHOICES_TEXT = MAX_ROLLS;

/** The only characters a choice list may be made of: pawn numbers, one digit each. */
export const CHOICES_PATTERN = /^[0-3]*$/;

/**
 * **The gate goes up before the record is believed, not after.** Restoring is
 * a replay, and a replay's cost is the number of rolls it walks — so the
 * bound on that number has to be established from the record's own fields
 * first, while they are still just numbers and characters, and never from
 * anything the replay itself discovers. A record claiming a million rolls is
 * turned away here for a millionth of the work it is asking for; one that got
 * as far as the replay would have spent that work before finding out.
 *
 * The order within the gate matters for the same reason: the length of
 * `choices` is checked before the pattern is run over it, so a hostile
 * megabyte of digits costs a comparison rather than a scan.
 *
 * Note what is *not* here: no ceiling on `rollCount` lower than `MAX_ROLLS`,
 * and no opinion at all about which positions are plausible. The cap belongs
 * to the rules (§2.9), and a real match that merely ran long must not be
 * thrown away as if its save file were corrupt. Everything about legality is
 * the replay's job, below.
 */
export function isWithinWorkGate(record: PersistedMatch): boolean {
  if (record.schemaVersion !== SCHEMA_VERSION) return false;
  if (typeof record.seed !== 'string' || record.seed.length === 0) return false;
  if (!isDifficulty(record.difficulty)) return false;
  if (!Number.isInteger(record.rollCount)) return false;
  if (record.rollCount < 0 || record.rollCount >= MAX_ROLLS) return false;
  if (typeof record.choices !== 'string') return false;
  if (record.choices.length > MAX_CHOICES_TEXT) return false;
  if (record.choices.length > record.rollCount) return false;
  if (!CHOICES_PATTERN.test(record.choices)) return false;
  if (!Number.isFinite(record.elapsedSeconds) || record.elapsedSeconds < 0) return false;
  return true;
}

/** Whether this session is standing exactly on the canonical state. */
const isCanonical = (session: LudoSession): boolean =>
  session.state.turn === YOU && session.state.die === null;

/**
 * The record for a session, canonicalized (design doc §C.2). A pure function:
 * sessions are immutable, so the forward case below advances a local copy and
 * the session the screen is holding is never touched.
 *
 * Null when there is nothing worth coming back to — the match is already
 * decided, or it decides (or reaches the roll cap) while being wound forward
 * to the canonical state. A finished match is not a match to resume; the slot
 * is cleared instead, the same way Hearts refuses to save a match whose scores
 * have reached the target.
 */
export function canonicalRecordOf(
  session: LudoSession,
  savedAt: number = Date.now(),
): PersistedMatch | null {
  if (session.status !== 'playing') return null;

  const choices = session.choices.join('');
  const shared = {
    schemaVersion: SCHEMA_VERSION,
    seed: session.seed,
    difficulty: session.difficulty,
    choices,
    elapsedSeconds: session.elapsedSeconds,
    savedAt,
  } as const;

  // The player has thrown and not yet moved: canonicalize BACKWARDS, to the
  // moment before that throw. The face is `rollFor(seed, rollIndex)` and
  // nothing else, so throwing again after the restore turns up the same
  // number in front of the same board — the roll is not lost, it is unmade.
  // The move that was still being chosen was never a choice yet, so nothing
  // is dropped from `choices` either.
  if (session.state.die !== null && session.state.turn === YOU) {
    return { ...shared, rollCount: session.state.rollIndex - 1 };
  }

  // Anywhere on the CPU's side of the table — including partway through the
  // animation of one seat's roll or move: canonicalize FORWARDS, to the next
  // time the player is about to throw. Nothing between here and there asks
  // anybody anything, so this walk always arrives, or the match ends on the
  // way and there is nothing to save.
  let ahead = session;
  while (!isCanonical(ahead)) {
    const beat = cpuBeatOwed(ahead);
    if (beat === null) return null;
    const next = beat.kind === 'roll' ? applyCpuRoll(ahead) : applyCpuMove(ahead);
    if (next === null) return null;
    ahead = next;
    if (ahead.status !== 'playing') return null;
  }
  return { ...shared, rollCount: ahead.state.rollIndex };
}

/**
 * Replays a record into the session it describes, or null (design doc §C.3).
 *
 * The replay is the whole of the validation. It starts a fresh match on the
 * record's seed and strength and drives it through the very functions the
 * screen drives — `doRoll`, `applyCpuRoll`, `applyCpuMove`, `doMovePawn` — so
 * a resumed match cannot answer differently from the one that was put down;
 * there is one implementation of a beat, not two. Every roll is derived, every
 * CPU move is derived, and each of the player's is taken from `choices` and
 * accepted only if `doMovePawn` finds it legal against the board as it stands
 * at that moment.
 *
 * It stops **immediately before a roll**, when `rollIndex` has reached
 * `rollCount`. Because `rollIndex` only ever grows by one, at a roll, and the
 * test sits before the roll rather than after it, the count cannot be
 * overshot: the walk is O(rollCount), with no search anywhere in it. Each turn
 * of the loop either makes a roll (at most `rollCount` of those) or resolves
 * the die the roll before it put on the table (at most one per roll), so the
 * work is bounded by the gate above and by nothing else.
 *
 * What comes back carries the replay's own `lastRoll`: the face the last roll
 * turned up, which is the die lying on the board at the canonical state.
 * Derived like everything else here — nothing was written down to produce it.
 *
 * Reachability is not checked; it is how the state is built. The replay only
 * ever applies moves that were legal when it applied them, so the position it
 * arrives at is reachable by construction — there is no position it could
 * produce that play could not.
 */
export function restoreSession(record: PersistedMatch): LudoSession | null {
  if (!isWithinWorkGate(record)) return null;

  const choices = record.choices;
  let session = createSession(record.difficulty, record.seed);
  let consumed = 0;

  for (;;) {
    // A match that was decided before it reached `rollCount` is a record
    // pointing at a position that does not exist.
    if (session.status !== 'playing') return null;

    if (session.state.die === null) {
      if (session.state.rollIndex === record.rollCount) {
        // The canonical state is the player's throw and only that. Stopping
        // anywhere else means the record was not written by this game.
        if (session.state.turn !== YOU) return null;
        break;
      }
      const rolledOn = session.state.turn === YOU ? doRoll(session) : applyCpuRoll(session);
      if (rolledOn === null) return null;
      session = rolledOn;
      continue;
    }

    if (isCpuSeat(session.state.turn)) {
      const moved = applyCpuMove(session);
      if (moved === null) return null;
      session = moved;
      continue;
    }

    // The player's move, and the only thing the record is trusted for. Out of
    // choices is a record that stops short of what it claims.
    if (consumed >= choices.length) return null;
    const pawn = Number.parseInt(choices[consumed]!, 10) as 0 | 1 | 2 | 3;
    const moved = doMovePawn(session, pawn);
    if (moved === null) return null;
    session = moved;
    consumed += 1;
  }

  // Choices left over describe moves the match never asked for — a record and
  // a match that do not fit each other, whichever of the two is wrong.
  if (consumed !== choices.length) return null;

  return { ...session, elapsedSeconds: record.elapsedSeconds };
}
