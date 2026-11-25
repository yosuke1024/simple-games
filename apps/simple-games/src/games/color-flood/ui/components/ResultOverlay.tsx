/**
 * The clear card (docs/COLOR_FLOOD_RULES.md): the moves and the board size, the
 * personal best quietly, and the ways on. Undo stays here too. The Club House
 * gets the moves of the board's first clear only (the one the statistics
 * count), in that size's table; there is no daily, so nothing goes to Today.
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
import { ShareAction } from '@/ui/components/ShareAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { useResultReveal } from '@/ui/useResultReveal';
import type { Session } from '../../game';
export function ResultOverlay({
  session,
  best,
  firstClear,
  onUndo,
  onRetry,
  onNewBoard,
  onHome,
}: {
  session: Session;
  best: number | null;
  /** False for a clear reached again after Undo on this card: it is not sent to the Club. */
  firstClear: boolean;
  onUndo: () => void;
  onRetry: () => void;
  onNewBoard: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status === 'over');
  // The clear's facts, once: the share's strings and the Club's figures are
  // read from the same value (docs/architecture/club.md §6-1).
  const moves = session.history.length;
  const facts = useMemo(() => ({ moves }), [moves]);
  if (!revealed) return null;
  const details = [
    { label: t('movesLabel'), value: String(moves) },
    { label: t('colorFloodBoard'), value: `${session.size} × ${session.size}` },
  ];
  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('colorFloodClear')}
        onKeyDownCapture={(event) => {
          if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
        }}
      >
        <h2 className="dialog-title">{t('colorFloodClear')}</h2>
        <p className="dialog-body">{t('colorFloodClearBody')}</p>
        <dl className="result-facts">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
          {best !== null ? (
            <div>
              <dt>{t('colorFloodBest')}</dt>
              <dd>{best}</dd>
            </div>
          ) : null}
        </dl>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewBoard} autoFocus>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onUndo}>
            {t('undo')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="color-flood" outcome="completed" details={details} />
        {firstClear ? (
          <ClubResultAction
            gameId="color-flood"
            outcome="completed"
            details={details}
            facts={facts}
            seed={String(session.seed)}
            params={{ size: session.size }}
            boardDigest={null}
          />
        ) : null}
      </div>
      <ResultAdSlot />
    </div>
  );
}
