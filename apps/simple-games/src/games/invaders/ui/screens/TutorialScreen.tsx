import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconClose } from '@/ui/components/icons';
import { useInvaders } from '../../state/GameContext';
import { Invader, Ship } from '../components/Shapes';
export function TutorialScreen() {
  const { t } = useSettings();
  const { tutorialCompleted, completeTutorial, canResume, resumeRun, startNewRun, goHome } =
    useInvaders();
  const [page, setPage] = useState(0);
  const rules = [t('invadersRule1'), t('invadersRule2'), t('invadersRule3')];
  const finish = () => {
    if (tutorialCompleted) goHome();
    else {
      completeTutorial();
      if (canResume) resumeRun();
      else startNewRun();
    }
  };
  return (
    <div className="screen tutorial-screen">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>
      <WebBetaNotice gameId="invaders" />
      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {page + 1} / 3
        </div>
        <div className="tutorial-example">
          <svg className="iv-figure" viewBox="0 0 220 170" aria-hidden="true" focusable="false">
            {page !== 2 ? (
              <>
                {[60, 110, 160].map((x, index) => (
                  <g key={x} transform={`translate(${x} 35)`} className="iv-enemy">
                    <Invader kind={index} />
                  </g>
                ))}
                <g transform="translate(110 140)">
                  <Ship />
                </g>
              </>
            ) : (
              <>
                {[65, 110, 155].map((x) => (
                  <g key={x} transform={`translate(${x} 70)`}>
                    <Ship />
                  </g>
                ))}
                <path d="M45 135h130" stroke="currentColor" strokeWidth="2" strokeDasharray="4 6" />
                <g transform="translate(110 112)" className="iv-enemy">
                  <Invader />
                </g>
              </>
            )}
            {page === 0 ? (
              <>
                <path
                  d="M110 110V67"
                  stroke="currentColor"
                  strokeWidth="3"
                  strokeDasharray="8 10"
                />
                <path
                  d="M40 140h35m-28-6-7 6 7 6m98-6h35m-7-6 7 6-7 6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                />
              </>
            ) : null}
            {page === 1 ? (
              <>
                <path d="m65 65-3 8 6 8-3 8" fill="none" stroke="currentColor" strokeWidth="3" />
                <path d="M55 104h30v13H55Z" fill="none" stroke="currentColor" strokeWidth="3" />
              </>
            ) : null}
          </svg>
        </div>
        <p className="tutorial-body">{rules[page]}</p>
      </div>
      <div className="tutorial-actions">
        {page > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setPage(page - 1)}>
            {t('back')}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => (page < 2 ? setPage(page + 1) : finish())}
        >
          {page < 2 ? t('next') : tutorialCompleted ? t('close') : t('startPlaying')}
        </button>
      </div>
    </div>
  );
}
