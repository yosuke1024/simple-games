/**
 * Compact, corruption-tolerant board serialization for local persistence
 * (docs/LOOP_PUZZLE_RULES.md §12).
 *
 * A saved board is two strings: the clues, one character per cell
 * (`0`–`3`, `.` for none), and the player's marks, one character per edge
 * (`.` UNKNOWN, `L` LINE, `X` CROSS). A 6×6 board is 36 + 84 characters.
 * Beside them sits a short digest of the clues (`cluesDigest`).
 *
 * **The answer is not saved.** It is re-derived on load by the counting
 * search (`uniqueSolution`), which is also the check that the clues are a
 * board the rules accept: exactly one loop, proven within the node limit
 * (§8). A record whose clues admit no loop, two loops, or more search than
 * the limit allows is not one play produced, and decoding fails closed —
 * the caller drops it and the player lands on the home screen, never on a
 * board with no answer.
 *
 * That check is not provenance: it does not ask whether the clues are the
 * seed's board, and on purpose — the record keeps its clues so that a game
 * in progress outlives a generator change (§12). What catches a clue string
 * corrupted into a *different* one-loop board is the digest: it is computed
 * when the record is written and compared on load, at the cost of one hash.
 */
import { isSolved } from './engine';
import { gridFor } from './grid';
import { hashSeed } from './rng';
import { COUNT_NODE_LIMIT, uniqueSolution } from './solver';
import {
  CROSS,
  LINE,
  UNKNOWN,
  isClue,
  isValidClueList,
  type Clue,
  type Layout,
  type Mark,
  type Marks,
  type Preset,
} from './types';

const NO_CLUE = '.';
const MARK_CHARACTERS: Record<Mark, string> = { [UNKNOWN]: '.', [LINE]: 'L', [CROSS]: 'X' };

export function encodeClues(clues: readonly Clue[]): string {
  return clues.map((clue) => (clue === null ? NO_CLUE : String(clue))).join('');
}

/** Decodes a clue string for a W×H board. Null unless every character is `0`–`3` or `.`. */
export function decodeClues(text: unknown, width: number, height: number): Clue[] | null {
  if (typeof text !== 'string' || text.length !== width * height) return null;
  const clues: Clue[] = [];
  for (const character of text) {
    if (character === NO_CLUE) {
      clues.push(null);
      continue;
    }
    if (character < '0' || character > '9') return null;
    const clue = Number(character);
    if (!isClue(clue)) return null;
    clues.push(clue);
  }
  return isValidClueList(clues, width, height) ? clues : null;
}

/**
 * The digest a record carries beside its clues (§12): `lp1:` and eight hex
 * digits of `hashSeed` over the clue string. A check against corruption, not
 * against a deliberate edit — the record is the player's own.
 */
export function cluesDigest(clues: readonly Clue[]): string {
  return `lp1:${hashSeed(encodeClues(clues)).toString(16).padStart(8, '0')}`;
}

export function encodeMarks(marks: Marks): string {
  return marks.map((mark) => MARK_CHARACTERS[mark]).join('');
}

/** Decodes a marks string for a board with `edgeCount` edges. Null on any other character. */
export function decodeMarks(text: unknown, edgeCount: number): Mark[] | null {
  if (typeof text !== 'string' || text.length !== edgeCount) return null;
  const marks: Mark[] = [];
  for (const character of text) {
    if (character === '.') marks.push(UNKNOWN);
    else if (character === 'L') marks.push(LINE);
    else if (character === 'X') marks.push(CROSS);
    else return null;
  }
  return marks;
}

export interface DecodedBoard {
  readonly clues: Clue[];
  /** Re-derived, not read: the one loop the clues admit (§8). */
  readonly solution: Mark[];
  readonly marks: Mark[];
}

/**
 * The board of one saved game, checked as far as play could have produced
 * it (§12). Null when:
 *
 * - the size is not the preset's, or a string has the wrong length or an
 *   unknown character;
 * - the digest is not the clues' own (`cluesDigest`) — the clues were
 *   damaged, even if into another valid board;
 * - the clues do not have exactly one loop, proven within the node limit;
 * - the marks already solve the board — a finished game is history, not
 *   something to resume.
 *
 * Every combination of marks is reachable by tapping, so the marks need no
 * further check: a LINE or CROSS that breaks a rule is part of play (§5).
 */
export function decodeBoard(
  parts: { width: unknown; height: unknown; clues: unknown; digest: unknown; marks: unknown },
  preset: Preset,
  nodeLimit: number = COUNT_NODE_LIMIT,
): DecodedBoard | null {
  if (parts.width !== preset.width || parts.height !== preset.height) return null;
  const { width, height } = preset;
  const clues = decodeClues(parts.clues, width, height);
  if (clues === null || parts.digest !== cluesDigest(clues)) return null;
  const marks = decodeMarks(parts.marks, gridFor(width, height).edgeCount);
  if (marks === null) return null;
  const layout: Layout = { width, height, clues };
  const solution = uniqueSolution(layout, { nodeLimit });
  if (solution === null) return null;
  if (isSolved(layout, marks)) return null;
  return { clues, solution, marks };
}
