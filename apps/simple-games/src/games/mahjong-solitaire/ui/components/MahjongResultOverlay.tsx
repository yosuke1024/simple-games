/**
 * The clear screen (docs/MAHJONG_SOLITAIRE_RULES.md §9). Time and hints —
 * the facts of the run. The time appears only here, because showing it while
 * playing would be a clock counting up at someone doing a puzzle. There is
 * no losing screen, because stuck is a notice with free ways out, not an
 * ending (§7).
 */
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { formatDuration } from '@/ui/format';
import { MAX_LEVEL, type MahjongSession } from '../../game';
import type { LastResult } from '../../state/GameContext';

export interface MahjongResultOverlayProps {
  session: MahjongSession;
  lastResult: LastResult | null;
  onRetry: () => void;
  onNextLevel: () => void;
  onHome: () => void;
}

export function MahjongResultOverlay({
  session,
  lastResult,
  onRetry,
  onNextLevel,
  onHome,
}: MahjongResultOverlayProps) {
  const { t } = useSettings();
  if (session.status !== 'won') return null;

  const hasNextLevel =
    session.mode === 'level' && session.level !== null && session.level < MAX_LEVEL;

  return (
    <div className="overlay">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('mahjongClearTitle')}
      >
        <h2 className="dialog-title">{t('mahjongClearTitle')}</h2>
        <p className="dialog-body">{t('mahjongClearBody')}</p>

        <dl className="result-facts">
          <div>
            <dt>{t('timeLabel')}</dt>
            <dd>{formatDuration(session.elapsedSeconds)}</dd>
          </div>
          <div>
            <dt>{t('mahjongHintsUsed')}</dt>
            <dd>{session.hintCount}</dd>
          </div>
        </dl>

        {lastResult?.isNewBestTime ? (
          <p className="dialog-body">{t('mahjongNewBestTime')}</p>
        ) : lastResult ? (
          <p className="dialog-body">
            {t('bestTime')} {formatDuration(lastResult.bestSeconds)}
          </p>
        ) : null}

        <div className="result-actions">
          {hasNextLevel ? (
            <button type="button" className="btn btn-primary" onClick={onNextLevel} autoFocus>
              {t('nextLevel')}
            </button>
          ) : null}
          <button
            type="button"
            className={`btn ${hasNextLevel ? 'btn-secondary' : 'btn-primary'}`}
            onClick={onRetry}
            autoFocus={!hasNextLevel}
          >
            {t('tryAgain')}
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
