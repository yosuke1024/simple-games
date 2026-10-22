/**
 * Perft: count the leaves of the legal-move tree and compare with the
 * published counts (docs/CHESS_RULES.md §12). A move generator that gets any
 * rule wrong — a castling condition, an en passant pin, a promotion — sooner
 * or later counts a different number of leaves, and these five positions are
 * the ones chosen (by the people who publish them) to reach every special
 * rule within a few plies.
 *
 * The counts are the chessprogramming wiki's "Perft Results" as the author
 * remembers them; the page could not be fetched from this environment
 * (§12 — the source is unconfirmed, and the code reproducing all of them is
 * the evidence that both are right).
 *
 * The gate is the node count, never the clock: wall-clock time is printed for
 * a reader and not asserted (docs/ARCHITECTURE.md「CI / リリース」).
 */
import { describe, expect, it } from 'vitest';
import {
  computeHash,
  generateLegalMoves,
  initialPosition,
  makeMove,
  unmakeMove,
  type Position,
} from './engine';
import { parseFen, toFen } from './fen';
import { moveToUci } from './serialize';

/** Leaves at `depth`, counting the last ply in bulk (the legal moves' length). */
function perft(position: Position, depth: number): number {
  const moves = generateLegalMoves(position);
  if (depth === 1) return moves.length;
  let nodes = 0;
  for (const move of moves) {
    const undo = makeMove(position, move);
    nodes += perft(position, depth - 1);
    unmakeMove(position, move, undo);
  }
  return nodes;
}

/** Everything a position holds, as one comparable string. */
const snapshot = (position: Position): string =>
  `${position.board.join(',')}|${position.side}|${position.castling}|${position.epSquare}|` +
  `${position.halfmoveClock}|${position.ply}|${position.kings.join(',')}|${position.hashHi}|${position.hashLo}`;

/**
 * Walks every node to `depth`, comparing the incremental key with a key
 * computed from scratch at each node and the whole position before a move
 * with the position after its unmake. Counts disagreements instead of
 * asserting per node, so the walk stays cheap enough to run at depth 3.
 */
function checkHashes(position: Position, depth: number): { nodes: number; faults: number } {
  const fresh = computeHash(position);
  let faults = position.hashHi === fresh.hi && position.hashLo === fresh.lo ? 0 : 1;
  let nodes = 1;
  if (depth === 0) return { nodes, faults };
  const before = snapshot(position);
  for (const move of generateLegalMoves(position)) {
    const undo = makeMove(position, move);
    const below = checkHashes(position, depth - 1);
    nodes += below.nodes;
    faults += below.faults;
    unmakeMove(position, move, undo);
    if (snapshot(position) !== before) faults += 1;
  }
  return { nodes, faults };
}

interface Suite {
  readonly name: string;
  readonly fen: string;
  readonly counts: readonly number[];
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

const SUITES: readonly Suite[] = [
  { name: 'start', fen: START, counts: [20, 400, 8_902, 197_281] },
  {
    name: 'kiwipete',
    fen: 'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1',
    counts: [48, 2_039, 97_862],
  },
  {
    name: 'position 3',
    fen: '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1',
    counts: [14, 191, 2_812, 43_238],
  },
  {
    name: 'position 4',
    fen: 'r3k2r/Pppp1ppp/1b3nbN/nP6/BBP1P3/q4N2/Pp1P2PP/R2Q1RK1 w kq - 0 1',
    counts: [6, 264, 9_467],
  },
  {
    name: 'position 5',
    fen: 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8',
    counts: [44, 1_486, 62_379],
  },
];

const cases = SUITES.flatMap((suite) =>
  suite.counts.map((expected, index) => ({
    name: suite.name,
    fen: suite.fen,
    depth: index + 1,
    expected,
  })),
);

describe('perft matches the published counts', () => {
  it.each(cases)('$name, depth $depth = $expected', ({ name, fen, depth, expected }) => {
    const position = parseFen(fen)!;
    expect(position).not.toBeNull();
    const started = performance.now();
    const nodes = perft(position, depth);
    const ms = performance.now() - started;
    console.log(
      `chess perft ${name} d${depth}: ${nodes} nodes in ${ms.toFixed(1)}ms — the count is asserted, the time is not`,
    );
    expect(nodes).toBe(expected);
    // The walk put everything back.
    expect(toFen(position)).toBe(toFen(parseFen(fen)!));
  });

  it('starts games from the same position the published start FEN describes', () => {
    expect(toFen(initialPosition())).toBe(START);
  });
});

/**
 * The start position to depth 5 (4,865,609) — the depth at which en passant
 * first appears from the opening. Split by root move into twenty cases so no
 * single case carries the whole walk (docs/ARCHITECTURE.md「CI / リリース」:
 * split the work instead of raising the timeout); the per-root counts are not
 * published, only their sum is checked.
 */
describe('perft, start position depth 5 by root move', () => {
  const root = initialPosition();
  const rootMoves = generateLegalMoves(root);
  const subtotals = new Map<string, number>();
  let started = 0;

  it('has twenty root moves', () => {
    expect(rootMoves).toHaveLength(20);
    started = performance.now();
  });

  it.each(rootMoves.map((move) => ({ move, uci: moveToUci(move) })))(
    'counts the subtree under $uci',
    ({ move, uci }) => {
      const position = initialPosition();
      const undo = makeMove(position, move);
      subtotals.set(uci, perft(position, 4));
      unmakeMove(position, move, undo);
    },
  );

  it('sums to 4,865,609', () => {
    const total = [...subtotals.values()].reduce((sum, value) => sum + value, 0);
    console.log(
      `chess perft start d5: ${total} nodes over ${subtotals.size} root moves in ` +
        `${(performance.now() - started).toFixed(0)}ms — the count is asserted, the time is not`,
    );
    expect(subtotals.size).toBe(20);
    expect(total).toBe(4_865_609);
  });
});

describe('the incremental Zobrist key agrees with a key computed from scratch', () => {
  it.each(SUITES.map((suite) => ({ name: suite.name, fen: suite.fen })))(
    '$name, every node to depth 3',
    ({ name, fen }) => {
      const { nodes, faults } = checkHashes(parseFen(fen)!, 3);
      console.log(`chess hash check ${name}: ${nodes} nodes to depth 3, ${faults} faults`);
      expect(nodes).toBeGreaterThan(1);
      expect(faults).toBe(0);
    },
  );
});
