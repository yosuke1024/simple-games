import type { NearbyGameId } from '../nearby/gameTypes';

/** Import-free at runtime: the shell can gate entries without loading any game. */
export const NEARBY_GAME_CODES: Readonly<Record<NearbyGameId, string>> = {
  ludo: '0E',
  yacht: '01',
  reversi: '02',
  'connect-four': '03',
  gomoku: '04',
  checkers: '05',
  'gin-rummy': '06',
  mancala: '07',
  dominoes: '08',
  'dots-and-boxes': '09',
  chess: '0A',
  'nested-tic-tac-toe': '0B',
  scopa: '0C',
  nim: '0D',
};
/** Game seats count humans and CPUs; radio connections count humans only. */
export const NEARBY_CAPACITY: Readonly<Record<NearbyGameId, number>> = Object.fromEntries(
  Object.keys(NEARBY_GAME_CODES).map((id) => [id, id === 'ludo' ? 4 : 2]),
) as Record<NearbyGameId, number>;
export const isNearbyGameId = (value: unknown): value is NearbyGameId =>
  typeof value === 'string' && Object.hasOwn(NEARBY_GAME_CODES, value);
