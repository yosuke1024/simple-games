/**
 * The set's identity for the Club House (docs/architecture/club.md §6-4,
 * docs/QUICK_MATH_RULES.md Club section): the questions as the compatibility
 * golden writes them (`<tokens>=<answer>`, pipe-joined), through this game's
 * own xmur3. Not a guard against tampering — a check that two devices built the
 * same twenty questions, so a generator that changed between versions cannot
 * pair two different sets under one Today challenge.
 */
import { questionText } from './questions';
import { hashSeed } from './rng';
import type { Question } from './types';

/** `qm` (Quick Math) + the digest's contract version. */
export const BOARD_DIGEST_PREFIX = 'qm1:';

export function boardDigest(questions: readonly Question[]): string {
  const text = questions
    .map((question) => `${questionText(question)}=${question.answer}`)
    .join('|');
  return BOARD_DIGEST_PREFIX + hashSeed(text).toString(16).padStart(8, '0');
}

/** Any session's digest: the set is fixed at creation and rebuilt from the seed on resume. */
export function boardDigestOf(session: { readonly questions: readonly Question[] }): string {
  return boardDigest(session.questions);
}
