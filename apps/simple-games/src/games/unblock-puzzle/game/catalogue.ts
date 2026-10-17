/**
 * The bundled boards of docs/UNBLOCK_PUZZLE_RULES.md §8 — every one of them
 * this game's own generator's output, never a board from anywhere else.
 *
 * Each tier's list is what the offline procedure of catalogueBuild.ts kept
 * from seeds `unblock-puzzle-base-<difficulty>-1`, `-2`, …: `buildBase`, a
 * climb with a budget far beyond a tap, skipping a seed that found nothing,
 * one that landed in an earlier entry's component and — for Easy and Medium,
 * whose deals change their base — one whose base would not take changes.
 * Every entry is a starting board in its tier (§7) with its exact fewest
 * moves. Hard deals an entry as it is; Easy and Medium change one first and
 * deal it as it is only when no change holds (`fallback`, §8); the daily is
 * a Medium entry as it is.
 *
 * catalogue.test.ts checks every entry — that it decodes to a legal board in
 * canonical order, that a complete search of its component gives exactly the
 * recorded fewest moves and puts it in its tier on both measures, and that an
 * independent brute-force search agrees — and catalogueBuild.test.ts re-runs
 * the procedure on a sample to prove the boards are this generator's output.
 *
 * The lists are stored compactly, because they are most of what this game
 * ships (§8): a board is one number, the choices met walking its cells in
 * reading order (below), and a tier's boards are grouped by fewest moves —
 * so the count is never stored per board — and sorted, so each is stored as
 * its gap from the one before (a Rice code), with the full number written
 * out every RUN boards so that reading one board never reads more than RUN.
 *
 * Regenerating the data is a decision, not a side effect: it moves every
 * board the generator deals (compatibility.test.ts pins some of them).
 */
import { CATALOGUE_DATA } from './catalogueData';
import {
  BOARD_SIZE,
  CELL_COUNT,
  TARGET_BLOCK,
  TARGET_ROW,
  type Block,
  type Board,
  type Difficulty,
} from './types';

/** One bundled board. */
export interface CatalogueEntry {
  /** Where it is in its tier's list. */
  readonly index: number;
  /** The starting board, blocks in canonical order (§8). */
  readonly board: Board;
  /** Its fewest moves to the exit — exact, checked by catalogue.test.ts. */
  readonly minMoves: number;
}

/**
 * One tier's boards that share a fewest-moves count, as catalogueBuild.ts
 * wrote them: sorted board codes in runs of RUN, the first of each run
 * written out (`firsts`), the rest as gaps — each code less the one before,
 * less one — in a Rice code whose parameter is chosen per run (`ks`), six
 * bits to a character of `bits`; `offsets` says where each run's gaps start,
 * in bits.
 */
export interface CatalogueBucket {
  readonly minMoves: number;
  readonly count: number;
  readonly firsts: readonly number[];
  readonly ks: readonly number[];
  readonly offsets: readonly number[];
  readonly bits: string;
}

export type CatalogueData = Readonly<Record<Difficulty, readonly CatalogueBucket[]>>;

/** Boards per written-out code: reading one board decodes at most RUN − 1 gaps. */
export const RUN = 64;

/**
 * Six bits per character, URL-safe base64 order with `~` where base64 has `-`.
 *
 * No hyphen, because this text ships in the game's chunk and the build-output
 * guard (.github/scripts/check-dist-ads-separation.sh) fails a build whose
 * files hold anything shaped like a GA4 measurement ID — `G-` and six capitals
 * or digits — or another hyphenated ad or site-chrome marker. Some 62,000
 * random base64 characters hold such a run with odds of about two in five,
 * and with `-` in the alphabet these did (`…HY-G-0AUCZ8f…`, 2026-10-17);
 * changing the character moves no board. catalogue.test.ts checks every
 * bucket against the guard's patterns.
 */
export const BIT_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789~_';

/**
 * What can start at a free cell in the walk (§1): nothing, the target (row 3
 * only, and only once), a horizontal block of 2 or 3 (any other row), a
 * vertical block of 2 or 3.
 */
export type CellChoice = 'empty' | 'target' | 'h2' | 'h3' | 'v2' | 'v3';

/**
 * The choices a free cell offers in the walk, in a fixed order, given the
 * cells already covered: a block that would leave the board or cover a
 * covered cell is not offered, nor a horizontal block in the target's row
 * other than the target (§1), nor a target already placed or one at the
 * exit (a bundled board is never solved, §3). Cells below a free cell are
 * never covered yet — a block covering one would start above it in the same
 * column and so cover the free cell too — so a vertical block that fits the
 * board always fits.
 */
export function cellChoices(
  cell: number,
  covered: Uint8Array,
  targetPlaced: boolean,
): CellChoice[] {
  const row = Math.floor(cell / BOARD_SIZE);
  const col = cell % BOARD_SIZE;
  const out: CellChoice[] = ['empty'];
  if (row === TARGET_ROW) {
    if (!targetPlaced && col <= 3 && covered[cell + 1] === 0) out.push('target');
  } else {
    if (col <= 4 && covered[cell + 1] === 0) out.push('h2');
    if (col <= 3 && covered[cell + 1] === 0 && covered[cell + 2] === 0) out.push('h3');
  }
  if (row <= 4) out.push('v2');
  if (row <= 3) out.push('v3');
  return out;
}

/** The block a choice places, or null for an empty cell. */
export function choiceBlock(choice: CellChoice, cell: number): Block | null {
  const row = Math.floor(cell / BOARD_SIZE);
  const col = cell % BOARD_SIZE;
  switch (choice) {
    case 'empty':
      return null;
    case 'target':
      return TARGET_BLOCK;
    case 'h2':
    case 'h3':
      return { orientation: 'h', length: choice === 'h2' ? 2 : 3, lane: row };
    default:
      return { orientation: 'v', length: choice === 'v2' ? 2 : 3, lane: col };
  }
}

/**
 * The board a code stands for, or null when the code is not one: walking the
 * cells in reading order, each free cell takes the choice `code mod n` of its
 * n choices (`cellChoices`) and the code moves on to `code div n`. Blocks are
 * numbered in the order they are met, the target first — canonical order
 * (§8). Null when the walk ends with code left over or without a target.
 */
export function boardFromCode(code: number): Board | null {
  if (!Number.isSafeInteger(code) || code < 0) return null;
  const covered = new Uint8Array(CELL_COUNT);
  let target = -1;
  const blocks: Block[] = [];
  const positions: number[] = [];
  let rest = code;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (covered[cell] === 1) continue;
    const choices = cellChoices(cell, covered, target >= 0);
    const choice = choices[rest % choices.length]!;
    rest = Math.floor(rest / choices.length);
    const block = choiceBlock(choice, cell);
    if (block === null) continue;
    const step = block.orientation === 'h' ? 1 : BOARD_SIZE;
    for (let k = 0; k < block.length; k++) covered[cell + k * step] = 1;
    const position = block.orientation === 'h' ? cell % BOARD_SIZE : Math.floor(cell / BOARD_SIZE);
    if (choice === 'target') target = position;
    else {
      blocks.push(block);
      positions.push(position);
    }
  }
  if (rest !== 0 || target < 0) return null;
  return { blocks: [TARGET_BLOCK, ...blocks], positions: [target, ...positions] };
}

const BIT_VALUE = ((): Int8Array => {
  const table = new Int8Array(128).fill(-1);
  for (let i = 0; i < BIT_ALPHABET.length; i++) table[BIT_ALPHABET.charCodeAt(i)] = i;
  return table;
})();

/** Reads bits, most significant first, six to a character. */
class BitReader {
  constructor(
    private readonly text: string,
    private at: number,
  ) {}

  bit(): number {
    const value = BIT_VALUE[this.text.charCodeAt(Math.floor(this.at / 6))] ?? -1;
    if (value < 0) throw new Error('unblock-puzzle: bundled data is not six-bit text');
    const bit = (value >> (5 - (this.at % 6))) & 1;
    this.at++;
    return bit;
  }

  /** One Rice-coded number: ones up to a zero (the quotient), then `k` bits. */
  rice(k: number): number {
    let quotient = 0;
    while (this.bit() === 1) quotient++;
    let remainder = 0;
    for (let i = 0; i < k; i++) remainder = remainder * 2 + this.bit();
    return quotient * 2 ** k + remainder;
  }
}

/** The code of a bucket's `index`-th board: the run's written-out code plus its gaps. */
export function bucketCode(bucket: CatalogueBucket, index: number): number {
  const run = Math.floor(index / RUN);
  let code = bucket.firsts[run]!;
  const reader = new BitReader(bucket.bits, bucket.offsets[run]!);
  const k = bucket.ks[run]!;
  for (let i = run * RUN + 1; i <= index; i++) code += reader.rice(k) + 1;
  return code;
}

/** How many boards a tier bundles. */
export function catalogueSize(
  difficulty: Difficulty,
  data: CatalogueData = CATALOGUE_DATA,
): number {
  return data[difficulty].reduce((sum, bucket) => sum + bucket.count, 0);
}

/**
 * A tier's `index`-th bundled board (0 ≤ index < `catalogueSize`), in the
 * order the data holds them: by fewest moves, then by code. Reads at most
 * RUN − 1 gaps. Throws only if the bundled data is broken, which
 * catalogue.test.ts rules out for every entry.
 */
export function catalogueEntry(
  difficulty: Difficulty,
  index: number,
  data: CatalogueData = CATALOGUE_DATA,
): CatalogueEntry {
  let rest = index;
  for (const bucket of data[difficulty]) {
    if (rest < bucket.count) {
      const board = boardFromCode(bucketCode(bucket, rest));
      if (board === null) {
        throw new Error(`unblock-puzzle: bundled ${difficulty} board ${index} is broken`);
      }
      return { index, board, minMoves: bucket.minMoves };
    }
    rest -= bucket.count;
  }
  throw new RangeError(`unblock-puzzle: no bundled ${difficulty} board ${index}`);
}
