import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useHanoiTowers } from '../../state/GameContext';
import { TutorialFigure } from '../components/TutorialFigure';
export function TutorialScreen() {
  const { t } = useSettings();
  const {
    tutorialCompleted,
    completeTutorial,
    canResume,
    resumeGame,
    preferredSize,
    startBoard,
    goHome,
  } = useHanoiTowers();
  const [step, setStep] = useState(0);
  const rules = [t('hanoiTowersRule1'), t('hanoiTowersRule2'), t('hanoiTowersRule3')];
  const finish = () => {
    if (tutorialCompleted) goHome();
    else {
      completeTutorial();
      if (canResume) resumeGame();
      else startBoard(preferredSize);
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
      <WebBetaNotice gameId="hanoi-towers" />
      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {step + 1} / 3
        </div>
        <div className="tutorial-example">
          <TutorialFigure step={step} />
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
