/**
 * The end-of-run screen (docs/BLOCK_PUZZLE_RULES.md §2, §5). There is no
 * clear to celebrate — the board simply ran out of room — so this states what
 * happened and offers the next board, free, right there.
 *
 * The score and the lines are the facts of the run. A personal best is
 * mentioned quietly rather than made into an event, and there is nothing to
 * buy: no continue, no extra piece, no ad to watch for one more move (§7,
 * §13). Undo is still behind this dialog, and a run that ended one placement
 * too early can be taken back for nothing.
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import type { BlockSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface BlockResultOverlayProps {
  session: BlockSession;
  lastResult: LastResult | null;
  onNewGame: () => void;
  onHome: () => void;
}

export function BlockResultOverlay({
  session,
  lastResult,
  onNewGame,
  onHome,
}: BlockResultOverlayProps) {
  const { t } = useSettings();
  if (session.status !== 'over') return null;

  return (
    <div className="overlay">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('blockOverTitle')}
      >
        <h2 className="dialog-title">{t('blockOverTitle')}</h2>
        <p className="dialog-body">{t('blockOverBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('score')}</dt>
            <dd>{session.score}</dd>
          </div>
          <div>
            <dt>{t('blockLines')}</dt>
            <dd>{session.linesCleared}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestScore && session.score > 0 ? (
          <p className="dialog-body">{t('blockNewBestScore')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('blockBestScore')} {lastResult.bestScore}
          </p>
        ) : null}

        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewGame} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
      </div>
      <ResultAdSlot />
    </div>
  );
}
