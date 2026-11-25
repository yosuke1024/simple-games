/**
 * The card between stages and at the end of a run (docs/INVADERS_RULES.md §5,
 * §8). Between stages it only holds the run until the player starts the next
 * one: no share, no ad, nothing sent. At the end — all twenty stages cleared
 * or the run lost — it shows the score and the stage reached, and shares those
 * same two figures.
 *
 * In a Club House the end card's score goes to the game's one table
 * (`ClubResultAction`, §13): a clear and a game over alike are `completed`,
 * with `{ score, stage }` built from the same values as the share's details,
 * while the share keeps its own split (a clear `completed`, a loss `played`).
 * A stage clear before the last, and a run abandoned with ↻, never reach the
 * end card and send nothing.
 */
import { useMemo } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ClubResultAction } from '@/ui/components/ClubResultAction';
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
  const { score, stage } = session;
  // The run's facts, once: the share's strings and the Club's figures are
  // read from the same fields (docs/architecture/club.md §6-1).
  const facts = useMemo(() => ({ score, stage }), [score, stage]);
  const between = session.status === 'between';
  if (!between && !reveal) return null;
  const won = session.status === 'won';
  const title = between ? t('invadersStageClear') : won ? t('invadersWon') : t('invadersOver');
  const details = [
    { label: t('score'), value: String(score) },
    { label: t('invadersStage'), value: `${stage} / ${STAGE_COUNT}` },
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
        {/* Only the end card shares and sends: a stage clear is not a result (§5). */}
        {!between ? (
          <>
            <ShareAction
              gameId="invaders"
              outcome={won ? 'completed' : 'played'}
              details={details}
            />
            <ClubResultAction
              gameId="invaders"
              outcome="completed"
              details={details}
              facts={facts}
              seed=""
              params={{}}
              boardDigest={null}
            />
          </>
        ) : null}
      </div>
      {!between ? <ResultAdSlot /> : null}
    </div>
  );
}
