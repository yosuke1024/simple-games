/** Serializable game views cross the wire; full state and randomness stay on the host. */
export type NearbyGameId =
  | 'yacht'
  | 'reversi'
  | 'connect-four'
  | 'gomoku'
  | 'checkers'
  | 'gin-rummy'
  | 'mancala'
  | 'dominoes'
  | 'dots-and-boxes'
  | 'chess'
  | 'nested-tic-tac-toe'
  | 'scopa'
  | 'nim';
export type Seat = 0 | 1;
export type Random = () => number; // Uniform [0, 1), used only by the host.
export const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
export const integer = (value: unknown, min: number, max: number): value is number =>
  Number.isSafeInteger(value) && (value as number) >= min && (value as number) <= max;
export interface NearbyMatch {
  gameId: NearbyGameId;
  round: number;
  revision: number;
  state: unknown; // The local seat's projection, never the host's full state.
}
export interface GameResult {
  scores: [number, number];
  winner: Seat | 'draw' | null;
}
export const isGameResult = (value: unknown): value is GameResult =>
  record(value) &&
  Array.isArray(value.scores) &&
  value.scores.length === 2 &&
  value.scores.every((score: unknown) => integer(score, 0, 1000000)) &&
  (value.winner === null || value.winner === 0 || value.winner === 1 || value.winner === 'draw');
export interface NearbyBoardProps {
  match: NearbyMatch;
  seat: Seat;
  names: readonly string[];
  canAct: boolean;
  statusLabel?: string;
  act: (action: unknown) => void;
}
export interface GameAdapter {
  readonly id: NearbyGameId;
  create(random: Random): unknown;
  project(full: unknown, seat: Seat): unknown;
  isView(value: unknown): boolean;
  isAction(value: unknown): boolean;
  turn(view: unknown): Seat;
  finished(view: unknown): boolean;
  apply(full: unknown, seat: Seat, action: unknown, random: Random): unknown | null;
  result(view: unknown): GameResult;
}
export interface TypedGame<S, V, A> {
  readonly id: NearbyGameId;
  create(random: Random): S;
  project(full: S, seat: Seat): V;
  isView(value: unknown): value is V;
  isAction(value: unknown): value is A;
  turn(view: V): Seat;
  finished(view: V): boolean;
  apply(full: S, seat: Seat, action: A, random: Random): S | null;
  result(view: V): GameResult;
}

/** Erase adapter-specific types at one boundary. Session validates views before use;
 * full state comes only from this adapter's create/apply and is never peer input. */
export function defineGame<S, V, A>(game: TypedGame<S, V, A>): GameAdapter {
  const view = (value: unknown): V => {
    if (!game.isView(value)) throw new Error('Invalid game view');
    return value;
  };
  return {
    id: game.id,
    create: (random) => game.create(random),
    project: (full, seat) => game.project(full as S, seat),
    isView: game.isView,
    isAction: game.isAction,
    turn: (value) => game.turn(view(value)),
    finished: (value) => game.finished(view(value)),
    apply: (full, seat, action, random) =>
      game.isAction(action) ? game.apply(full as S, seat, action, random) : null,
    result: (value) => game.result(view(value)),
  };
}
