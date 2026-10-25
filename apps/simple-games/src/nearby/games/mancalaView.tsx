import '../../games/mancala/i18n';
import '../../games/mancala/ui/mancala.css';
import { MancalaBoard } from '../../games/mancala/ui/components/MancalaBoard';
import { useGameKeys } from '../../ui/useGameKeys';
import type { NearbyBoardProps } from '../gameTypes';
import { isMancalaView } from './mancala';

export default function MancalaView({ match, seat, names, canAct, act }: NearbyBoardProps) {
  const offset = seat === 0 ? 0 : 7;
  const play = (pit: number) => {
    if (canAct) act({ kind: 'sow', pit: (pit + offset) % 14 });
  };
  useGameKeys((e) => {
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || !/^[1-6]$/.test(e.key)) return false;
    play(Number(e.key) - 1);
    return true;
  }, canAct);
  if (!isMancalaView(match.state)) return null;
  const { pits, last } = match.state;
  const localIndex = (i: number) => (i + 14 - offset) % 14;
  return (
    <div className="mc-body">
      <MancalaBoard
        pits={Array.from({ length: 14 }, (_, i) => pits[(i + offset) % 14]!)}
        playable={canAct}
        opponentName={names[1 - seat]}
        lastMove={
          last && {
            ...last,
            by: last.by === seat + 1 ? 1 : 2,
            pit: localIndex(last.pit),
            lastIndex: localIndex(last.lastIndex),
            touched: last.touched.map(localIndex),
          }
        }
        onPlay={play}
      />
    </div>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './mancala';
