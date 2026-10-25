import type { NearbyGameId } from '../nearby/gameTypes';

/** Import-free at runtime: the shell can gate entries without loading any game. */
export const NEARBY_GAME_CODES: Readonly<Record<NearbyGameId, string>> = {
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
export const isNearbyGameId = (value: unknown): value is NearbyGameId =>
  typeof value === 'string' && Object.hasOwn(NEARBY_GAME_CODES, value);
