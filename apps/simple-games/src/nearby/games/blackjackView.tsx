import '../../games/blackjack/i18n';
import '../../games/blackjack/ui/blackjack.css';
import { Table } from '../../games/blackjack/ui/components/Table';
import { decodeBlackjack } from './blackjack';
import type { GroupBoardProps } from '../groupGames';
export default function BlackjackBoard({
  state,
  seat,
  names,
  canAct,
  act,
  visible,
}: GroupBoardProps) {
  const view = decodeBlackjack(state, seat);
  if (!view) return null;
  return <Table view={view} names={names} canAct={canAct && visible} act={act} />;
}
export { game } from './blackjack';
