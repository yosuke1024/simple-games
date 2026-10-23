import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useNim } from '../../state/GameContext';
function Figure({ step }: { step: number }) {
  return (
    <svg viewBox="0 0 280 120" width="280" style={{ maxWidth: '100%' }} aria-hidden="true">
      {step < 2 ? (
        [0, 1, 2].map((row) => (
          <g key={row}>
            {Array.from({ length: row + 3 }, (_, i) => (
              <circle
                key={i}
                cx={40 + i * 36}
                cy={24 + row * 35}
                r="10"
                fill={step === 1 && row === 1 && i > 1 ? 'none' : 'currentColor'}
                stroke="currentColor"
                strokeWidth="2"
              />
            ))}
            {row === 1 ? (
              <rect
                x="20"
                y="41"
                width="180"
                height="34"
                rx="8"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="3"
              />
            ) : null}
          </g>
        ))
      ) : (
        <>
          <circle cx="65" cy="60" r="14" fill="currentColor" />
          <path
            d="M100 60 H175 m-12 -12 12 12 -12 12"
            stroke="currentColor"
            strokeWidth="3"
            fill="none"
          />
          <text x="205" y="75" fontSize="48" fill="var(--accent)">
            ✓
          </text>
        </>
      )}
    </svg>
  );
}
export function TutorialScreen() {
  const { t } = useSettings();
  const {
    tutorialCompleted,
    completeTutorial,
    session,
    preferredMode,
    startNewGame,
    resumeGame,
    goHome,
  } = useNim();
  const [step, setStep] = useState(0);
  const titles = ['nimStep1Title', 'nimStep2Title', 'nimStep3Title'] as const;
  const bodies = ['nimStep1Body', 'nimStep2Body', 'nimStep3Body'] as const;
  const finish = () => {
    if (tutorialCompleted) goHome();
    else {
      completeTutorial();
      if (session?.status === 'playing') resumeGame();
      else startNewGame(preferredMode);
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
      <WebBetaNotice gameId="nim" />
      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {[0, 1, 2].map((i) => (
            <span key={i} className={`dot ${i === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{t(titles[step]!)}</h2>
        <div className="tutorial-example">
          <Figure step={step} />
        </div>
        <p className="tutorial-body">{t(bodies[step]!)}</p>
      </div>
      <div className="tutorial-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            {t('back')}
          </button>
        ) : (
          <span />
        )}
        {step === 2 ? (
          <button type="button" className="btn btn-primary" onClick={finish}>
            {tutorialCompleted ? t('close') : t('startPlaying')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {t('next')}
          </button>
        )}
      </div>
    </div>
  );
}
