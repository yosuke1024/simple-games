/**
 * The promotion picker (docs/CHESS_RULES.md §2.6, §4): four pieces, the queen
 * first and focused when it opens. It opens before the move is played — the
 * move does not exist until a piece is chosen — so Escape, a tap outside the
 * card or the Cancel button closes it without moving, and the pawn stays
 * selected for another try. While it is open the board behind it is inert
 * (GameScreen).
 *
 * The four are drawn with the same pieces as the board, in the player's own
 * colour, and each button is named by its piece (§10's twelve keys).
 */
import { useSettings } from '@/state/SettingsContext';
import { useDialogDismiss } from '@/ui/useDialogDismiss';
import { BLACK, PROMOTION_KINDS, makePiece, type Color } from '../../game/types';
import { pieceKey } from './ChessBoard';
import { ChessPiece } from './ChessPiece';

export interface PromotionPickerProps {
  open: boolean;
  /** The player's colour: the new piece is theirs. */
  color: Color;
  onPick: (kind: number) => void;
  /** Also what Escape does. Nothing is played. */
  onCancel: () => void;
}

export function PromotionPicker(props: PromotionPickerProps) {
  // The card mounts and unmounts with `open`, so useDialogDismiss reads the
  // opener on the render that opens it (ConfirmDialog's shape).
  return props.open ? <PromotionCard {...props} /> : null;
}

function PromotionCard({ color, onPick, onCancel }: PromotionPickerProps) {
  const { t } = useSettings();
  useDialogDismiss(onCancel);
  const title = t('chessPromoteTitle');

  return (
    <div className="overlay" onClick={onCancel}>
      <div
        className="dialog ch-promotion"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        <div className="ch-promotion-choices">
          {PROMOTION_KINDS.map((kind, index) => (
            <button
              key={kind}
              type="button"
              className="ch-promotion-choice"
              aria-label={t(pieceKey(makePiece(color, kind)))}
              autoFocus={index === 0}
              onClick={() => onPick(kind)}
            >
              <ChessPiece kind={kind} white={color !== BLACK} />
            </button>
          ))}
        </div>
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
