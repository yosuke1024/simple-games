import { isConnected, isTile, tileId } from '../../games/dominoes/game/engine';
import {
  createSession,
  draw,
  pass,
  play,
  type DominoesSession,
} from '../../games/dominoes/game/match';
import type { End, Line, Tile } from '../../games/dominoes/game/types';
import { defineGame, type Seat } from '../gameTypes';
import { copy, integer, keys, pair, record, seat } from './hidden';

export interface DominoesView {
  seat: Seat;
  turn: Seat;
  hand: readonly Tile[];
  opponentCount: number;
  stockCount: number;
  line: Line;
  passes: number;
  ending: 'out' | 'blocked' | null;
  winner: Seat | 'draw' | null;
  score: number;
  /** Pip totals become public only after the game ends. */
  pips: [number, number] | null;
}
export type DominoesAction = { kind: 'play'; tile: Tile; end: End } | { kind: 'draw' | 'pass' };
const tiles = (x: unknown): x is Tile[] =>
  Array.isArray(x) && x.length <= 28 && x.every(isTile) && new Set(x.map(tileId)).size === x.length;
export function isDominoesView(x: unknown): x is DominoesView {
  if (
    !record(x) ||
    !keys(x, 'seat turn hand opponentCount stockCount line passes ending winner score pips') ||
    !seat(x.seat) ||
    !seat(x.turn) ||
    !tiles(x.hand) ||
    !integer(x.opponentCount, 27) ||
    !integer(x.stockCount, 14) ||
    !integer(x.passes, 2) ||
    !integer(x.score, 168) ||
    !Array.isArray(x.line) ||
    x.line.length < 1 ||
    x.line.length > 28
  )
    return false;
  if (
    !x.line.every(
      (v) =>
        record(v) &&
        keys(v, 'tile left right') &&
        isTile(v.tile) &&
        integer(v.left, 6) &&
        integer(v.right, 6) &&
        ((v.left === v.tile[0] && v.right === v.tile[1]) ||
          (v.right === v.tile[0] && v.left === v.tile[1])),
    )
  )
    return false;
  const line = x.line as unknown as Line;
  if (
    !isConnected(line) ||
    new Set([...x.hand.map(tileId), ...line.map((v) => tileId(v.tile))]).size !==
      x.hand.length + line.length ||
    x.hand.length + x.opponentCount + x.stockCount + line.length !== 28
  )
    return false;
  if (x.ending === null)
    return x.winner === null && x.pips === null && x.score === 0 && x.passes < 2;
  return (
    (x.ending === 'out' || x.ending === 'blocked') &&
    (seat(x.winner) || x.winner === 'draw') &&
    pair(x.pips, (n): n is number => integer(n, 168))
  );
}
export const adapter = defineGame<DominoesSession, DominoesView, DominoesAction>({
  id: 'dominoes',
  create: (random) => createSession('', random),
  project: (full, local) =>
    copy({
      seat: local,
      turn: (full.toMove - 1) as Seat,
      hand: local === 0 ? full.playerHand : full.cpuHand,
      opponentCount: (local === 0 ? full.cpuHand : full.playerHand).length,
      stockCount: full.boneyard.length,
      line: full.line,
      passes: full.passes,
      ending: full.ending,
      winner:
        full.status === 'won'
          ? 0
          : full.status === 'lost'
            ? 1
            : full.status === 'draw'
              ? 'draw'
              : null,
      score: full.score,
      pips: full.ending === null ? null : [full.playerPips, full.cpuPips],
    }),
  isView: isDominoesView,
  isAction: (x): x is DominoesAction =>
    record(x) &&
    ((keys(x, 'kind') && (x.kind === 'draw' || x.kind === 'pass')) ||
      (keys(x, 'kind tile end') &&
        x.kind === 'play' &&
        isTile(x.tile) &&
        (x.end === 'left' || x.end === 'right'))),
  turn: (view) => view.turn,
  finished: (view) => view.ending !== null,
  apply: (full, player, action) =>
    action.kind === 'play'
      ? play(full, player === 0 ? 1 : 2, action.tile, action.end)
      : action.kind === 'draw'
        ? draw(full, player === 0 ? 1 : 2)
        : pass(full, player === 0 ? 1 : 2),
  result: (view) => ({
    winner: view.winner,
    scores: [view.winner === 0 ? view.score : 0, view.winner === 1 ? view.score : 0],
  }),
});
