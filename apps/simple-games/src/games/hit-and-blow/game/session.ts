/**
 * HitAndBlowSession — a pure, immutable snapshot of one game in progress:
 * the seed (and the secret it deals), the guesses made so far, and the row
 * being composed. The React layer only dispatches into these functions; all
 * rules live here and in engine.ts.
 *
 * There is no undo and no hint (§6): a guess, once checked, is information,
 * and taking it back would break whatever was deduced from it. The row being
 * composed is freely editable until it is checked, and it is not saved (§8).
 *
 * There is no clock on screen (§10); elapsed seconds are carried here for
 * the statistics only.
 */
import { isSolvedBy, isValidGuess, secretFor } from './engine';
import {
  POOL_FOR,
  SLOTS_FOR,
  type Code,
  type Difficulty,
  type DraftSlot,
  type GameStatus,
} from './types';

export interface HitAndBlowSession {
  readonly seed: string;
  readonly difficulty: Difficulty;
  /** Derived from the seed (§2); held in memory, never persisted. */
  readonly secret: Code;
  /** Every checked guess, oldest first. */
  readonly guesses: readonly Code[];
  /** The row being composed: one entry per slot (§3). Not persisted (§8). */
  readonly draft: readonly DraftSlot[];
  /** 'won' once the last guess is the secret (§5). */
  readonly status: GameStatus;
  readonly elapsedSeconds: number;
}

/**
 * A token that makes one game's seed its own. There are no levels and no
 * dates to seed from, so every new game gets a new deal.
 */
export function newSeedToken(now: number = Date.now(), random: () => number = Math.random): string {
  return `${now.toString(36)}-${Math.floor(random() * 0xffffff).toString(36)}`;
}

export const gameSeed = (difficulty: Difficulty, token: string): string =>
  `hit-and-blow-${difficulty}-${token}`;

const emptyDraft = (difficulty: Difficulty): DraftSlot[] =>
  new Array<DraftSlot>(SLOTS_FOR[difficulty]).fill(null);

function statusOf(secret: Code, guesses: readonly Code[]): GameStatus {
  const last = guesses[guesses.length - 1];
  return last !== undefined && isSolvedBy(secret, last) ? 'won' : 'playing';
}

/** A fresh game: a new secret, no guesses, an empty row. */
export function createSession(
  difficulty: Difficulty,
  seed: string = gameSeed(difficulty, newSeedToken()),
): HitAndBlowSession {
  return {
    seed,
    difficulty,
    secret: secretFor(seed, difficulty),
    guesses: [],
    draft: emptyDraft(difficulty),
    status: 'playing',
    elapsedSeconds: 0,
  };
}

/** How many guesses have been checked — the score (§7). */
export const guessCount = (session: HitAndBlowSession): number => session.guesses.length;

export const isDraftFull = (draft: readonly DraftSlot[]): boolean =>
  draft.every((slot) => slot !== null);

const editable = (session: HitAndBlowSession): boolean => session.status === 'playing';

/**
 * Puts `symbol` in `slot` (§3). Null — nothing changes — when the game is
 * over, the slot or symbol is out of range, the slot already holds it, or the
 * symbol already sits elsewhere in the row (no symbol twice, §2).
 */
export function setDraftSlot(
  session: HitAndBlowSession,
  slot: number,
  symbol: number,
): HitAndBlowSession | null {
  if (!editable(session)) return null;
  if (!Number.isInteger(slot) || slot < 0 || slot >= session.draft.length) return null;
  if (!Number.isInteger(symbol) || symbol < 0 || symbol >= POOL_FOR[session.difficulty]) {
    return null;
  }
  if (session.draft.includes(symbol)) return null;
  const draft = [...session.draft];
  draft[slot] = symbol;
  return { ...session, draft };
}

/** Empties `slot` (§3). Null when it is already empty or the game is over. */
export function clearDraftSlot(session: HitAndBlowSession, slot: number): HitAndBlowSession | null {
  if (!editable(session)) return null;
  if ((session.draft[slot] ?? null) === null) return null;
  const draft = [...session.draft];
  draft[slot] = null;
  return { ...session, draft };
}

/**
 * Puts `symbol` in the first empty slot (§3) — a palette tap or a digit key.
 * Null when the row is full or the symbol is refused by `setDraftSlot`.
 */
export function pushSymbol(session: HitAndBlowSession, symbol: number): HitAndBlowSession | null {
  const slot = session.draft.indexOf(null);
  if (slot < 0) return null;
  return setDraftSlot(session, slot, symbol);
}

/** Empties the last filled slot (§3) — Backspace. Null when the row is empty. */
export function popSymbol(session: HitAndBlowSession): HitAndBlowSession | null {
  for (let slot = session.draft.length - 1; slot >= 0; slot--) {
    if (session.draft[slot] !== null) return clearDraftSlot(session, slot);
  }
  return null;
}

/**
 * Checks the composed row (§3, §5): it joins the history, the row empties,
 * and the game is won when it is the secret. Null unless the row is full and
 * a guess the rules accept.
 */
export function submitGuess(session: HitAndBlowSession): HitAndBlowSession | null {
  if (!editable(session)) return null;
  if (!isDraftFull(session.draft)) return null;
  const guess = session.draft as readonly number[];
  if (!isValidGuess(guess, session.difficulty)) return null;
  const guesses = [...session.guesses, [...guess]];
  return {
    ...session,
    guesses,
    draft: emptyDraft(session.difficulty),
    status: statusOf(session.secret, guesses),
  };
}

/**
 * Restores a game from what was persisted (§8). Returns null when any guess
 * is one the rules could not have accepted — so a save that did not come
 * from play is discarded, not repaired. A finished game restores as 'won';
 * the loader discards those too.
 */
export function restoreSession(data: {
  readonly seed: string;
  readonly difficulty: Difficulty;
  readonly guesses: readonly (readonly unknown[])[];
  readonly elapsedSeconds: number;
}): HitAndBlowSession | null {
  const guesses: Code[] = [];
  for (const guess of data.guesses) {
    if (!isValidGuess(guess, data.difficulty)) return null;
    guesses.push([...guess]);
  }
  const secret = secretFor(data.seed, data.difficulty);
  return {
    seed: data.seed,
    difficulty: data.difficulty,
    secret,
    guesses,
    draft: emptyDraft(data.difficulty),
    status: statusOf(secret, guesses),
    elapsedSeconds: data.elapsedSeconds,
  };
}
