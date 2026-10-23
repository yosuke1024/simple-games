import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { useResultReveal } from '@/ui/useResultReveal';
import { useFallingBlocks } from '../../state/GameContext';
export function ResultOverlay({ onNewBoard }: { onNewBoard: () => void }) {
  const { t } = useSettings();
  const { session, stats, retry, goHome } = useFallingBlocks();
  const reveal = useResultReveal(session?.status === 'over');
  if (!session || !reveal) return null;
  const details = [
    { label: t('score'), value: String(session.score) },
    { label: t('fallingBlocksLines'), value: String(session.lines) },
  ];
  return (
    <div className="overlay overlay-result">
      <div
        className="dialog result"
        role="alertdialog"
        aria-modal="true"
        aria-label={t('fallingBlocksOver')}
        onKeyDownCapture={(e) => {
          if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
        }}
      >
        <h2 className="dialog-title">{t('fallingBlocksOver')}</h2>
        <p className="dialog-body">{t('fallingBlocksResultBody')}</p>
        <dl className="result-facts">
          {details.map((fact) => (
            <div key={fact.label}>
              <dt>{fact.label}</dt>
              <dd>{fact.value}</dd>
            </div>
          ))}
          <div>
            <dt>{t('fallingBlocksBest')}</dt>
            <dd>{stats.bestScore}</dd>
          </div>
        </dl>
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={retry} autoFocus>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onNewBoard}>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={goHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="falling-blocks" outcome="played" details={details} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
