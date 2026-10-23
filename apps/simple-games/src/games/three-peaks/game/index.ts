/** Pure rules. See docs/THREE_PEAKS_RULES.md. Card ids are suit * 13 + rank - 1. */
export type Action = { kind: 'take'; index: number } | { kind: 'draw' };
export type Status = 'playing' | 'won' | 'stuck';
export interface Session {
  seed: number;
  deck: number[];
  removed: boolean[];
  stockIndex: number;
  waste: number;
  actions: Action[];
  status: Status;
  elapsedSeconds: number;
  countedWin: boolean;
}

export const POSITIONS = [
  ...[1.5, 4.5, 7.5].map((x) => ({ x, y: 0 })),
  ...[1, 2, 4, 5, 7, 8].map((x) => ({ x, y: 1 })),
  ...Array.from({ length: 9 }, (_, i) => ({ x: i + 0.5, y: 2 })),
  ...Array.from({ length: 10 }, (_, i) => ({ x: i, y: 3 })),
];
export const COVERS: readonly (readonly number[])[] = [
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [10, 11],
  [12, 13],
  [13, 14],
  [15, 16],
  [16, 17],
  ...Array.from({ length: 9 }, (_, i) => [18 + i, 19 + i]),
  ...Array.from({ length: 10 }, () => [] as number[]),
];
export const rank = (card: number): number => (card % 13) + 1;
export const suit = (card: number): number => Math.floor(card / 13);
export const rankText = (card: number): string =>
  ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'][rank(card) - 1]!;
export const adjacent = (a: number, b: number): boolean => {
  const difference = Math.abs(rank(a) - rank(b));
  return difference === 1 || difference === 12;
};
export const remaining = (session: Session): number =>
  session.removed.filter((removed) => !removed).length;
export const isExposed = (session: Session, index: number): boolean =>
  Number.isInteger(index) &&
  index >= 0 &&
  index < 28 &&
  !session.removed[index] &&
  COVERS[index]!.every((below) => session.removed[below]);
export const canTake = (session: Session, index: number): boolean =>
  session.status === 'playing' &&
  isExposed(session, index) &&
  adjacent(session.deck[index]!, session.waste);
export function statusOf(session: Session): Status {
  if (remaining(session) === 0) return 'won';
  if (session.stockIndex < 52) return 'playing';
  return session.removed.some(
    (_, index) => isExposed(session, index) && adjacent(session.deck[index]!, session.waste),
  )
    ? 'playing'
    : 'stuck';
}
export function createSession(seed: number): Session {
  let value = seed >>> 0;
  const random = () => {
    value += 0x6d2b79f5;
    let t = Math.imul(value ^ (value >>> 15), value | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const deck = Array.from({ length: 52 }, (_, i) => i);
  for (let i = 51; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return {
    seed: seed >>> 0,
    deck,
    removed: Array<boolean>(28).fill(false),
    stockIndex: 29,
    waste: deck[28]!,
    actions: [],
    status: 'playing',
    elapsedSeconds: 0,
    countedWin: false,
  };
}
export function applyAction(session: Session, action: Action): Session | null {
  if (session.status !== 'playing') return null;
  const next: Session = {
    ...session,
    removed: [...session.removed],
    actions: [...session.actions, { ...action }],
  };
  if (action.kind === 'draw') {
    if (session.stockIndex >= 52) return null;
    next.waste = session.deck[session.stockIndex]!;
    next.stockIndex++;
  } else {
    if (!canTake(session, action.index)) return null;
    next.removed[action.index] = true;
    next.waste = session.deck[action.index]!;
  }
  next.status = statusOf(next);
  return next;
}
export function undo(session: Session): Session | null {
  if (!session.actions.length) return null;
  let next = createSession(session.seed);
  for (const action of session.actions.slice(0, -1)) {
    const moved = applyAction(next, action);
    if (!moved) return null;
    next = moved;
  }
  return { ...next, elapsedSeconds: session.elapsedSeconds, countedWin: session.countedWin };
}
/** A bounded replay checks every saved move, instead of trusting a stored board. */
export function restoreSession(raw: unknown): Session | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const data = raw as Record<string, unknown>;
  if (
    !Number.isInteger(data.seed) ||
    (data.seed as number) < 0 ||
    (data.seed as number) > 0xffffffff ||
    !Number.isInteger(data.elapsedSeconds) ||
    (data.elapsedSeconds as number) < 0 ||
    (data.elapsedSeconds as number) > 1e12 ||
    typeof data.countedWin !== 'boolean' ||
    !Array.isArray(data.actions) ||
    data.actions.length > 51
  )
    return null;
  let session = createSession(data.seed as number);
  for (const rawAction of data.actions) {
    if (!rawAction || typeof rawAction !== 'object' || Array.isArray(rawAction)) return null;
    const action = rawAction as Record<string, unknown>;
    let next: Session | null;
    if (action.kind === 'draw') next = applyAction(session, { kind: 'draw' });
    else if (action.kind === 'take' && typeof action.index === 'number')
      next = applyAction(session, { kind: 'take', index: action.index });
    else return null;
    if (!next) return null;
    session = next;
  }
  return { ...session, elapsedSeconds: data.elapsedSeconds as number, countedWin: data.countedWin };
}
