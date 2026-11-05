import '../../games/spades/i18n';
import '../../games/spades/ui/spades.css';
import { Table } from '../../games/spades/ui/components/Table';
import { validView } from '../../games/spades/game/view';
import type { GroupBoardProps } from '../groupGames';
export default function SpadesBoard({ state, seat, names, canAct, act, visible }: GroupBoardProps) {
  if (!validView(state, seat)) return null;
  return <Table view={state} names={names} canAct={canAct && visible} act={act} />;
}
export { game } from './spades';
