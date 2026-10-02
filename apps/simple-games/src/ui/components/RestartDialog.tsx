/**
 * What the ↻ in a game's top bar asks (docs/ARCHITECTURE.md「シェルの枠とゲームの
 * 中身」, 「ヘッダの ↻ は結果カードと同じ 2 択」).
 *
 * It used to be a plain confirmation of "retry the same board", which left a
 * player who wanted a *different* board the long way round: Home, the mode
 * button, and a second confirmation there. Now the one question offers the
 * same two continuations the result card already does — the same board
 * again and, when this mode has another board to give, a fresh one — plus
 * Cancel, which keeps the autofocus because the other two throw the game in
 * progress away (the body is the same data-loss sentence every confirmation
 * uses, `confirmNewGameBody`, so the release gate on it is untouched).
 *
 * Whether a second option exists, what it is called and what it does are the
 * game's to say: a free Solitaire deal is "New deal", a Minesweeper
 * difficulty board is "New board", a Sudoku free board is "New Game" — each
 * the very label and action its result card uses, so the two places never
 * disagree. A daily has no other board, and a numbered level's "other board"
 * is another level, chosen from the home; both pass nothing and get the
 * two-button form. The shell never decides this from the session — it does
 * not read one (docs/ARCHITECTURE.md「レイヤー規則」).
 *
 * Column layout like the review question (ReviewPrompt): every option reads
 * whole in every language, where a row would fold "Retry same board" against
 * "New board" on a narrow phone.
 */
import { useSettings } from '../../state/SettingsContext';

export interface RestartDialogNewBoard {
  /** The game's own label for a fresh board — the one its result card shows. */
  label: string;
  /** Starts that fresh board; the dialog has already closed when this runs. */
  start: () => void;
}

export interface RestartDialogProps {
  open: boolean;
  /** Rebuilds the same board from scratch; the dialog has already closed when this runs. */
  onRetry: () => void;
  /**
   * The fresh-board offer, or undefined when this mode has no other board to
   * give (a daily, a numbered level) — the dialog then asks only about the
   * retry, and says nothing about the option that does not exist.
   */
  newBoard?: RestartDialogNewBoard;
  /**
   * What starting over costs, when a game has its own way of saying it (the
   * drills: "This set starts over from the first question"). Defaults to the
   * sentence every confirmation uses, `confirmNewGameBody`.
   */
  body?: string;
  /** Closes the dialog. Also called ahead of either action, so the caller clears one flag. */
  onClose: () => void;
}

export function RestartDialog({ open, onRetry, newBoard, body, onClose }: RestartDialogProps) {
  const { t } = useSettings();
  if (!open) return null;
  const title = t('restartTitle');
  return (
    <div className="overlay" onClick={onClose}>
      <div
        className="dialog"
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">{body ?? t('confirmNewGameBody')}</p>
        <div className="dialog-actions dialog-actions-column">
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => {
              onClose();
              onRetry();
            }}
          >
            {t('tryAgain')}
          </button>
          {newBoard ? (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                onClose();
                newBoard.start();
              }}
            >
              {newBoard.label}
            </button>
          ) : null}
          <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus>
            {t('cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
