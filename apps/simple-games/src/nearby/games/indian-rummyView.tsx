import '../../games/indian-rummy/i18n';
import '../../games/indian-rummy/ui/indian-rummy.css';
import { Table } from '../../games/indian-rummy/ui/components/Table';
import { validView } from '../../games/indian-rummy/game/view';
import type { GroupBoardProps } from '../groupGames';
export default function IndianRummyBoard({
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
export { game } from './indian-rummy';
