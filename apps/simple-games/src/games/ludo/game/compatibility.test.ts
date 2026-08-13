/**
 * Golden matches — the v1 contract for Ludo's dice, its opponents and the
 * record a suspended match is written as.
 *
 * These literals pin the whole chain at once: the PRNG, the exact shape of the
 * seed strings (`${seed}:dice:${rollIndex}` and `${seed}:cpu:${rollIndex}`,
 * and the fact that a roll and the move answering it share one index), which
 * seat throws when, what each strength does with what it is dealt, how the
 * rules resolve an automatic pass and a third six, and the fields a saved
 * match is written with.
 *
 * If this test fails, the thing to fix is the implementation, not the
 * expectation. Regenerating these strings changes what a saved match resumes
 * into and what a recorded win against "Hard" was won against — it silently
 * rewrites games players have already played. Doing it anyway is a decision to
 * make deliberately and to state in the commit message, including what it
 * costs them.
 *
 * The scripted player takes the same view the CPU seats do and plays it at the
 * match's own strength, so the match is fixed without a hand-written move list
 * that could stop being legal for reasons other than the rules changing.
 */
import { describe, expect, it } from 'vitest';
import { buildLudoView, chooseCpuMove } from './cpu';
import { MAX_ROLLS } from './engine';
import { createRng } from './rng';
import { canonicalRecordOf } from './serialize';
import {
  applyCpuMove,
  applyCpuRoll,
  createSession,
  cpuBeatOwed,
  doMovePawn,
  doRoll,
  matchSeed,
  type LudoSession,
} from './session';
import {
  HOME_PROGRESS,
  RING_SIZE,
  SAFE_SQUARES,
  SEAT_START_STRIDE,
  type Difficulty,
} from './types';

const SEED = 'ludo-golden';

const SAVED_AT = 1_754_640_000_000;

const BEAT_LIMIT = 20_000;

/** One beat by whoever is due one, with the player scripted from the CPU's own chooser. */
function step(session: LudoSession): LudoSession {
  const beat = cpuBeatOwed(session);
  if (beat !== null) {
    return (beat.kind === 'roll' ? applyCpuRoll(session) : applyCpuMove(session))!;
  }
  if (session.state.die === null) return doRoll(session)!;
  const view = buildLudoView(session.state, session.difficulty)!;
  const tieBreak = createRng(`${session.seed}:cpu:${session.state.rollIndex - 1}`)();
  return doMovePawn(session, chooseCpuMove(view, tieBreak)!.pawn)!;
}

const ROLL_KINDS: Readonly<Record<string, string>> = {
  move: 'm',
  autoPass: 'p',
  thirdSix: 't',
  noContest: 'n',
};

/**
 * The first `rolls` throws of a match, as `index:seat:face:kind`, with `>pawn`
 * appended when a move answered the throw. Everything a replay has to
 * reproduce is in here: the faces, the order of the seats, which throws the
 * rules swallowed, and which pawn each seat picked.
 */
function traceOf(difficulty: Difficulty, rolls: number): string {
  let session = createSession(difficulty, SEED);
  const lines: string[] = [];
  // The trailing `|| die !== null` finishes the last throw rather than
  // cutting the trace off between a roll and the move that answers it.
  while (
    session.status === 'playing' &&
    (session.state.rollIndex < rolls || session.state.die !== null)
  ) {
    const before = session.state;
    const next = step(session);
    if (next.state.rollIndex !== before.rollIndex) {
      const outcome = next.lastRoll!;
      lines.push(`${before.rollIndex}:${before.turn}:${outcome.die}:${ROLL_KINDS[outcome.kind]}`);
    } else {
      const moved = [0, 1, 2, 3].find(
        (pawn) => next.state.pawns[before.turn][pawn] !== before.pawns[before.turn][pawn],
      );
      lines[lines.length - 1] += `>${moved}`;
    }
    session = next;
  }
  return lines.join(' ');
}

const boardOf = (session: LudoSession): string =>
  session.state.pawns.map((pawns) => pawns.join(',')).join('/');

interface Finish {
  readonly status: string;
  readonly rolls: number;
  readonly choices: number;
  readonly board: string;
}

function playMatch(difficulty: Difficulty): Finish {
  let session = createSession(difficulty, SEED);
  for (let taken = 0; taken < BEAT_LIMIT && session.status === 'playing'; taken++) {
    session = step(session);
  }
  return {
    status: session.status,
    rolls: session.state.rollIndex,
    choices: session.choices.length,
    board: boardOf(session),
  };
}

/**
 * The first forty throws of the fixed seed. Read it as the rules being
 * applied: nobody moves at all until roll 5 turns up the first six (§2.1 —
 * only a six leaves the yard), a six is followed by another throw for the same
 * seat, and seat 2 spends the whole opening passing automatically because no
 * six ever reaches it.
 *
 * All three strengths open with exactly this, and that too is pinned rather
 * than assumed: with a single pawn out of the yard a seat has one legal reply
 * and no weight table gets a say. Where the strengths part company is the
 * finished matches below.
 */
const OPENING =
  '0:0:1:p 1:1:5:p 2:2:1:p 3:3:5:p 4:0:3:p 5:1:6:m>1 6:1:4:m>1 7:2:3:p 8:3:6:m>2 9:3:5:m>2 ' +
  '10:0:1:p 11:1:3:m>1 12:2:5:p 13:3:4:m>2 14:0:2:p 15:1:3:m>1 16:2:2:p 17:3:4:m>2 18:0:4:p ' +
  '19:1:4:m>1 20:2:1:p 21:3:4:m>2 22:0:6:m>1 23:0:3:m>1 24:1:1:m>1 25:2:2:p 26:3:3:m>2 ' +
  '27:0:1:m>1 28:1:1:m>1 29:2:4:p 30:3:3:m>2 31:0:5:m>1 32:1:1:m>1 33:2:4:p 34:3:3:m>2 ' +
  '35:0:3:m>1 36:1:1:m>1 37:2:3:p 38:3:4:m>2 39:0:2:m>1';

describe('dice and seats that must never change (v1)', () => {
  for (const difficulty of ['easy', 'normal', 'hard'] as const) {
    it(`pins the opening of a fixed seed at ${difficulty}`, () => {
      expect(traceOf(difficulty, 40)).toBe(OPENING);
    });
  }
});

describe('matches that must never change (v1)', () => {
  it('plays the same match at easy', () => {
    expect(playMatch('easy')).toEqual({
      status: 'won',
      rolls: 387,
      choices: 92,
      board: '59,59,59,59/0,59,28,13/20,58,17,59/59,0,0,12',
    });
  });

  it('plays the same match at normal', () => {
    expect(playMatch('normal')).toEqual({
      status: 'won',
      rolls: 445,
      choices: 108,
      board: '59,59,59,59/1,45,59,1/59,0,17,1/1,1,56,1',
    });
  });

  it('plays the same match at hard', () => {
    expect(playMatch('hard')).toEqual({
      status: 'won',
      rolls: 657,
      choices: 162,
      board: '59,59,59,59/59,22,8,59/9,0,19,58/59,59,0,59',
    });
  });

  it('plays three different matches at the three strengths', () => {
    // The same seed, the same dice, three different opponents: if two of
    // these ever came out the same the strengths would have stopped being
    // three different games.
    const finishes = (['easy', 'normal', 'hard'] as const).map((difficulty) =>
      JSON.stringify(playMatch(difficulty)),
    );
    expect(new Set(finishes).size).toBe(3);
  });

  it('replays a match identically when it is played twice', () => {
    expect(playMatch('normal')).toEqual(playMatch('normal'));
  });
});

describe('the saved-game format (v1)', () => {
  it('writes a suspended match as its seed, strength, roll count and choices', () => {
    let session = createSession('normal', SEED);
    for (let taken = 0; taken < BEAT_LIMIT && session.choices.length < 8; taken++) {
      session = step(session);
    }
    const record = canonicalRecordOf({ ...session, elapsedSeconds: 90 }, SAVED_AT)!;
    // Fifty-six throws in, the player has moved eight times and taken pawn 1
    // every one of them — the only pawn they had out (see the opening trace).
    expect(record).toEqual({
      schemaVersion: 1,
      seed: SEED,
      difficulty: 'normal',
      rollCount: 56,
      choices: '11111111',
      elapsedSeconds: 90,
      savedAt: SAVED_AT,
    });
  });

  it('names the game in every seed it mints', () => {
    expect(matchSeed('abc-def')).toBe('ludo-abc-def');
  });
});

describe('the numbers the matches were made of (v1)', () => {
  /**
   * Named here as well as in types.ts and engine.ts. Move any of them and
   * every trace above changes with it — and so does every match a player has
   * a saved record of.
   */
  it('keeps the board it promises', () => {
    expect(RING_SIZE).toBe(52);
    expect(SEAT_START_STRIDE).toBe(13);
    expect(HOME_PROGRESS).toBe(59);
    expect(SAFE_SQUARES).toEqual([0, 8, 13, 21, 26, 34, 39, 47]);
    expect(MAX_ROLLS).toBe(10_000);
  });
});
