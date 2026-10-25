import '../../games/nim/i18n';
import '../../games/nim/ui/nim.css';
import { NimPlaySurface } from '../../games/nim/ui/components/NimPlaySurface';
import type { NearbyBoardProps } from '../gameTypes';
import { isNimView } from './nim';

export default function NimView({ match, canAct, act }: NearbyBoardProps) {
  if (!isNimView(match.state)) return null;
  return (
    <div className="nim-play-area">
      <NimPlaySurface
        heaps={match.state.heaps}
        last={match.state.last}
        positionKey={`${match.round}:${match.revision}`}
        blocked={!canAct}
        onTake={(move) => act({ kind: 'take', ...move })}
      />
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './nim';
