import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useFallingBlocks } from '../../state/GameContext';
export function TutorialScreen() {
  const { t } = useSettings();
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, newGame, goHome } =
    useFallingBlocks();
  const [step, setStep] = useState(0);
  const finish = () => {
    if (tutorialCompleted) goHome();
    else {
      completeTutorial();
      if (canResume) resumeGame();
      else newGame();
    }
  };
  const rules = [t('fallingBlocksRule1'), t('fallingBlocksRule2'), t('fallingBlocksRule3')];
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
      <WebBetaNotice gameId="falling-blocks" />
      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {step + 1} / 3
        </div>
        <div className="tutorial-example">
          <svg className="fb-tutorial" viewBox="0 0 180 150" aria-hidden="true">
            <rect
              x="30"
              y="5"
              width="120"
              height="140"
              rx="7"
              fill="none"
              stroke="currentColor"
              opacity="0.35"
            />
            {step === 0 ? (
              <>
                <path
                  d="M80 25h20v20H80zM60 45h20v20H60zM80 45h20v20H80zM100 45h20v20h-20z"
                  fill="currentColor"
                />
                <text x="90" y="105" textAnchor="middle" fontSize="28" fill="currentColor">
                  ← ↻ →
                </text>
              </>
            ) : step === 1 ? (
              <>
                <path d="M35 120h110v20H35z" fill="currentColor" opacity="0.65" />
                <path
                  d="M60 75h20v20H60zM80 75h20v20H80zM100 75h20v20h-20zM80 55h20v20H80z"
                  fill="none"
                  stroke="currentColor"
                  strokeDasharray="3 2"
                />
                <path
                  d="M90 15v25m-6-7 6 7 6-7"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                />
              </>
            ) : (
              <>
                <path
                  d="M35 120h110v20H35zM35 99h88v20H35zM57 78h66v20H57zM78 57h45v20H78zM78 36h45v20H78zM78 15h23v20H78z"
                  fill="currentColor"
                  opacity="0.6"
                />
                <text x="48" y="62" fontSize="24" fill="currentColor">
                  Ⅱ
                </text>
              </>
            )}
          </svg>
        </div>
        <p className="tutorial-body">{rules[step]}</p>
      </div>
      <div className="tutorial-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-secondary" onClick={() => setStep(step - 1)}>
            {t('back')}
          </button>
        ) : null}
        <button
          type="button"
          className="btn btn-primary btn-big"
          onClick={() => (step < 2 ? setStep(step + 1) : finish())}
        >
          {step < 2 ? t('next') : tutorialCompleted ? t('close') : t('startPlaying')}
        </button>
      </div>
    </div>
  );
}
