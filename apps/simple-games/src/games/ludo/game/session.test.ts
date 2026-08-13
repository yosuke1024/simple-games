/**
 * Suspending a match and coming back to it — the seven properties Phase 4
 * accepts this game on (docs/plans/2026-08-08-mahjong-bubble-ludo.md, session
 * tests ① to ⑦).
 *
 * Everything below is played out rather than stubbed, by a scripted player
 * that reads the same view a CPU seat does and draws the same tie-break key
 * that seat would draw for the roll in front of it. That keeps these tests
 * honest as the rules move — there is no hand-written move list here that
 * could stop being legal for reasons other than a rule changing — and it
 * drives the `do*` and `applyCpu*` beats the screen will actually call.
 *
 * The matches are not sampled positions: a checkpoint is taken by playing to
 * it, so every record these tests hand to `restoreSession` is a record the
 * game could really have written.
 */
import { describe, expect, it, vi } from 'vitest';

/**
 * Counting how many random streams a restore opens (test ⑥). The count has to
 * come from outside rng.ts — a counter living in the module under measurement
 * would be a permanent cost paid by every player to make one test possible —
 * so the module is wrapped here instead, and it still calls straight through
 * to the real generator, so nothing about the matches below changes.
 */
const rngUse = vi.hoisted(() => ({ count: 0 }));

vi.mock('./rng', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./rng')>();
  return {
    ...actual,
    createRng: (seed: string) => {
      rngUse.count += 1;
      return actual.createRng(seed);
    },
  };
});

import { buildLudoView, chooseCpuMove } from './cpu';
import { MAX_ROLLS } from './engine';
import { createRng } from './rng';
import {
  canonicalRecordOf,
  restoreSession,
  MAX_CHOICES_TEXT,
  type PersistedMatch,
} from './serialize';
import {
  applyCpuMove,
  applyCpuRoll,
  createSession,
  cpuBeatOwed,
  doMovePawn,
  doRoll,
  movablePawns,
  type LudoSession,
} from './session';
import { DIFFICULTIES, YOU, type Difficulty } from './types';

/** A fixed clock, so a record is compared for what it says, not when it was said. */
const SAVED_AT = 1_754_640_000_000;

const PAWNS = [0, 1, 2, 3] as const;

/**
 * The player, scripted: the same chooser the CPU seats use, at the same
 * strength, on the same view, with the tie-break key that belongs to the roll
 * on the table (`${seed}:cpu:${rollIndex}` for the index the roll was made at,
 * which is one behind the count once it has been made — dice.ts and session.ts
 * agree on this and so does the replay).
 */
function scriptedPawn(session: LudoSession): 0 | 1 | 2 | 3 {
  const view = buildLudoView(session.state, session.difficulty)!;
  const tieBreak = createRng(`${session.seed}:cpu:${session.state.rollIndex - 1}`)();
  return chooseCpuMove(view, tieBreak)!.pawn;
}

/** One beat by whoever is due one: a CPU seat's throw or move, or the player's. */
function step(session: LudoSession): LudoSession {
  const beat = cpuBeatOwed(session);
  if (beat !== null) {
    const next = beat.kind === 'roll' ? applyCpuRoll(session) : applyCpuMove(session);
    return next!;
  }
  if (session.state.die === null) return doRoll(session)!;
  return doMovePawn(session, scriptedPawn(session))!;
}

/** Rolls, moves and forfeits are all beats; a match runs to a few hundred of them. */
const BEAT_LIMIT = 20_000;

function playOut(session: LudoSession): LudoSession {
  let played = session;
  for (let taken = 0; taken < BEAT_LIMIT && played.status === 'playing'; taken++) {
    played = step(played);
  }
  return played;
}

/** Winds a session forward to the canonical state without saving anything. */
function forwardToPlayersThrow(session: LudoSession): LudoSession {
  let ahead = session;
  for (let taken = 0; taken < BEAT_LIMIT; taken++) {
    if (ahead.state.turn === YOU && ahead.state.die === null) return ahead;
    ahead = step(ahead);
  }
  throw new Error('never came back round to the player');
}

/**
 * Everything a resumed match has to agree with the suspended one about: the
 * board, whose turn it is, the run of sixes, the die on the table, the
 * player's history — and `rollIndex`, which is the position in the dice
 * stream, since every face is `rollFor(seed, rollIndex)` (dice.ts).
 */
const fingerprint = (session: LudoSession): string =>
  [
    session.status,
    session.state.rollIndex,
    session.state.turn,
    session.state.sixStreak,
    session.state.die,
    session.state.pawns.map((pawns) => pawns.join(',')).join('/'),
    session.choices.join(''),
  ].join('|');

/** Saves here, restores, and demands the resumed match plays out into the suspended one. */
function expectResumesIdentically(live: LudoSession): LudoSession {
  const record = canonicalRecordOf(live, SAVED_AT);
  expect(record).not.toBeNull();
  const restored = restoreSession(record!);
  expect(restored).not.toBeNull();
  expect(restored!.state.rollIndex).toBe(record!.rollCount);
  expect(restored!.state.turn).toBe(YOU);
  expect(restored!.state.die).toBeNull();
  expect(fingerprint(playOut(restored!))).toBe(fingerprint(playOut(live)));
  return restored!;
}

/**
 * Plays matches over `seeds` and hands every session it stands on to
 * `accept`, along with the one before it, stopping at the first that is taken.
 * Checkpoints are searched for rather than written down so that a rule change
 * moves them instead of breaking them.
 */
interface Found {
  readonly at: LudoSession;
  readonly before: LudoSession;
}

function scan(
  seeds: readonly string[],
  difficulty: Difficulty,
  accept: (session: LudoSession, before: LudoSession) => boolean,
): Found | null {
  for (const seed of seeds) {
    let session = createSession(difficulty, seed);
    for (let taken = 0; taken < BEAT_LIMIT && session.status === 'playing'; taken++) {
      const next = step(session);
      if (accept(next, session)) return { at: next, before: session };
      session = next;
    }
  }
  return null;
}

const seedsNamed = (label: string, count: number): string[] =>
  Array.from({ length: count }, (_, index) => `ludo-${label}-${index}`);

// ---------------------------------------------------------------------------
// ① The resumed match is the suspended match
// ---------------------------------------------------------------------------

describe('① a restored match agrees with one that was never put down', () => {
  for (const difficulty of DIFFICULTIES) {
    it(`resumes into the same board, turn and dice position at every checkpoint (${difficulty})`, () => {
      let checkpoints = 0;
      for (const seed of seedsNamed(`resume-${difficulty}`, 6)) {
        let session = createSession(difficulty, seed);
        for (let taken = 0; taken < BEAT_LIMIT && session.status === 'playing'; taken++) {
          // Every twenty-ninth beat, so checkpoints land on rolls, on moves
          // and on both sides of the table rather than on one kind of moment.
          if (taken % 29 === 0 && canonicalRecordOf(session, SAVED_AT) !== null) {
            expectResumesIdentically(session);
            checkpoints += 1;
          }
          session = step(session);
        }
        expect(session.status).not.toBe('playing');
      }
      expect(checkpoints).toBeGreaterThan(50);
    });
  }

  /**
   * A run of sixes is not written down anywhere — `sixStreak` is derived by
   * replaying the rolls — so the boundaries of the rule (§2.1) are where a
   * record that forgot how to count rolls would come apart. Two sixes standing
   * (k = 2), the third that forfeits the turn (k = 3), and a six on the next
   * seat's fresh run right after that forfeit (k = 4) are each crossed here.
   */
  it('carries a run of two sixes across the save (k = 2)', () => {
    const found = scan(
      seedsNamed('six', 12),
      'normal',
      (session) =>
        session.state.turn === YOU && session.state.die === null && session.state.sixStreak === 2,
    );
    expect(found).not.toBeNull();
    const restored = expectResumesIdentically(found!.at);
    // Derived, not stored: nothing in the record says "two sixes so far".
    expect(restored.state.sixStreak).toBe(2);
  });

  it('carries the third six that forfeits the turn (k = 3)', () => {
    const found = scan(
      seedsNamed('six', 12),
      'normal',
      (session) => session.lastRoll?.kind === 'thirdSix',
    );
    expect(found).not.toBeNull();
    // The moment before the third six is thrown, and the moment after it.
    expectResumesIdentically(found!.before);
    expectResumesIdentically(found!.at);
  });

  it('carries a six thrown on the run that starts after a forfeit (k = 4)', () => {
    const found = scan(
      seedsNamed('six', 12),
      'normal',
      (session, before) =>
        before.lastRoll?.kind === 'thirdSix' &&
        session.lastRoll?.die === 6 &&
        session.state.rollIndex === before.state.rollIndex + 1,
    );
    expect(found).not.toBeNull();
    expectResumesIdentically(found!.at);
    expect(found!.at.state.sixStreak).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// ② A CPU seat's tie-break survives the save
// ---------------------------------------------------------------------------

describe('② a tie a CPU seat had to break comes back broken the same way', () => {
  /**
   * The match goldens never see this: they play straight through, so a
   * tie-break key that shifted by one on a restore would not show up in them
   * at all. What is needed is a moment where the key is actually load-bearing
   * — where the two ends of the float choose different pawns — and then a save
   * written across it.
   */
  const tieDecides = (session: LudoSession): boolean => {
    const beat = cpuBeatOwed(session);
    if (beat === null || beat.kind !== 'move') return false;
    const view = buildLudoView(session.state, session.difficulty)!;
    return chooseCpuMove(view, 0)!.pawn !== chooseCpuMove(view, 0.999)!.pawn;
  };

  for (const difficulty of DIFFICULTIES) {
    it(`replays the same choice through a tie the float decided (${difficulty})`, () => {
      const found = scan(seedsNamed('tie', 8), difficulty, (session) => tieDecides(session));
      expect(found).not.toBeNull();
      const live = found!.at;

      // Saving here canonicalizes forward, which means the replay has to make
      // this very decision itself, with no record of it to lean on.
      const restored = expectResumesIdentically(live);
      expect(fingerprint(restored)).toBe(fingerprint(forwardToPlayersThrow(live)));
    });
  }
});

// ---------------------------------------------------------------------------
// ③ Automatic passes leave a mark, even though nothing records them
// ---------------------------------------------------------------------------

describe('③ a position reached only by passing is still its own position', () => {
  it('tells the opening apart from a lap of the table that nobody could move in', () => {
    // A first roll that is not a six has no legal reply — all four pawns are
    // in the yard (§2.6) — so the player passes automatically and the table
    // goes round without the player having chosen anything at all.
    const opening = seedsNamed('pass', 12)
      .map((seed) => createSession('normal', seed))
      .find((session) => doRoll(session)!.lastRoll!.kind === 'autoPass');
    expect(opening).toBeDefined();

    const atOpening = canonicalRecordOf(opening!, SAVED_AT)!;
    const afterALap = canonicalRecordOf(forwardToPlayersThrow(step(opening!)), SAVED_AT)!;

    // **This is the pair the record has to keep apart.** Both positions have
    // the same seed, the same strength and the same — empty — list of player
    // choices, because an automatic pass is not a choice and is never
    // recorded. Only the roll count distinguishes them; a format that stored
    // player input alone would write these two out as the same bytes.
    expect(atOpening.choices).toBe('');
    expect(afterALap.choices).toBe(atOpening.choices);
    expect(atOpening.rollCount).toBe(0);
    expect(afterALap.rollCount).toBeGreaterThan(0);

    const fromOpening = restoreSession(atOpening)!;
    const fromLap = restoreSession(afterALap)!;
    expect(fingerprint(fromOpening)).not.toBe(fingerprint(fromLap));
    expect(fingerprint(fromOpening)).toBe(fingerprint(opening!));
    expect(fingerprint(fromLap)).toBe(fingerprint(forwardToPlayersThrow(step(opening!))));
  });
});

// ---------------------------------------------------------------------------
// ④ Every runtime state saves as the one canonical state
// ---------------------------------------------------------------------------

describe('④ a save written mid-animation lands on the defined state', () => {
  /**
   * The sessions the screen would be standing on during one whole lap of the
   * CPU seats — after a seat's throw, after its move, and on through the seats
   * behind it — from the moment the player's turn ends to the moment it comes
   * back round. Laps where every seat merely passed are skipped: a lap with a
   * move in it is the one that has an animation to be caught mid-way through.
   */
  function firstBusyCpuLap(
    seeds: readonly string[],
    difficulty: Difficulty,
    minimumBeats: number,
  ): LudoSession[] {
    for (const seed of seeds) {
      let session = createSession(difficulty, seed);
      let lap: LudoSession[] = [];
      for (let taken = 0; taken < BEAT_LIMIT && session.status === 'playing'; taken++) {
        if (cpuBeatOwed(session) !== null) lap.push(session);
        else if (lap.length > 0) {
          if (lap.length >= minimumBeats) return lap;
          lap = [];
        }
        session = step(session);
      }
    }
    throw new Error('no CPU lap of that length in these seeds');
  }

  it('writes the same record from every beat of a CPU lap as from the end of it', () => {
    const lap = firstBusyCpuLap(seedsNamed('canon', 8), 'normal', 6);
    const written = lap.map((session) => canonicalRecordOf(session, SAVED_AT)!);
    const atThePlayersThrow = canonicalRecordOf(forwardToPlayersThrow(lap[0]!), SAVED_AT)!;

    // Every one of them is the same bytes: the record cannot express a
    // half-played lap, so there is nothing for these to differ about.
    for (const record of written) expect(record).toEqual(atThePlayersThrow);
    expect(written).toHaveLength(lap.length);
    expect(restoreSession(atThePlayersThrow)!.state.turn).toBe(YOU);
  });

  it('gives the same die back when the save was written with one on the table', () => {
    const found = scan(
      seedsNamed('canon', 8),
      'normal',
      (session) => session.state.turn === YOU && session.state.die !== null,
    );
    expect(found).not.toBeNull();
    const live = found!.at;

    // Canonicalizing backwards unmakes the throw rather than losing it: the
    // face is a function of the seed and the roll index, so throwing again
    // turns up the same number in front of the same board.
    const record = canonicalRecordOf(live, SAVED_AT)!;
    expect(record.rollCount).toBe(live.state.rollIndex - 1);
    const restored = restoreSession(record)!;
    const thrownAgain = doRoll(restored)!;
    expect(thrownAgain.state.die).toBe(live.state.die);
    expect(movablePawns(thrownAgain)).toEqual(movablePawns(live));
    expect(fingerprint(thrownAgain)).toBe(fingerprint(live));
  });
});

// ---------------------------------------------------------------------------
// ⑤ Histories that could not have happened are refused
// ---------------------------------------------------------------------------

/** A real record, written from a real match a few dozen rolls in. */
function recordFrom(seed: string, minimumChoices: number): PersistedMatch {
  let session = createSession('normal', seed);
  for (let taken = 0; taken < BEAT_LIMIT; taken++) {
    if (session.choices.length >= minimumChoices) {
      const record = canonicalRecordOf(session, SAVED_AT);
      if (record !== null) return record;
    }
    session = step(session);
  }
  throw new Error(`no record ever written for ${seed}`);
}

const withChoiceAt = (record: PersistedMatch, at: number, digit: string): PersistedMatch => ({
  ...record,
  choices: `${record.choices.slice(0, at)}${digit}${record.choices.slice(at + 1)}`,
});

/**
 * Replays a record's own history looking for the first move at which some
 * pawn was **not** legal, and names that pawn there instead. That is a record
 * that reads perfectly well and describes a move nobody could have made.
 */
function withAnIllegalChoice(record: PersistedMatch): PersistedMatch {
  let session = createSession(record.difficulty, record.seed);
  let consumed = 0;
  for (let taken = 0; taken < BEAT_LIMIT && consumed < record.choices.length; taken++) {
    const beat = cpuBeatOwed(session);
    if (beat !== null) {
      session = (beat.kind === 'roll' ? applyCpuRoll(session) : applyCpuMove(session))!;
      continue;
    }
    if (session.state.die === null) {
      session = doRoll(session)!;
      continue;
    }
    const movable = movablePawns(session);
    const illegal = PAWNS.find((pawn) => !movable.includes(pawn));
    if (illegal !== undefined) return withChoiceAt(record, consumed, String(illegal));
    session = doMovePawn(session, Number.parseInt(record.choices[consumed]!, 10) as 0 | 1 | 2 | 3)!;
    consumed += 1;
  }
  throw new Error('this match never had a pawn the player could not move');
}

describe('⑤ a record that play could not have produced is refused', () => {
  const record = recordFrom('ludo-reject', 12);

  it('accepts the record it was actually written from', () => {
    expect(restoreSession(record)).not.toBeNull();
  });

  it('refuses a choice that was not a legal move at its own moment', () => {
    expect(restoreSession(withAnIllegalChoice(record))).toBeNull();
  });

  it('refuses a roll count that is one out in either direction', () => {
    // One short stops with choices left over that the match never asked for;
    // one long stops on a seat that is not the player, or with a die on the
    // table nobody answered. Neither is the canonical state, and neither is
    // repaired. (A shifted count is not *always* meaningless — a count landing
    // on the player's next throw after an automatic pass would name a real,
    // later position — which is why this is checked on a played-out fixture
    // rather than argued from the arithmetic.)
    expect(restoreSession({ ...record, rollCount: record.rollCount - 1 })).toBeNull();
    expect(restoreSession({ ...record, rollCount: record.rollCount + 1 })).toBeNull();
  });

  it('refuses a record carrying one choice too many, or one too few', () => {
    expect(restoreSession({ ...record, choices: `${record.choices}0` })).toBeNull();
    expect(restoreSession({ ...record, choices: record.choices.slice(0, -1) })).toBeNull();
  });

  it('refuses a roll count outside the rules', () => {
    expect(restoreSession({ ...record, rollCount: MAX_ROLLS })).toBeNull();
    expect(restoreSession({ ...record, rollCount: MAX_ROLLS + 1 })).toBeNull();
    expect(restoreSession({ ...record, rollCount: -1 })).toBeNull();
    expect(restoreSession({ ...record, rollCount: 12.5 })).toBeNull();
    expect(restoreSession({ ...record, rollCount: Number.NaN })).toBeNull();
  });

  it('refuses anything in the choices that is not a pawn number', () => {
    for (const bad of ['4', '9', 'x', ' ', '-1', '0.']) {
      expect(restoreSession({ ...record, choices: `${record.choices}${bad}` })).toBeNull();
    }
    expect(restoreSession({ ...record, choices: '0'.repeat(MAX_CHOICES_TEXT + 1) })).toBeNull();
  });

  it('refuses a record pointing past the end of a match that was already decided', () => {
    const finished = playOut(createSession('normal', 'ludo-decided'));
    expect(finished.status).not.toBe('playing');
    const past: PersistedMatch = {
      schemaVersion: 1,
      seed: finished.seed,
      difficulty: finished.difficulty,
      rollCount: finished.state.rollIndex,
      choices: finished.choices.join(''),
      elapsedSeconds: 0,
      savedAt: SAVED_AT,
    };
    expect(restoreSession(past)).toBeNull();
    expect(restoreSession({ ...past, rollCount: past.rollCount + 50 })).toBeNull();
    // And the other end of the same rule: a decided match is not written out
    // at all. There is nothing to come back to.
    expect(canonicalRecordOf(finished, SAVED_AT)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ⑥ A corrupt record cannot buy unbounded work
// ---------------------------------------------------------------------------

describe('⑥ restoring costs what the rules allow and no more', () => {
  /** Runs `work` and reports how many random streams it opened. */
  function rngUsedBy(work: () => unknown): number {
    rngUse.count = 0;
    work();
    return rngUse.count;
  }

  const record = recordFrom('ludo-budget', 8);

  it('spends at most two streams a roll on a record it accepts', () => {
    // One stream for the face (dice.ts) and, when the roll needs answering,
    // one for the tie-break (session.ts). Nothing else opens one.
    const used = rngUsedBy(() => expect(restoreSession(record)).not.toBeNull());
    expect(used).toBeGreaterThan(0);
    expect(used).toBeLessThanOrEqual(2 * (record.rollCount + 1));
  });

  it('stays inside the roll cap on a record that is legal but enormous', () => {
    // This one passes the gate — the count is inside the cap and the choices
    // are well-formed — and is still nonsense: it claims a match that ran
    // nearly to the cap with the player never once moving a pawn. The replay
    // has to find that out, and what bounds it is the cap, not the record.
    const hostile: PersistedMatch = { ...record, rollCount: MAX_ROLLS - 1, choices: '' };
    const used = rngUsedBy(() => expect(restoreSession(hostile)).toBeNull());
    expect(used).toBeLessThanOrEqual(2 * MAX_ROLLS);
  });

  it('opens no stream at all for a record the gate turns away', () => {
    // The gate is checked before the replay starts, so a record that fails it
    // costs the comparisons in the gate and nothing else — no match is dealt,
    // no die is thrown, no seat is asked anything.
    const turnedAway: PersistedMatch[] = [
      { ...record, rollCount: MAX_ROLLS },
      { ...record, rollCount: MAX_ROLLS * 1000 },
      { ...record, rollCount: -1 },
      { ...record, rollCount: Number.POSITIVE_INFINITY },
      { ...record, choices: `${record.choices}4` },
      { ...record, choices: '0'.repeat(MAX_CHOICES_TEXT + 1) },
      { ...record, choices: '3'.repeat(record.rollCount + 1) },
      { ...record, schemaVersion: 2 as unknown as 1 },
    ];
    for (const bad of turnedAway) {
      expect(rngUsedBy(() => expect(restoreSession(bad)).toBeNull())).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// ⑦ Suspending a match does not lengthen it
// ---------------------------------------------------------------------------

describe('⑦ a match takes the same number of rolls however often it is put down', () => {
  /**
   * How long matches run, and why the cap sits where it does, is
   * rollDistribution.test.ts' subject. All that is left here is that
   * suspending one costs it nothing: the roll count is the position in the
   * dice stream, so a resumed match that had drifted by even one roll would be
   * playing different dice from here on.
   */
  it('finishes on the same roll whether or not it was suspended three times', () => {
    for (const difficulty of DIFFICULTIES) {
      const seed = `ludo-length-${difficulty}`;
      const straightThrough = playOut(createSession(difficulty, seed));

      let session = createSession(difficulty, seed);
      let suspensions = 0;
      for (let taken = 0; taken < BEAT_LIMIT && session.status === 'playing'; taken++) {
        if (taken % 97 === 0 && suspensions < 3) {
          const record = canonicalRecordOf(session, SAVED_AT);
          if (record !== null) {
            session = restoreSession(record)!;
            suspensions += 1;
          }
        }
        session = step(session);
      }
      expect(suspensions).toBe(3);
      expect(session.state.rollIndex).toBe(straightThrough.state.rollIndex);
      expect(fingerprint(session)).toBe(fingerprint(straightThrough));
    }
  });
});

// ---------------------------------------------------------------------------
// The session's own shape
// ---------------------------------------------------------------------------

describe('the beats the screen drives', () => {
  it('starts every match on the player, with sixteen pawns in the yard', () => {
    const session = createSession('normal', 'ludo-shape');
    expect(session.state.turn).toBe(YOU);
    expect(session.state.rollIndex).toBe(0);
    expect(session.choices).toEqual([]);
    expect(session.status).toBe('playing');
    expect(session.state.pawns.flat()).toEqual(new Array(16).fill(0));
  });

  it('refuses a beat that is not owed', () => {
    const session = createSession('normal', 'ludo-shape');
    // The player's throw is owed; nothing else is.
    expect(applyCpuRoll(session)).toBeNull();
    expect(applyCpuMove(session)).toBeNull();
    expect(cpuBeatOwed(session)).toBeNull();
    expect(movablePawns(session)).toEqual([]);
    expect(doMovePawn(session, 0)).toBeNull();

    const thrown = doRoll(session)!;
    // A throw already made is not thrown again — it is answered.
    if (thrown.state.die !== null) expect(doRoll(thrown)).toBeNull();
  });

  it('records one choice per move the player makes, and none for anybody else', () => {
    let session = createSession('normal', 'ludo-choices');
    let playerMoves = 0;
    for (let taken = 0; taken < 400 && session.status === 'playing'; taken++) {
      const before = session;
      session = step(session);
      const playerMoved =
        before.state.turn === YOU && before.state.die !== null && cpuBeatOwed(before) === null;
      if (playerMoved) playerMoves += 1;
      expect(session.choices.length).toBe(playerMoves);
    }
    expect(playerMoves).toBeGreaterThan(0);
  });

  it('only offers pawns the rules would move', () => {
    let session = createSession('hard', 'ludo-movable');
    for (let taken = 0; taken < 400 && session.status === 'playing'; taken++) {
      if (session.state.turn === YOU && session.state.die !== null) {
        const movable = movablePawns(session);
        expect(movable.length).toBeGreaterThan(0);
        for (const pawn of PAWNS) {
          if (!movable.includes(pawn)) expect(doMovePawn(session, pawn)).toBeNull();
        }
      }
      session = step(session);
    }
  });

  it("says the verdict from the player's side of the table", () => {
    for (const difficulty of DIFFICULTIES) {
      for (const seed of seedsNamed(`verdict-${difficulty}`, 4)) {
        const finished = playOut(createSession(difficulty, seed));
        const result = finished.state.result!;
        if (result.kind === 'noContest') {
          expect(finished.status).toBe('noContest');
          continue;
        }
        expect(finished.status).toBe(result.winner === YOU ? 'won' : 'lost');
      }
    }
  });
});
