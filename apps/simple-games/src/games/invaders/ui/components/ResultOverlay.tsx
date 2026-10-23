import { useSettings } from '@/state/SettingsContext';
import { ShareAction } from '@/ui/components/ShareAction';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { useResultReveal } from '@/ui/useResultReveal';
import { finished, STAGE_COUNT, type Session } from '../../game';
export function ResultOverlay({
  session,
  best,
  onRetry,
  onNext,
  onHome,
}: {
  session: Session;
  best: number;
  onRetry: () => void;
  onNext: () => void;
  onHome: () => void;
}) {
  const { t } = useSettings();
  const reveal = useResultReveal(finished(session));
  const between = session.status === 'between';
  if (!between && !reveal) return null;
  const won = session.status === 'won';
  const title = between ? t('invadersStageClear') : won ? t('invadersWon') : t('invadersOver');
  const details = [
    { label: t('score'), value: String(session.score) },
    { label: t('invadersStage'), value: `${session.stage} / ${STAGE_COUNT}` },
  ];
  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${between || won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        onKeyDownCapture={(event) => {
          if (event.repeat && (event.key === ' ' || event.key === 'Enter')) event.preventDefault();
        }}
      >
        <h2 className="dialog-title">{title}</h2>
        <p className="dialog-body">
          {between
            ? t('invadersStageClearBody')
            : won
              ? t('invadersWonBody')
              : t('invadersOverBody')}
        </p>
        <dl className="result-facts">
          {details.map((detail) => (
            <div key={detail.label}>
              <dt>{detail.label}</dt>
              <dd>{detail.value}</dd>
            </div>
          ))}
          {!between ? (
            <div>
              <dt>{t('invadersBest')}</dt>
              <dd>{best}</dd>
            </div>
          ) : null}
        </dl>
        <div className="result-actions">
          {between ? (
            <button type="button" className="btn btn-primary" autoFocus onClick={onNext}>
              {t('invadersNextStage')}
            </button>
          ) : (
            <button type="button" className="btn btn-primary" autoFocus onClick={onRetry}>
              {t('invadersRetry')}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        {!between ? (
          <ShareAction gameId="invaders" outcome={won ? 'completed' : 'played'} details={details} />
        ) : null}
      </div>
      {!between ? <ResultAdSlot /> : null}
    </div>
  );
}
