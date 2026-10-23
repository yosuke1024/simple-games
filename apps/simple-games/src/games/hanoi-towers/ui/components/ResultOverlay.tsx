import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { useResultReveal } from '@/ui/useResultReveal';
import type { Session } from '../../game';
export function ResultOverlay({
  session,
  best,
  onUndo,
  onRetry,
  onHome,
}: {
  session: Session;
  best: number | null;
  onUndo: () => void;
  onRetry: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  const revealed = useResultReveal(session.status === 'over');
  if (!revealed) return null;
  const details = [
    { label: t('movesLabel'), value: String(session.history.length) },
    { label: t('hanoiTowersBoard'), value: t('hanoiTowersDisks', { count: session.size }) },
  ];
  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result result-clear"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('hanoiTowersClear')}
        onKeyDownCapture={(event) => {
          if (event.repeat && (event.key === 'Enter' || event.key === ' ')) event.preventDefault();
        }}
      >
        <h2 className="dialog-title">{t('hanoiTowersClear')}</h2>
        <p className="dialog-body">{t('hanoiTowersClearBody')}</p>
        <dl className="result-facts">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
          {best !== null ? (
            <div>
              <dt>{t('hanoiTowersBest')}</dt>
              <dd>{best}</dd>
            </div>
          ) : null}
        </dl>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onRetry} autoFocus>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onUndo}>
            {t('undo')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="hanoi-towers" outcome="completed" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
