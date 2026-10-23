import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useKnightTour } from '../../state/GameContext';
function Figure({ step }: { step: number }) {
  return (
    <svg fill="currentColor" viewBox="0 0 200 160" width="200" aria-hidden="true">
      {Array.from({ length: 16 }, (_, i) => (
        <rect
          key={i}
          x={20 + (i % 4) * 35}
          y={10 + Math.floor(i / 4) * 35}
          width="35"
          height="35"
          fill={(Math.floor(i / 4) + (i % 4)) % 2 ? 'var(--accent-soft)' : 'var(--surface)'}
          stroke="var(--line)"
        />
      ))}
      {step === 0 ? (
        <>
          <text x="24" y="143" fontSize="34">
            ♘
          </text>
          <path d="M37 116 V63 H72" fill="none" stroke="var(--accent)" strokeWidth="4" />
          <circle cx="72" cy="63" r="7" fill="var(--accent)" />
        </>
      ) : step === 1 ? (
        <>
          <text x="28" y="139" fontSize="20">
            1
          </text>
          <text x="63" y="69" fontSize="20">
            2
          </text>
          <text x="133" y="34" fontSize="20">
            3
          </text>
          <path d="M42 128 77 58 147 23" stroke="var(--accent)" strokeWidth="3" fill="none" />
        </>
      ) : (
        <>
          <text x="70" y="100" fontSize="58" fill="var(--accent)">
            ↶
          </text>
          <text x="126" y="140" fontSize="24">
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
  } = useKnightTour();
  const [step, setStep] = useState(0);
  const titles = ['knightTourStep1Title', 'knightTourStep2Title', 'knightTourStep3Title'] as const;
  const bodies = ['knightTourStep1Body', 'knightTourStep2Body', 'knightTourStep3Body'] as const;
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
      <WebBetaNotice gameId="knight-tour" />
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
