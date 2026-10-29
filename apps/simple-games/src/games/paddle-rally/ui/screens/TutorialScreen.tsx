import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { usePaddleRally } from '../../state/GameContext';
function Figure({ step }: { step: number }) {
  return (
    <svg viewBox="0 0 280 120" width="280" style={{ maxWidth: '100%' }} aria-hidden="true">
      <rect
        x="15"
        y="5"
        width="250"
        height="110"
        rx="10"
        fill="var(--surface)"
        stroke="var(--line)"
      />
      <path d="M20 60 H260" stroke="var(--line)" strokeDasharray="5 5" />
      <rect x="160" y="15" width="55" height="7" rx="3" fill="var(--ink)" className="pr-cpu" />
      <rect x="70" y="98" width="55" height="7" rx="3" fill="var(--accent)" />
      {step === 0 ? (
        <path
          d="M40 90 H155 m-8 -6 8 6 -8 6 M48 84 l-8 6 8 6"
          stroke="var(--accent)"
          fill="none"
          strokeWidth="2"
        />
      ) : null}
      {step === 1 ? (
        <path
          d="M97 90 L157 40 L210 90"
          stroke="var(--accent)"
          fill="none"
          strokeDasharray="4 4"
          strokeWidth="2"
        />
      ) : null}
      <circle cx={step === 0 ? 140 : 157} cy={step === 0 ? 60 : 40} r="5" fill="var(--accent)" />
      {step === 2 ? (
        <text x="140" y="83" textAnchor="middle" fontSize="28" fill="var(--ink)">
          5 : 3
        </text>
      ) : null}
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
  } = usePaddleRally();
  const [step, setStep] = useState(0);
  const titles = [
    'paddleRallyStep1Title',
    'paddleRallyStep2Title',
    'paddleRallyStep3Title',
  ] as const;
  const bodies = ['paddleRallyStep1Body', 'paddleRallyStep2Body', 'paddleRallyStep3Body'] as const;
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
      <WebBetaNotice gameId="paddle-rally" />
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
