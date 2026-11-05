import '../../games/crazy-eights/i18n';
import '../../games/crazy-eights/ui/crazy-eights.css';
import { Table } from '../../games/crazy-eights/ui/components/Table';
import { validView } from '../../games/crazy-eights/game/view';
import type { GroupBoardProps } from '../groupGames';
export default function CrazyEightsBoard({
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
export { game } from './crazy-eights';
