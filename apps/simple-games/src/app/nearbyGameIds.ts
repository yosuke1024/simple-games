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
  'crazy-eights': '17',
  durak: '18',
  spades: '19',
  'texas-holdem': '1A',
  blackjack: '1B',
  'indian-rummy': '1C',

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
    [
      'ludo',
      'hearts',
      'daifugo',
      'sevens',
      'old-maid',
      'crazy-eights',
      'spades',
      'texas-holdem',
      'blackjack',
      'indian-rummy',
    ].includes(id)
      ? 4
      : 2,
  ]),
) as Record<NearbyGameId, number>;
export const isNearbyGameId = (value: unknown): value is NearbyGameId =>
  typeof value === 'string' && Object.hasOwn(NEARBY_GAME_CODES, value);

/** Group lifecycle also serves two-seat Durak: control and capacity are separate. */
export const NEARBY_GROUP_GAME_IDS = [
  'ludo',
  'hearts',
  'daifugo',
  'sevens',
  'old-maid',
  'crazy-eights',
  'durak',
  'spades',
  'texas-holdem',
  'blackjack',
  'indian-rummy',
] as const satisfies readonly NearbyGameId[];
export type NearbyGroupGameId = (typeof NEARBY_GROUP_GAME_IDS)[number];
export const isGroupGameId = (id: string): id is NearbyGroupGameId =>
  NEARBY_GROUP_GAME_IDS.some((game) => game === id);
