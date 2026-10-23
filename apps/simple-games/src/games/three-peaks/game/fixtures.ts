import { applyAction, createSession, type Action, type Session } from './index';
/** Seed 6, independently played through once; -1 denotes a draw. */
export const WINNING_ACTIONS: Action[] = [
  20, 27, 19, 22, -1, -1, 23, -1, 10, 18, 21, 25, -1, 9, 13, 12, 5, -1, 3, -1, 24, 11, -1, 26, 17,
  15, -1, 14, -1, -1, 4, -1, 0, -1, 16, -1, 7, -1, 6, -1, -1, -1, 1, -1, -1, 8, 2,
].map((index) => (index < 0 ? { kind: 'draw' } : { kind: 'take', index }));
export function winningPrefix(length = WINNING_ACTIONS.length): Session {
  let session = createSession(6);
  for (const action of WINNING_ACTIONS.slice(0, length)) {
    const next = applyAction(session, action);
    if (!next) throw new Error('Invalid Three Peaks fixture');
    session = next;
  }
  return session;
}
