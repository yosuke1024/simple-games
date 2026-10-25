import '../../games/chess/i18n';
import '../../games/chess/ui/chess.css';
import { generateLegalMoves, inCheck } from '../../games/chess/game/engine';
import { parseFen } from '../../games/chess/game/fen';
import { ChessBoard } from '../../games/chess/ui/components/ChessBoard';
import { PromotionPicker } from '../../games/chess/ui/components/PromotionPicker';
import { useChessSelection } from '../../games/chess/ui/useChessSelection';
import { useSettings } from '../../state/SettingsContext';
import type { NearbyBoardProps } from '../gameTypes';
import { isChessView } from './chess';

export default function ChessView({ match, seat, canAct, act }: NearbyBoardProps) {
  const { t } = useSettings();
  const view = isChessView(match.state) ? match.state : null;
  const p = view && parseFen(view.fen);
  const legal = p && !view?.outcome ? generateLegalMoves(p) : [];
  const selection = useChessSelection(
    legal,
    canAct,
    `${match.round}:${match.revision}`,
    (from, to, promotion) => act({ kind: 'move', from, to, promotion }),
  );
  if (!view || !p) return null;
  return (
    <>
      {view.outcome && <p className="nearby-note">{t(`chessReason_${view.outcome.reason}`)}</p>}
      <div className="ch-body" inert={selection.promotion !== null}>
        <p className="ch-turn-line">
          {t(seat === 0 ? 'chessYouPlayWhite' : 'chessYouPlayBlack')}
          {canAct && inCheck(p) ? ` · ${t('chessYourTurnCheck')}` : ''}
        </p>
        <ChessBoard
          board={p.board}
          flipped={seat === 1}
          selected={selection.selected}
          targets={selection.targets}
          selectable={selection.selectable}
          checkSquare={inCheck(p) ? p.kings[p.side]! : -1}
          playing={canAct}
          lastMove={
            view.last === null
              ? null
              : {
                  move: view.last,
                  plies: view.plies,
                  by: (view.plies - 1) % 2 === seat ? 'player' : 'cpu',
                }
          }
          onSquare={selection.onSquare}
        />
      </div>
      <PromotionPicker
        open={selection.promotion !== null && canAct}
        color={seat}
        onPick={selection.pickPromotion}
        onCancel={selection.cancelPromotion}
      />
    </>
  );
}

// One lazy entry carries this game's view and its matching protocol adapter.
export { adapter } from './chess';
