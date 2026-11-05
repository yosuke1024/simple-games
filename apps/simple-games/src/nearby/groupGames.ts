import type { ComponentType } from 'react';
import type { GroupGame } from './groupSession';
import type { NearbyGameId } from './gameTypes';
export interface GroupBoardProps {
  state: unknown;
  seat: number;
  names: readonly string[];
  canAct: boolean;
  act: (action: unknown) => void;
  visible: boolean;
  revision: number;
}
export interface NearbyGroupGame {
  game: GroupGame;
  Board: ComponentType<GroupBoardProps>;
}
const loaders = {
  hearts: () => import('./games/heartsView'),
  daifugo: () => import('./games/daifugoView'),
  sevens: () => import('./games/sevensView'),
  'old-maid': () => import('./games/old-maidView'),
  'crazy-eights': () => import('./games/crazy-eightsView'),
  durak: () => import('./games/durakView'),
  spades: () => import('./games/spadesView'),
  'texas-holdem': () => import('./games/texas-holdemView'),
  blackjack: () => import('./games/blackjackView'),
  'indian-rummy': () => import('./games/indian-rummyView'),
};
export async function loadGroupGame(id: NearbyGameId): Promise<NearbyGroupGame> {
  const load = loaders[id as keyof typeof loaders];
  if (!load) throw new Error('Unknown group game');
  const module = await load();
  return { game: module.game, Board: module.default };
}
