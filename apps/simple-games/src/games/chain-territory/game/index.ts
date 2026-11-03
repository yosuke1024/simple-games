/** Pure rules; see docs/CHAIN_TERRITORY_RULES.md. */
export const MODES = ['easy', 'normal', 'hard'] as const;
export type Mode = (typeof MODES)[number];
export const isMode = (value: unknown): value is Mode => MODES.includes(value as Mode);
export const COLS = 5,
  ROWS = 6,
  CELLS = COLS * ROWS;
export type Player = 1 | 2;
export type Action = number;
export interface Cell {
  owner: 0 | Player;
  count: number;
}
export interface Session {
  mode: Mode;
  seed: number;
  actions: Action[];
  elapsedSeconds: number;
  board: Cell[];
  turn: Player;
  status: 'playing' | 'won' | 'lost';
  waves: Cell[][];
  lastCell: number | null;
}
export function neighbors(cell: number): number[] {
  const x = cell % COLS,
    y = Math.floor(cell / COLS);
  return [
    y > 0 ? cell - COLS : -1,
    x < COLS - 1 ? cell + 1 : -1,
    y < ROWS - 1 ? cell + COLS : -1,
    x > 0 ? cell - 1 : -1,
  ].filter((n) => n >= 0);
}
const adjacent = Array.from({ length: CELLS }, (_, cell) => neighbors(cell));
export const capacity = (cell: number) => adjacent[cell]!.length;
export function createSession(mode: Mode, seed: number): Session {
  return {
    mode,
    seed: seed >>> 0,
    actions: [],
    elapsedSeconds: 0,
    board: Array.from({ length: CELLS }, () => ({ owner: 0, count: 0 })),
    turn: 1,
    status: 'playing',
    waves: [],
    lastCell: null,
  };
}
export function legalMoves(session: Session): number[] {
  return session.status !== 'playing'
    ? []
    : session.board.flatMap((c, i) => (!c.owner || c.owner === session.turn ? [i] : []));
}
export function act(session: Session, cell: Action, recordWaves = true): Session | null {
  if (
    session.status !== 'playing' ||
    !Number.isInteger(cell) ||
    cell < 0 ||
    cell >= CELLS ||
    (session.board[cell]!.owner !== 0 && session.board[cell]!.owner !== session.turn)
  )
    return null;
  const board = session.board.map((c) => ({ ...c })),
    player = session.turn;
  const opponent: Player = player === 1 ? 2 : 1;
  const waves: Cell[][] = [];
  const snapshot = () => {
    if (recordWaves) waves.push(board.map((c) => ({ ...c })));
  };
  board[cell]!.owner = player;
  board[cell]!.count++;
  snapshot();
  let winner = false;
  // A connected conservative board can sustain a cascade only after all
  // opponents have been captured. Check elimination between complete waves.
  for (;;) {
    if (session.actions.length >= 2 && !board.some((c) => c.owner === opponent)) {
      winner = true;
      break;
    }
    const bursting = board.flatMap((c, i) => (c.count >= capacity(i) ? [i] : []));
    if (!bursting.length) break;
    for (const i of bursting) {
      board[i]!.count -= capacity(i);
      if (!board[i]!.count) board[i]!.owner = 0;
    }
    for (const i of bursting)
      for (const n of adjacent[i]!) {
        board[n]!.count++;
        board[n]!.owner = player;
      }
    snapshot();
  }
  return {
    ...session,
    board,
    actions: [...session.actions, cell],
    turn: opponent,
    status: winner ? (player === 1 ? 'won' : 'lost') : 'playing',
    waves,
    lastCell: cell,
  };
}
function evaluate(s: Session, player: Player): number {
  if (s.status !== 'playing') return (s.status === 'won') === (player === 1) ? 100000 : -100000;
  return s.board.reduce((total, c, i) => {
    if (!c.owner) return total;
    const exposed = adjacent[i]!.some(
      (n) =>
        s.board[n]!.owner && s.board[n]!.owner !== c.owner && s.board[n]!.count === capacity(n) - 1,
    );
    const value =
      8 +
      c.count * 2 +
      (4 - capacity(i)) * 3 +
      (c.count === capacity(i) - 1 ? 4 : 0) -
      (exposed ? 9 : 0);
    return total + (c.owner === player ? value : -value);
  }, 0);
}
export function chooseCpuMove(s: Session): Action | null {
  const legal = legalMoves(s);
  if (s.turn !== 2 || !legal.length) return null;
  let hash = (s.seed ^ Math.imul(s.actions.length + 1, 0x9e3779b1)) >>> 0;
  // XOR returns a signed int; keep the array index in the unsigned range.
  hash = (hash ^ (hash >>> 16)) >>> 0;
  if (s.mode === 'easy') return legal[hash % legal.length]!;
  const ranked = legal.map((cell) => {
    const next = act(s, cell, false)!;
    let value = evaluate(next, 2);
    if (s.mode === 'hard' && next.status === 'playing') {
      value = Math.min(...legalMoves(next).map((reply) => evaluate(act(next, reply, false)!, 2)));
    }
    return { cell, value, tie: (Math.imul(cell + 1, 2654435761) ^ hash) >>> 0 };
  });
  ranked.sort((a, b) => b.value - a.value || a.tie - b.tie);
  return ranked[0]!.cell;
}
export function undo(s: Session): Session | null {
  if (s.status !== 'playing' || !s.actions.length) return null;
  const length = s.actions.length - (s.turn === 1 ? 2 : 1);
  let previous = createSession(s.mode, s.seed);
  for (const action of s.actions.slice(0, Math.max(0, length)))
    previous = act(previous, action, false)!;
  return { ...previous, elapsedSeconds: s.elapsedSeconds };
}
export const resultValue = (s: Session) => Math.ceil(s.actions.length / 2);
