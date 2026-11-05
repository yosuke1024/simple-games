import type { NearbyGameId } from '../nearby/gameTypes';

/** Import-free at runtime: the shell can gate entries without loading any game. */
export const NEARBY_GAME_CODES: Readonly<Record<NearbyGameId, string>> = {
  ludo: '0E',
  hearts: '0F',
  backgammon: '10',
  'ridge-cannons': '11',
  'fleet-search': '12',
  'chain-territory': '13',
  daifugo: '14',
  sevens: '15',
  'old-maid': '16',

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
  Object.keys(NEARBY_GAME_CODES).map((id) => [
    id,
    ['ludo', 'hearts', 'daifugo', 'sevens', 'old-maid'].includes(id) ? 4 : 2,
  ]),
) as Record<NearbyGameId, number>;
export const isNearbyGameId = (value: unknown): value is NearbyGameId =>
  typeof value === 'string' && Object.hasOwn(NEARBY_GAME_CODES, value);

export type NearbyGroupGameId = 'ludo' | 'hearts' | 'daifugo' | 'sevens' | 'old-maid';
export const isGroupGameId = (id: string): id is NearbyGroupGameId =>
  isNearbyGameId(id) && NEARBY_CAPACITY[id] > 2;
