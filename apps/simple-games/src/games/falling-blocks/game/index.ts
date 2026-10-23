/** Pure Falling Blocks rules. See docs/FALLING_BLOCKS_RULES.md. */
export const WIDTH = 10;
export const HEIGHT = 18;
export const KINDS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
export type Kind = (typeof KINDS)[number];
export type Status = 'ready' | 'running' | 'paused' | 'over';
export type Action = 'left' | 'right' | 'rotate' | 'softDrop' | 'hardDrop';
export interface Piece {
  kind: Kind;
  rotation: number;
  x: number;
  y: number;
}
export interface Session {
  seed: number;
  board: number[];
  active: Piece;
  pieceIndex: number;
  score: number;
  lines: number;
  status: Status;
  elapsedSeconds: number;
}
const SHAPES: Record<Kind, string[]> = {
  I: ['....', '####', '....', '....'],
  O: ['##', '##'],
  T: ['.#.', '###', '...'],
  S: ['.##', '##.', '...'],
  Z: ['##.', '.##', '...'],
  J: ['#..', '###', '...'],
  L: ['..#', '###', '...'],
};
export function cells(piece: Piece): [number, number][] {
  const shape = SHAPES[piece.kind];
  const size = shape.length;
  const result: [number, number][] = [];
  shape.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      if (cell !== '#') return;
      let px = x,
        py = y;
      for (let r = 0; r < piece.rotation; r++) [px, py] = [size - 1 - py, px];
      result.push([piece.x + px, piece.y + py]);
    }),
  );
  return result;
}
/** Independent deterministic seven-piece bags; no board-aware randomization. */
export function pieceAt(seed: number, index: number): Kind {
  let state = (seed ^ Math.imul(Math.floor(index / 7) + 1, 0x9e3779b9)) >>> 0;
  const bag: Kind[] = [...KINDS];
  for (let i = 6; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  return bag[index % 7]!;
}
const spawn = (kind: Kind): Piece => ({ kind, rotation: 0, x: kind === 'O' ? 4 : 3, y: 0 });
export function createSession(seed: number): Session {
  return {
    seed: seed >>> 0,
    board: Array<number>(WIDTH * HEIGHT).fill(0),
    active: spawn(pieceAt(seed >>> 0, 0)),
    pieceIndex: 0,
    score: 0,
    lines: 0,
    status: 'ready',
    elapsedSeconds: 0,
  };
}
export function fits(board: readonly number[], piece: Piece): boolean {
  return cells(piece).every(
    ([x, y]) => x >= 0 && x < WIDTH && y >= 0 && y < HEIGHT && board[y * WIDTH + x] === 0,
  );
}
export const level = (lines: number): number => Math.min(20, 1 + Math.floor(lines / 10));
export const gravityMs = (lines: number): number => Math.max(120, 850 - (level(lines) - 1) * 45);
export function landingPiece(session: Session): Piece {
  let piece = session.active;
  while (fits(session.board, { ...piece, y: piece.y + 1 })) piece = { ...piece, y: piece.y + 1 };
  return piece;
}
export function clearLines(board: readonly number[]): { board: number[]; count: number } {
  const rows: number[][] = [];
  for (let y = 0; y < HEIGHT; y++) {
    const row = board.slice(y * WIDTH, (y + 1) * WIDTH);
    if (row.some((value) => value === 0)) rows.push(row);
  }
  const count = HEIGHT - rows.length;
  return { board: [...Array<number>(count * WIDTH).fill(0), ...rows.flat()], count };
}
function lock(session: Session): Session {
  const board = [...session.board];
  const mark = KINDS.indexOf(session.active.kind) + 1;
  for (const [x, y] of cells(session.active)) board[y * WIDTH + x] = mark;
  const cleared = clearLines(board);
  const pieceIndex = session.pieceIndex + 1;
  const active = spawn(pieceAt(session.seed, pieceIndex));
  return {
    ...session,
    board: cleared.board,
    pieceIndex,
    active,
    lines: session.lines + cleared.count,
    score: session.score + [0, 100, 300, 500, 800][cleared.count]! * level(session.lines),
    status: fits(cleared.board, active) ? 'running' : 'over',
  };
}
export function start(session: Session): Session {
  return session.status === 'ready' || session.status === 'paused'
    ? { ...session, status: 'running' }
    : session;
}
export function pause(session: Session): Session {
  return session.status === 'running' ? { ...session, status: 'paused' } : session;
}
export function tick(session: Session): Session {
  if (session.status !== 'running') return session;
  const active = { ...session.active, y: session.active.y + 1 };
  return fits(session.board, active) ? { ...session, active } : lock(session);
}
export function act(session: Session, action: Action): Session {
  if (session.status !== 'running') return session;
  if (action === 'hardDrop') {
    const active = landingPiece(session);
    return lock({ ...session, active, score: session.score + 2 * (active.y - session.active.y) });
  }
  if (action === 'softDrop') {
    const next = tick(session);
    return next.pieceIndex === session.pieceIndex ? { ...next, score: next.score + 1 } : next;
  }
  if (action === 'rotate') {
    if (session.active.kind === 'O') return session;
    for (const shift of [0, -1, 1, -2, 2]) {
      const active = {
        ...session.active,
        rotation: (session.active.rotation + 1) % 4,
        x: session.active.x + shift,
      };
      if (fits(session.board, active)) return { ...session, active };
    }
    return session;
  }
  const active = { ...session.active, x: session.active.x + (action === 'left' ? -1 : 1) };
  return fits(session.board, active) ? { ...session, active } : session;
}
