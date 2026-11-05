import '../../games/texas-holdem/i18n';
import '../../games/texas-holdem/ui/texas-holdem.css';
import { Table } from '../../games/texas-holdem/ui/components/Table';
import { validView } from '../../games/texas-holdem/game/view';
import type { GroupBoardProps } from '../groupGames';
export default function TexasHoldemBoard({
  state,
  seat,
  names,
  canAct,
  act,
  visible,
}: GroupBoardProps) {
  if (!validView(state, seat)) return null;
  return <Table view={state} names={names} canAct={canAct && visible} act={act} />;
}
export { game } from './texas-holdem';
