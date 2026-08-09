/**
 * Board generation by reverse pair construction — implements
 * docs/MAHJONG_SOLITAIRE_RULES.md §5, the promise this title stands on.
 *
 * The board is built by playing it backwards: starting from the full layout,
 * a seeded search removes two free tiles at a time until nothing is left,
 * and the k-th removed pair is then dealt the k-th face pair. Replaying that
 * removal order wins the game, so every deal is solvable by construction.
 *
 * There is no retry loop and no "generation failed" state, and that is a
 * design position, not luck (§5): every shipped layout is proven peelable
 * (layouts.test.ts), so a complete order always exists — and each layout
 * carries a verified witness order as data. The runtime search works under a
 * deterministic node budget; if a seed drives it into a hopeless corner, it
 * falls back to the witness instead of failing. The gate on that budget is
 * measured in nodes, never wall-clock (SUDOKU_RULES.md §7's discipline):
 * generator.test.ts sweeps layouts × seeds and pins the worst case.
 */
import { relationsOf, isFreeTile } from './freeState';
import type { Layout } from './layouts';
import { LAYOUTS, type LevelParams } from './layouts';
import { createRng } from './rng';
import { FLOWER_FACES, ORDINARY_FACES, SEASON_FACES, type FaceStock, type TileFace } from './types';

/**
 * Node budget for the seeded search. A node is one attempted pair removal,
 * including those undone by backtracking. Typical work is exactly one node
 * per pair (72 for the turtle); the measured worst over every layout × a
 * 300-seed sweep is under 200 (generator.test.ts keeps measuring it). The
 * budget is two orders of magnitude above that — hitting it means the seed
 * found a genuinely hostile corner, and the witness answers instead.
 */
export const NODE_BUDGET = 20_000;

export interface RemovalSearchResult {
  /** Flattened pairs of tile indices, in removal order. */
  readonly order: readonly number[];
  /** Attempted pair removals, backtracked ones included. */
  readonly nodes: number;
  /** True when the budget ran out and the layout's witness was used. */
  readonly usedWitness: boolean;
}

function shuffled<T>(list: readonly T[], rng: () => number): T[] {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Seeded backtracking peel. Freeness is monotone — removing tiles never
 * un-frees anything — so plain greedy succeeds almost always; backtracking
 * is the safety net for orders that strand a covered pocket.
 */
export function findRemovalOrder(layout: Layout, seed: string): RemovalSearchResult {
  const relations = relationsOf(layout);
  const count = layout.tiles.length;
  const rng = createRng(`${seed}:peel`);
  const removed: boolean[] = new Array<boolean>(count).fill(false);
  const order: number[] = [];
  let nodes = 0;

  const step = (remaining: number): boolean => {
    if (remaining === 0) return true;
    const free: number[] = [];
    for (let i = 0; i < count; i++) {
      if (!removed[i] && isFreeTile(i, removed, relations)) free.push(i);
    }
    if (free.length < 2) return false;
    const picks = shuffled(free, rng);
    for (let a = 0; a < picks.length; a++) {
      for (let b = a + 1; b < picks.length; b++) {
        if (nodes >= NODE_BUDGET) return false;
        nodes++;
        const p = picks[a]!;
        const q = picks[b]!;
        removed[p] = removed[q] = true;
        order.push(p, q);
        if (step(remaining - 2)) return true;
        removed[p] = removed[q] = false;
        order.length -= 2;
      }
    }
    return false;
  };

  if (step(count)) return { order, nodes, usedWitness: false };
  return { order: layout.witness, nodes, usedWitness: true };
}

/**
 * The pair pool of §6: which face goes on the k-th removed pair. A quad face
 * contributes two pair entries, a twin face one; the bonus groups deal their
 * distinct faces out two at a time (any flower matches any flower, so a pair
 * of two different flowers is a legal pair — §2).
 */
function dealFacePairs(params: LevelParams, seed: string): [TileFace, TileFace][] {
  const rng = createRng(`${seed}:faces`);
  const ordinary = shuffled(ORDINARY_FACES, rng);
  const pairs: [TileFace, TileFace][] = [];
  for (let i = 0; i < params.quads; i++) {
    const face = ordinary[i]!;
    pairs.push([face, face], [face, face]);
  }
  for (let i = 0; i < params.twins; i++) {
    const face = ordinary[params.quads + i]!;
    pairs.push([face, face]);
  }
  const flowers = shuffled(FLOWER_FACES, rng).slice(0, params.flowers);
  for (let i = 0; i + 1 < flowers.length; i += 2) pairs.push([flowers[i]!, flowers[i + 1]!]);
  const seasons = shuffled(SEASON_FACES, rng).slice(0, params.seasons);
  for (let i = 0; i + 1 < seasons.length; i += 2) pairs.push([seasons[i]!, seasons[i + 1]!]);
  return shuffled(pairs, rng);
}

/** The stock the same deal draws from — what isValidBoard measures against. */
export function stockFor(params: LevelParams, seed: string): FaceStock {
  const rng = createRng(`${seed}:faces`);
  const ordinary = shuffled(ORDINARY_FACES, rng);
  const stock = new Map<TileFace, number>();
  for (let i = 0; i < params.quads; i++) stock.set(ordinary[i]!, 4);
  for (let i = 0; i < params.twins; i++) stock.set(ordinary[params.quads + i]!, 2);
  for (const face of shuffled(FLOWER_FACES, rng).slice(0, params.flowers)) stock.set(face, 1);
  for (const face of shuffled(SEASON_FACES, rng).slice(0, params.seasons)) stock.set(face, 1);
  return stock;
}

export interface GeneratedBoard {
  readonly layout: Layout;
  /** Face per tile index. */
  readonly faces: readonly TileFace[];
  /** The construction's own winning order — proof, not a hint (§5, §8). */
  readonly solvedOrder: readonly number[];
  readonly nodes: number;
  readonly usedWitness: boolean;
}

/** The same seed always returns the same board (§5). */
export function generateBoard(params: LevelParams, seed: string): GeneratedBoard {
  const layout = LAYOUTS[params.layoutId];
  const search = findRemovalOrder(layout, seed);
  const pairs = dealFacePairs(params, seed);
  const faces: TileFace[] = new Array<TileFace>(layout.tiles.length);
  for (let k = 0; k * 2 < search.order.length; k++) {
    const [a, b] = pairs[k]!;
    faces[search.order[k * 2]!] = a;
    faces[search.order[k * 2 + 1]!] = b;
  }
  return {
    layout,
    faces,
    solvedOrder: search.order,
    nodes: search.nodes,
    usedWitness: search.usedWitness,
  };
}
