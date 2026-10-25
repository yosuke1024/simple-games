import { isPossibleScore, scoreFor, sheetTotal } from '../games/yacht/game/engine';
import { CATEGORIES, isCategory, type Category } from '../games/yacht/game/types';
export { scoreFor } from '../games/yacht/game/engine';
export { CATEGORIES, type Category } from '../games/yacht/game/types';

/** Separate two-player rules; never reads/writes solo state, saves, statistics or Club results. */
export type Action =
  { kind: 'roll' } | { kind: 'hold'; index: number } | { kind: 'score'; category: Category };
export interface Match {
  round: number;
  revision: number;
  scores: [Array<number | null>, Array<number | null>];
  dice: number[];
  held: boolean[];
  rolls: number;
}
export const record = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
export const integer = (v: unknown, min: number, max: number): v is number =>
  Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
export const count = (sheet: Array<number | null>) => sheet.filter((n) => n !== null).length;
export const finished = (m: Match) => m.scores.every((s) => count(s) === 12);
export const turn = (m: Match): 0 | 1 => (count(m.scores[0]) === count(m.scores[1]) ? 0 : 1);
export const totals = (m: Match) => m.scores.map(sheetTotal);
export const newMatch = (round: number): Match => ({
  round,
  revision: 0,
  scores: [Array(12).fill(null), Array(12).fill(null)],
  dice: [1, 1, 1, 1, 1],
  held: [false, false, false, false, false],
  rolls: 0,
});

export function isAction(v: unknown): v is Action {
  if (!record(v)) return false;
  return (
    (v.kind === 'roll' && Object.keys(v).length === 1) ||
    (v.kind === 'hold' && Object.keys(v).length === 2 && integer(v.index, 0, 4)) ||
    (v.kind === 'score' && Object.keys(v).length === 2 && isCategory(v.category))
  );
}

export function isMatch(v: unknown): v is Match {
  if (
    !record(v) ||
    !integer(v.round, 1, 10000) ||
    !integer(v.revision, 0, 100000) ||
    !integer(v.rolls, 0, 3)
  )
    return false;
  if (
    !Array.isArray(v.scores) ||
    v.scores.length !== 2 ||
    !v.scores.every(
      (s: unknown) =>
        Array.isArray(s) &&
        s.length === 12 &&
        s.every(
          (n: unknown, i: number) =>
            n === null || (integer(n, 0, 50) && isPossibleScore(CATEGORIES[i]!, n)),
        ),
    )
  )
    return false;
  if (
    !Array.isArray(v.dice) ||
    v.dice.length !== 5 ||
    !v.dice.every((n: unknown) => integer(n, 1, 6))
  )
    return false;
  if (
    !Array.isArray(v.held) ||
    v.held.length !== 5 ||
    !v.held.every((n: unknown) => typeof n === 'boolean')
  )
    return false;
  const m = v as unknown as Match;
  const a = count(m.scores[0]),
    b = count(m.scores[1]);
  if (a !== b && a !== b + 1) return false;
  if ((m.rolls === 0 && m.held.some(Boolean)) || (finished(m) && m.rolls !== 0)) return false;
  if (m.revision < 2 * (a + b) + m.rolls) return false;
  return true;
}

/** Only the logical host calls this; the remote seat is bound to its connection. */
export function apply(m: Match, seat: 0 | 1, action: Action, die: () => number): Match | null {
  if (finished(m) || turn(m) !== seat || m.revision >= 100000) return null;
  const next: Match = {
    ...m,
    revision: m.revision + 1,
    scores: [m.scores[0].slice(), m.scores[1].slice()],
    dice: m.dice.slice(),
    held: m.held.slice(),
  };
  if (action.kind === 'roll') {
    if (m.rolls >= 3 || m.held.every(Boolean)) return null;
    // Five host-side draws per throw, including kept positions, like the solo rules.
    const faces = Array.from({ length: 5 }, die);
    if (!faces.every((n) => integer(n, 1, 6))) throw new Error('Invalid host RNG');
    next.dice = faces.map((n, i) => (m.held[i] ? m.dice[i]! : n));
    next.rolls++;
  } else if (action.kind === 'hold') {
    if (m.rolls === 0 || m.rolls === 3) return null;
    next.held[action.index] = !next.held[action.index];
  } else {
    const index = CATEGORIES.indexOf(action.category);
    if (m.rolls === 0 || m.scores[seat][index] !== null) return null;
    next.scores[seat][index] = scoreFor(action.category, m.dice);
    next.rolls = 0;
    next.held.fill(false);
  }
  return next;
}
