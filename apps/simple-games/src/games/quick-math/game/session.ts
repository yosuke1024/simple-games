/**
 * QuickMathSession — a pure, immutable snapshot of one set in progress: the
 * questions, how many are answered, and the counters. The React layer only
 * dispatches into these functions; all rules live here.
 *
 * The digits being typed are NOT here. They are transient interface state that
 * belongs to the keypad: they are never saved, and a set resumed mid-question
 * starts that question with an empty box (§9). Keeping them out of the session
 * is what makes the saved record four small numbers.
 *
 * There is no clock on screen (§4); elapsed seconds are carried here for the
 * clear screen and the statistics only.
 */
import { dailySeed, dailySpec, QUESTIONS_PER_DAILY } from './daily';
import { clampLevel, levelSeed, QUESTIONS_PER_LEVEL, specForLevel } from './levels';
import { generateQuestions } from './questions';
import { createRng } from './rng';
import { MAX_ANSWER_DIGITS, type GameMode, type GameStatus, type Question } from './types';

export interface QuickMathSession {
  readonly mode: GameMode;
  readonly seed: string;
  /** Local YYYY-MM-DD for daily mode, null for level mode. */
  readonly dailyDate: string | null;
  /** 1..100 for level mode, null for daily. */
  readonly level: number | null;
  /**
   * The whole set. Regenerated from the seed on resume rather than saved —
   * the seed and the question index say everything (§9).
   */
  readonly questions: readonly Question[];
  /** How many have been answered correctly. Also the index of the current one. */
  readonly solvedCount: number;
  /** Wrong answers so far. Counted, never punished (§3). */
  readonly missCount: number;
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
}

function baseSession(
  mode: GameMode,
  seed: string,
  dailyDate: string | null,
  level: number | null,
  questions: readonly Question[],
): QuickMathSession {
  return {
    mode,
    seed,
    dailyDate,
    level,
    questions,
    solvedCount: 0,
    missCount: 0,
    status: 'playing',
    elapsedSeconds: 0,
  };
}

/** The ten questions of a level — the same ten for everybody (§6). */
export function questionsForLevel(level: number): Question[] {
  const target = clampLevel(level);
  return generateQuestions(createRng(levelSeed(target)), specForLevel(target), QUESTIONS_PER_LEVEL);
}

/** The twenty questions of a day (§7). */
export function questionsForDaily(dateString: string): Question[] {
  return generateQuestions(createRng(dailySeed(dateString)), dailySpec(), QUESTIONS_PER_DAILY);
}

/** A fresh (or restarted) level set — deterministic per level. */
export function createLevelSession(level: number): QuickMathSession {
  const target = clampLevel(level);
  return baseSession('level', levelSeed(target), null, target, questionsForLevel(target));
}

/** A fresh (or restarted) daily set for a local YYYY-MM-DD date. */
export function createDailySession(dateString: string): QuickMathSession {
  return baseSession(
    'daily',
    dailySeed(dateString),
    dateString,
    null,
    questionsForDaily(dateString),
  );
}

/** Rebuilds the same set from scratch (Retry — the same ten questions). */
export function restartSession(session: QuickMathSession): QuickMathSession {
  return session.mode === 'level' && session.level !== null
    ? createLevelSession(session.level)
    : createDailySession(session.dailyDate ?? '');
}

/**
 * Restores a set from persisted state. The questions come back from the seed,
 * not from disk (§9) — which also means a saved record can never disagree with
 * the generator about what question 7 was.
 */
export function restoreSession(
  data: Pick<
    QuickMathSession,
    'mode' | 'dailyDate' | 'level' | 'solvedCount' | 'missCount' | 'elapsedSeconds'
  >,
): QuickMathSession | null {
  const rebuilt =
    data.mode === 'level' && data.level !== null
      ? createLevelSession(data.level)
      : data.dailyDate !== null
        ? createDailySession(data.dailyDate)
        : null;
  if (rebuilt === null) return null;

  // A saved index past the end of the set is a record from another build's
  // ladder. Refusing it costs one set; trusting it would put the game on a
  // question that does not exist.
  if (data.solvedCount < 0 || data.solvedCount >= rebuilt.questions.length) return null;

  return {
    ...rebuilt,
    solvedCount: data.solvedCount,
    missCount: data.missCount,
    elapsedSeconds: data.elapsedSeconds,
  };
}

/** The question on screen, or null once the set is finished. */
export function currentQuestion(session: QuickMathSession): Question | null {
  return session.status === 'playing' ? (session.questions[session.solvedCount] ?? null) : null;
}

/**
 * How many digits the answer has — what the keypad waits for before judging
 * (§3). It is also, unavoidably, a hint about the answer's size; the rules say
 * so out loud rather than pretending otherwise.
 */
export function answerDigits(question: Question): number {
  return Math.min(String(question.answer).length, MAX_ANSWER_DIGITS);
}

export interface AnswerOutcome {
  readonly session: QuickMathSession;
  readonly correct: boolean;
}

/**
 * Submits an answer.
 *
 * A wrong answer costs nothing but a tally: the same question comes straight
 * back, no time is taken away, and the set cannot be failed (§3). Returns null
 * when there is nothing to answer.
 */
export function answerQuestion(session: QuickMathSession, value: number): AnswerOutcome | null {
  const question = currentQuestion(session);
  if (question === null) return null;

  if (value !== question.answer) {
    return { session: { ...session, missCount: session.missCount + 1 }, correct: false };
  }

  const solvedCount = session.solvedCount + 1;
  return {
    session: {
      ...session,
      solvedCount,
      status: solvedCount === session.questions.length ? 'cleared' : 'playing',
    },
    correct: true,
  };
}
