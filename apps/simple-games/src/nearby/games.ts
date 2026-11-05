import { isGroupGameId } from '../app/nearbyGameIds';
import type { ComponentType } from 'react';
import type { MessageKey } from '../i18n';
import type { GameAdapter, NearbyBoardProps, NearbyGameId } from './gameTypes';

export interface NearbyGame {
  adapter: GameAdapter;
  Board: ComponentType<NearbyBoardProps>;
  makeAdapter?: (size: 3 | 4 | 5) => GameAdapter;
}
export const GAME_TITLES: Record<NearbyGameId, string> = {
  ludo: 'Ludo',
  hearts: 'Hearts',
  backgammon: 'Backgammon',
  'ridge-cannons': 'Ridge Cannons',
  'fleet-search': 'Fleet Search',
  'chain-territory': 'Chain Territory',
  daifugo: 'Daifugo',
  sevens: 'Sevens',
  'old-maid': 'Old Maid',

  yacht: 'Yacht',
  reversi: 'Reversi',
  'connect-four': 'Connect Four',
  gomoku: 'Gomoku',
  checkers: 'Checkers',
  'gin-rummy': 'Gin Rummy',
  mancala: 'Mancala',
  dominoes: 'Dominoes',
  'dots-and-boxes': 'Dots and Boxes',
  chess: 'Chess',
  'nested-tic-tac-toe': 'Nested Tic-Tac-Toe',
  scopa: 'Scopa',
  nim: 'Nim',
};
export const GAME_NAME_KEYS: Record<NearbyGameId, MessageKey> = {
  ludo: 'ludoName',
  hearts: 'heartsName',
  backgammon: 'backgammonName',
  'ridge-cannons': 'ridgeCannonsName',
  'fleet-search': 'fleetSearchName',
  'chain-territory': 'chainTerritoryName',
  daifugo: 'daifugoName',
  sevens: 'sevensName',
  'old-maid': 'oldMaidName',

  yacht: 'yachtName',
  reversi: 'reversiName',
  'connect-four': 'fourName',
  gomoku: 'gomokuName',
  checkers: 'checkersName',
  'gin-rummy': 'ginName',
  mancala: 'mancalaName',
  dominoes: 'dominoesName',
  'dots-and-boxes': 'dotsAndBoxesName',
  chess: 'chessName',
  'nested-tic-tac-toe': 'nestedTicTacToeName',
  scopa: 'scopaName',
  nim: 'nimName',
};
const loaders: Record<
  Exclude<NearbyGameId, 'ludo' | 'hearts' | 'daifugo' | 'sevens' | 'old-maid'>,
  () => Promise<NearbyGame>
> = {
  backgammon: async () => {
    const view = await import('./games/backgammonView');
    return { adapter: view.adapter, Board: view.default };
  },
  'ridge-cannons': async () => {
    const view = await import('./games/ridge-cannonsView');
    return { adapter: view.adapter, Board: view.default };
  },
  'fleet-search': async () => {
    const view = await import('./games/fleet-searchView');
    return { adapter: view.adapter, Board: view.default };
  },
  'chain-territory': async () => {
    const view = await import('./games/chain-territoryView');
    return { adapter: view.adapter, Board: view.default };
  },
  yacht: async () => {
    const view = await import('./games/yachtView');
    return { adapter: view.adapter, Board: view.default };
  },
  reversi: async () => {
    const view = await import('./games/reversiView');
    return { adapter: view.adapter, Board: view.default };
  },
  'connect-four': async () => {
    const view = await import('./games/connect-fourView');
    return { adapter: view.adapter, Board: view.default };
  },
  gomoku: async () => {
    const view = await import('./games/gomokuView');
    return { adapter: view.adapter, Board: view.default };
  },
  checkers: async () => {
    const view = await import('./games/checkersView');
    return { adapter: view.adapter, Board: view.default };
  },
  'gin-rummy': async () => {
    const view = await import('./games/gin-rummyView');
    return { adapter: view.adapter, Board: view.default };
  },
  mancala: async () => {
    const view = await import('./games/mancalaView');
    return { adapter: view.adapter, Board: view.default };
  },
  dominoes: async () => {
    const view = await import('./games/dominoesView');
    return { adapter: view.adapter, Board: view.default };
  },
  'dots-and-boxes': async () => {
    const view = await import('./games/dots-and-boxesView');
    return { adapter: view.adapter, Board: view.default, makeAdapter: view.createDotsAdapter };
  },
  chess: async () => {
    const view = await import('./games/chessView');
    return { adapter: view.adapter, Board: view.default };
  },
  'nested-tic-tac-toe': async () => {
    const view = await import('./games/nested-tic-tac-toeView');
    return { adapter: view.adapter, Board: view.default };
  },
  scopa: async () => {
    const view = await import('./games/scopaView');
    return { adapter: view.adapter, Board: view.default };
  },
  nim: async () => {
    const view = await import('./games/nimView');
    return { adapter: view.adapter, Board: view.default };
  },
};
const cache = new Map<NearbyGameId, Promise<NearbyGame>>();
export function loadNearbyGame(id: NearbyGameId): Promise<NearbyGame> {
  if (isGroupGameId(id)) return Promise.reject(new Error('Ludo uses the four-seat room'));
  let loading = cache.get(id);
  if (!loading) {
    loading = loaders[id as keyof typeof loaders]().catch((error: unknown) => {
      cache.delete(id);
      throw error;
    });
    cache.set(id, loading);
  }
  return loading;
}
