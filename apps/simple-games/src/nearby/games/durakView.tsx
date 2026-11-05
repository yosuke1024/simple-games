import '../../games/durak/i18n';
import '../../games/durak/ui/durak.css';
import { Table } from '../../games/durak/ui/components/Table';
import { validView } from '../../games/durak/game/view';
import type { GroupBoardProps } from '../groupGames';
export default function DurakBoard({ state, seat, names, canAct, act, visible }: GroupBoardProps) {
  if (!validView(state, seat)) return null;
  return <Table view={state} names={names} canAct={canAct && visible} act={act} />;
}
export { game } from './durak';
