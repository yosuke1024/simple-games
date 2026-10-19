/**
 * How the bundled catalogue (catalogue.ts, catalogueData.ts) is made —
 * docs/UNBLOCK_PUZZLE_RULES.md §8. Offline only: nothing here runs on a tap,
 * and no file the app imports imports this one, so none of it ships.
 * catalogue.generate.test.ts runs it to regenerate the data, and
 * catalogueBuild.test.ts re-runs it on a sample to prove the bundled boards
 * are its output.
 *
 * The procedure, per tier:
 *
 * 1. **Scan** seeds `unblock-puzzle-base-<difficulty>-1`, `-2`, … through
 *    `buildBase` — a hill climb with a budget far beyond a tap — and, for
 *    Easy and Medium, count how many of BASE_PROBES probe changes to the
 *    result hold (`probeChanges`). One seed's record depends on that seed
 *    alone, so the scan can run in pieces, side by side.
 * 2. **Select** in seed order (`selectCatalogue`): skip a seed `buildBase`
 *    found nothing for, one whose board shares a component (the same blocks
 *    in the same lanes, the same component size) with an earlier kept entry,
 *    and — Easy and Medium only, whose deals change their base — one whose
 *    base held fewer than BASE_PROBES_KEPT probe changes, until the tier's
 *    count is kept.
 * 3. **Encode** (`encodeCatalogue`): each board as its code (`boardCode`,
 *    the inverse of catalogue.ts `boardFromCode`), grouped by fewest moves,
 *    sorted, gaps in a Rice code.
 */
import {
  BIT_ALPHABET,
  RUN,
  boardFromCode,
  cellChoices,
  choiceBlock,
  type CatalogueBucket,
  type CatalogueData,
} from './catalogue';
import {
  COMPONENT_LIMIT,
  TIERS,
  changeBoard,
  chooseStart,
  componentKey,
  meetsBlockBounds,
  playedOut,
  randomArrangement,
  tryChange,
  type Chosen,
} from './generator';
import { createRng } from './rng';
import { exploreComponent, searchWork, solve, type Component } from './search';
import { decodeBoard, encodeBoard } from './serialize';
import {
  BOARD_SIZE,
  CELL_COUNT,
  DIFFICULTIES,
  TARGET_INDEX,
  blockCells,
  type Board,
  type Difficulty,
} from './types';

/** Work one base may spend; only `buildBase` (offline) spends it, never a tap (§8). */
export const BASE_WORK_LIMIT = 30_000_000;

/** Changes without a deeper board before the climb starts over (§8). */
export const BASE_PATIENCE = 40;

/** Probe changes tried on an Easy or Medium base before it is bundled (§8). */
export const BASE_PROBES = 48;

/** Probe changes that must hold for an Easy or Medium base to be bundled (§8): one in ten or better. */
export const BASE_PROBES_KEPT = 5;

/** The seed `buildBase` is run with for a tier's n-th scan. */
export const baseSeed = (difficulty: Difficulty, n: number): string =>
  `unblock-puzzle-base-${difficulty}-${n}`;

/** What `buildBase` found: a starting board in the tier and the numbers the climb measured. */
export interface BuiltBase extends Chosen {
  /** Arrangements searched. */
  readonly attempts: number;
  /** Work spent, in `searchWork` units. */
  readonly work: number;
}

/** One of a component's boards furthest from the exit, chosen by the rng. */
function farthestBoard(component: Component, rng: () => number): Board {
  const far: number[] = [];
  for (let index = 0; index < component.size; index++) {
    if (component.goalDistance[index] === component.maxDistance) far.push(index);
  }
  const index = far[Math.floor(rng() * far.length)]!;
  return { blocks: component.blocks, positions: component.positionsAt(index) };
}

/**
 * One bundled board from one seed (§8): a hill climb over arrangements. Start
 * from a random solved arrangement; change the component's farthest board and
 * keep the change when the component's greatest distance does not drop;
 * start over after BASE_PATIENCE changes without progress. (Changing the
 * farthest board climbs faster than changing a solved one — measured, §8 —
 * at the price of changes that wall the exit off, which the climb simply
 * discards.) Once a component reaches the tier's `baseDistance`, a starting
 * board in the tier is chosen from it, the same way a deal chooses one. Null
 * when BASE_WORK_LIMIT runs out first.
 */
export function buildBase(seed: string, difficulty: Difficulty): BuiltBase | null {
  const spec = TIERS[difficulty];
  const rng = createRng(seed);
  const before = searchWork.read();
  let current: { board: Board; distance: number } | null = null;
  let stale = 0;
  let attempts = 0;
  while (searchWork.read() - before < BASE_WORK_LIMIT) {
    const previous: { board: Board; distance: number } | null =
      stale >= BASE_PATIENCE ? null : current;
    if (previous === null) stale = 0;
    const board =
      previous === null ? randomArrangement(rng, spec) : changeBoard(previous.board, rng, spec);
    current = previous;
    if (board === null) {
      stale++;
      continue;
    }
    attempts++;
    const result = exploreComponent(board, COMPONENT_LIMIT);
    if (result.status !== 'complete' || result.component.maxDistance < 0) {
      stale++;
      continue;
    }
    const { component } = result;
    if (component.maxDistance >= spec.baseDistance) {
      const chosen = chooseStart(component, rng, spec);
      if (chosen !== null && meetsBlockBounds(spec, chosen.board)) {
        return { ...chosen, attempts, work: searchWork.read() - before };
      }
    }
    if (current !== null && component.maxDistance <= current.distance) {
      stale++;
      if (component.maxDistance < current.distance) continue;
    } else {
      stale = 0;
    }
    current = { board: farthestBoard(component, rng), distance: component.maxDistance };
  }
  return null;
}

/**
 * How many of BASE_PROBES probe changes to a base hold (§8). The changes,
 * drawn by the seed `<base seed>#probe`, are tried on the solved board a
 * deal from the base starts from, each judged exactly as a deal judges its
 * change (`tryChange`, with the tier's `changeComponentLimit` and no work
 * limit). Some bases are rigid — almost every change to them loses the tier
 * — and a deal from a rigid base often finds no change and ends as the base
 * itself; the catalogue leaves those out of Easy and Medium.
 */
export function probeChanges(seed: string, board: Board, difficulty: Difficulty): number {
  const spec = TIERS[difficulty];
  const way = solve(board, COMPONENT_LIMIT);
  if (way.status !== 'solved') return 0;
  const solved = playedOut(board, way.solution);
  const had = new Set([componentKey(board)]);
  const rng = createRng(`${seed}#probe`);
  let kept = 0;
  for (let n = 0; n < BASE_PROBES; n++) {
    const change = tryChange(
      solved,
      rng,
      spec,
      had,
      spec.changeComponentLimit,
      Number.POSITIVE_INFINITY,
    );
    if (change !== null) kept++;
  }
  return kept;
}

/** Whether a tier's selection asks for probes: only tiers whose deals change their base. */
export const probesBases = (difficulty: Difficulty): boolean => TIERS[difficulty].changes;

/**
 * Changed boards found per Hard base (§8): the boards a deal of the old design
 * reached on the tap, made offline instead. A tier dealt as it is needs many
 * more boards than climbs find distinct summits — they keep arriving at the
 * same few (§8) — and a base's change is as much a puzzle of its own as the
 * base, so each base brings up to this many.
 */
export const CHILDREN = 4;

/** Changes tried per Hard base for its children. */
export const CHILD_TRIES = 96;

/** Whether a tier's bases bring children: the tiers dealt as they are. */
export const hasChildren = (difficulty: Difficulty): boolean => !TIERS[difficulty].changes;

/** A board the scan found and measured. */
export interface ScannedBoard {
  /** The board as `encodeBoard` writes it. */
  readonly board: string;
  readonly minMoves: number;
  readonly exploredStates: number;
  readonly componentSize: number;
}

/**
 * Up to CHILDREN changed boards of a base (Hard): changes drawn by the seed
 * `<base seed>#child` and tried — at most CHILD_TRIES — on the base's solved
 * arrangement, each judged as a deal judges a change (`tryChange`, no work
 * limit), each with blocks the base and the earlier children do not have.
 */
export function childrenOf(seed: string, board: Board, difficulty: Difficulty): ScannedBoard[] {
  const spec = TIERS[difficulty];
  const way = solve(board, COMPONENT_LIMIT);
  if (way.status !== 'solved') return [];
  const solved = playedOut(board, way.solution);
  const had = new Set([componentKey(board)]);
  const rng = createRng(`${seed}#child`);
  const out: ScannedBoard[] = [];
  for (let n = 0; n < CHILD_TRIES && out.length < CHILDREN; n++) {
    const kept = tryChange(solved, rng, spec, had, COMPONENT_LIMIT, Number.POSITIVE_INFINITY);
    if (kept === null) continue;
    had.add(kept.key);
    out.push({
      board: encodeBoard(kept.chosen.board),
      minMoves: kept.chosen.minMoves,
      exploredStates: kept.chosen.exploredStates,
      componentSize: kept.chosen.componentSize,
    });
  }
  return out;
}

/**
 * One scanned seed (step 1): what `buildBase` returned, the probe count
 * where asked (Easy, Medium), and the children where asked (Hard).
 */
export interface ScanRecord extends Partial<Omit<ScannedBoard, 'board'>> {
  readonly n: number;
  /** The base as `encodeBoard` writes it; null when `buildBase` found nothing. */
  readonly board: string | null;
  /** Probe changes that held (Easy and Medium only). */
  readonly probes?: number;
  /** The base's children (Hard only). */
  readonly children?: readonly ScannedBoard[];
}

/** Step 1 for one seed. */
export function scanSeed(difficulty: Difficulty, n: number): ScanRecord {
  const seed = baseSeed(difficulty, n);
  const built = buildBase(seed, difficulty);
  if (built === null) return { n, board: null };
  const record = {
    n,
    board: encodeBoard(built.board),
    minMoves: built.minMoves,
    exploredStates: built.exploredStates,
    componentSize: built.componentSize,
  };
  if (probesBases(difficulty)) {
    return { ...record, probes: probeChanges(seed, built.board, difficulty) };
  }
  return hasChildren(difficulty)
    ? { ...record, children: childrenOf(seed, built.board, difficulty) }
    : record;
}

/** A bundled board as step 2 kept it. */
export interface KeptBoard extends ScannedBoard {
  /** The seed it came from. */
  readonly n: number;
  /** 0 for the seed's base, k for its k-th child. */
  readonly child: number;
}

/** What step 2 kept and why it skipped the rest. */
export interface Selection {
  /** Kept boards: the bases in seed order, then the children round by round. */
  readonly kept: readonly KeptBoard[];
  /** Seeds read: 1 … tried. */
  readonly tried: number;
  readonly nulls: readonly number[];
  readonly duplicates: readonly number[];
  readonly rigid: readonly number[];
  /** Children kept, and children skipped for a component already kept. */
  readonly children: number;
  readonly childDuplicates: number;
  /** The last round of children begun (1-based); 0 when the bases alone filled the list. */
  readonly lastRound: number;
}

/**
 * Step 2: records for seeds 1, 2, … (in that order, none missing) through
 * the skipping rules, until `count` boards are kept or the records run out.
 * Bases first, in seed order; then (Hard) the first child of every kept
 * base, in seed order, then every second child, and so on — so that a
 * count the bases alone do not reach spreads its children over all of them
 * rather than piling them onto the first. A child is skipped when its
 * component is already kept.
 */
export function selectCatalogue(
  difficulty: Difficulty,
  records: readonly ScanRecord[],
  count: number,
): Selection {
  const kept: KeptBoard[] = [];
  const nulls: number[] = [];
  const duplicates: number[] = [];
  const rigid: number[] = [];
  let children = 0;
  let childDuplicates = 0;
  const seen = new Set<string>();
  const keyOf = (text: string, size: number | undefined, n: number): string => {
    const board = decodeBoard(text);
    if (board === null) throw new Error(`catalogue scan: seed ${n} does not decode`);
    return `${componentKey(board)}:${size}`;
  };
  const bases: ScanRecord[] = [];
  let tried = 0;
  for (const record of records) {
    if (kept.length >= count) break;
    if (record.n !== tried + 1) throw new Error(`catalogue scan: seed ${tried + 1} missing`);
    tried++;
    if (record.board === null) {
      nulls.push(record.n);
      continue;
    }
    const key = keyOf(record.board, record.componentSize, record.n);
    if (seen.has(key)) {
      duplicates.push(record.n);
      continue;
    }
    if (probesBases(difficulty) && (record.probes ?? 0) < BASE_PROBES_KEPT) {
      rigid.push(record.n);
      continue;
    }
    seen.add(key);
    bases.push(record);
    kept.push({
      n: record.n,
      child: 0,
      board: record.board,
      minMoves: record.minMoves!,
      exploredStates: record.exploredStates!,
      componentSize: record.componentSize!,
    });
  }
  let lastRound = 0;
  for (let round = 0; round < CHILDREN && kept.length < count; round++) {
    lastRound = round + 1;
    for (const base of bases) {
      if (kept.length >= count) break;
      const child = base.children?.[round];
      if (child === undefined) continue;
      const key = keyOf(child.board, child.componentSize, base.n);
      if (seen.has(key)) {
        childDuplicates++;
        continue;
      }
      seen.add(key);
      kept.push({ ...child, n: base.n, child: round + 1 });
      children++;
    }
  }
  return { kept, tried, nulls, duplicates, rigid, children, childDuplicates, lastRound };
}

/** Steps 1 and 2 in one go, seed by seed: for tests, and for small tiers. */
export function buildCatalogue(
  difficulty: Difficulty,
  count: number,
  maxTried: number = 10 * count + 100,
): Selection {
  const records: ScanRecord[] = [];
  for (let n = 1; n <= maxTried; n++) {
    records.push(scanSeed(difficulty, n));
    if (selectCatalogue(difficulty, records, count).kept.length >= count) break;
  }
  return selectCatalogue(difficulty, records, count);
}

// ---------- step 3: the compact form ----------

/**
 * A board's code — the inverse of catalogue.ts `boardFromCode`: walking the
 * cells in reading order, each free cell's choice among its `cellChoices`,
 * read as the digits of one mixed-radix number, the first cell's the lowest.
 * Throws for a board the walk cannot write: one not in canonical order, a
 * solved one, or one whose code would not be a safe integer.
 */
export function boardCode(board: Board): number {
  const startOf = new Map<number, number>();
  board.blocks.forEach((block, index) => {
    startOf.set(blockCells(block, board.positions[index]!)[0]!, index);
  });
  const covered = new Uint8Array(CELL_COUNT);
  let targetPlaced = false;
  let code = 0;
  let scale = 1;
  for (let cell = 0; cell < CELL_COUNT; cell++) {
    if (covered[cell] === 1) continue;
    const choices = cellChoices(cell, covered, targetPlaced);
    const index = startOf.get(cell);
    const block = index === undefined ? null : board.blocks[index]!;
    const choice =
      block === null
        ? 'empty'
        : index === TARGET_INDEX
          ? 'target'
          : `${block.orientation}${block.length}`;
    const digit = choices.indexOf(choice as (typeof choices)[number]);
    if (digit < 0) throw new Error(`boardCode: ${encodeBoard(board)} cannot be walked`);
    code += digit * scale;
    scale *= choices.length;
    if (!Number.isSafeInteger(scale)) throw new Error('boardCode: code past 2^53');
    const placed = choiceBlock(choices[digit]!, cell);
    if (placed === null) continue;
    if (index === TARGET_INDEX) targetPlaced = true;
    const step = placed.orientation === 'h' ? 1 : BOARD_SIZE;
    for (let k = 0; k < placed.length; k++) covered[cell + k * step] = 1;
  }
  const back = boardFromCode(code);
  if (back === null || encodeBoard(back) !== encodeBoard(board)) {
    throw new Error(`boardCode: ${encodeBoard(board)} does not read back`);
  }
  return code;
}

/** Writes bits, most significant first, six to a character. */
class BitWriter {
  private readonly bits: number[] = [];

  get length(): number {
    return this.bits.length;
  }

  write(value: number, width: number): void {
    for (let i = width - 1; i >= 0; i--) this.bits.push(Math.floor(value / 2 ** i) % 2);
  }

  rice(value: number, k: number): void {
    const quotient = Math.floor(value / 2 ** k);
    for (let i = 0; i < quotient; i++) this.bits.push(1);
    this.bits.push(0);
    this.write(value % 2 ** k, k);
  }

  text(): string {
    let out = '';
    for (let at = 0; at < this.bits.length; at += 6) {
      let value = 0;
      for (let i = 0; i < 6; i++) value = value * 2 + (this.bits[at + i] ?? 0);
      out += BIT_ALPHABET[value]!;
    }
    return out;
  }
}

/** Bits a list of gaps takes in a Rice code with parameter k. */
const riceBits = (gaps: readonly number[], k: number): number =>
  gaps.reduce((sum, gap) => sum + Math.floor(gap / 2 ** k) + 1 + k, 0);

/** The cheapest Rice parameter for a list of gaps. */
function bestK(gaps: readonly number[]): number {
  let k = 0;
  for (let candidate = 1; candidate < 50; candidate++) {
    if (riceBits(gaps, candidate) < riceBits(gaps, k)) k = candidate;
  }
  return k;
}

/** One bucket: sorted distinct codes in runs of RUN, each run's gaps in its cheapest Rice code. */
export function encodeBucket(minMoves: number, codes: readonly number[]): CatalogueBucket {
  const sorted = [...codes].sort((a, b) => a - b);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1]) throw new Error('encodeBucket: the same board twice');
  }
  const writer = new BitWriter();
  const firsts: number[] = [];
  const ks: number[] = [];
  const offsets: number[] = [];
  for (let start = 0; start < sorted.length; start += RUN) {
    const run = sorted.slice(start, start + RUN);
    const gaps = run.slice(1).map((code, i) => code - run[i]! - 1);
    const k = bestK(gaps);
    firsts.push(run[0]!);
    ks.push(k);
    offsets.push(writer.length);
    for (const gap of gaps) writer.rice(gap, k);
  }
  return { minMoves, count: sorted.length, firsts, ks, offsets, bits: writer.text() };
}

/** Step 3: a tier's kept boards, grouped by fewest moves. */
export function encodeTier(
  entries: readonly { board: Board; minMoves: number }[],
): CatalogueBucket[] {
  const byMoves = new Map<number, number[]>();
  for (const entry of entries) {
    const codes = byMoves.get(entry.minMoves) ?? [];
    codes.push(boardCode(entry.board));
    byMoves.set(entry.minMoves, codes);
  }
  return [...byMoves.keys()]
    .sort((a, b) => a - b)
    .map((minMoves) => encodeBucket(minMoves, byMoves.get(minMoves)!));
}

/** The source of catalogueData.ts for encoded tiers. */
export function catalogueDataSource(data: CatalogueData, note: string): string {
  const tier = (difficulty: Difficulty): string =>
    data[difficulty]
      .map(
        (bucket) =>
          `    {\n      minMoves: ${bucket.minMoves},\n      count: ${bucket.count},\n` +
          `      firsts: [${bucket.firsts.join(', ')}],\n      ks: [${bucket.ks.join(', ')}],\n` +
          `      offsets: [${bucket.offsets.join(', ')}],\n` +
          `      bits: '${bucket.bits}',\n    },\n`,
      )
      .join('');
  return (
    `/**\n * Generated by catalogue.generate.test.ts (catalogueBuild.ts) — do not edit by hand.\n${note
      .split('\n')
      .map((line) => ` *${line ? ` ${line}` : ''}`)
      .join('\n')}\n */\n` +
    `import type { CatalogueData } from './catalogue';\n\n` +
    `export const CATALOGUE_DATA: CatalogueData = {\n` +
    DIFFICULTIES.map((difficulty) => `  ${difficulty}: [\n${tier(difficulty)}  ],\n`).join('') +
    `};\n`
  );
}
