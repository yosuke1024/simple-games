import { useLayoutEffect, useRef } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { ResultAdSlot } from '@/ui/components/ResultAdSlot';
import { ShareAction } from '@/ui/components/ShareAction';
import { useResultReveal } from '@/ui/useResultReveal';
import { useDialogDismiss } from '@/ui/useDialogDismiss';
import type { Session } from '../../game';
import { project } from '../../game/view';
import { Results } from './Table';
type Props = { session: Session; onRetry: () => void; onNewBoard: () => void; onHome: () => void };
export function ResultOverlay(props: Props) {
  const revealed = useResultReveal(props.session.status !== 'playing');
  return revealed ? <ResultCard {...props} /> : null;
}
function ResultCard({ session, onRetry, onNewBoard, onHome }: Props) {
  const { t } = useSettings();
  useDialogDismiss(onHome);
  const heading = useRef<HTMLHeadingElement>(null);
  useLayoutEffect(() => {
    heading.current?.focus({ preventScroll: true });
  }, []);
  const won = session.status === 'won';
  const title = t(
    won ? 'crazyEightsWon' : session.status === 'draw' ? 'crazyEightsDraw' : 'crazyEightsLost',
  );
  return (
    <div className="overlay overlay-result">
      <div
        className={`dialog result ${won ? 'result-clear' : ''}`}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <h2 className="dialog-title" ref={heading} tabIndex={-1}>
          {title}
        </h2>
        <Results view={project(session, 0)} />
        <div className="result-actions">
          <button type="button" className="btn btn-primary" onClick={onNewBoard}>
            {t('newGame')}
          </button>
          <button type="button" className="btn btn-secondary" onClick={onRetry}>
            {t('tryAgain')}
          </button>
          <button type="button" className="btn btn-ghost" onClick={onHome}>
            {t('backHome')}
          </button>
        </div>
        <ShareAction gameId="crazy-eights" outcome={won ? 'completed' : 'played'} details={[]} />
      </div>
      <ResultAdSlot />
    </div>
  );
}
