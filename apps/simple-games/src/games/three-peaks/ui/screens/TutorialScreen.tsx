import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { IconClose } from '@/ui/components/icons';
import { useThreePeaks } from '../../state/GameContext';
import { ExampleCard } from '../components/CardArtwork';
export function ThreePeaksTutorialScreen() {
  const { t } = useSettings();
  const { tutorialCompleted, completeTutorial, canResume, resumeGame, startGame, goHome } =
    useThreePeaks();
  const [step, setStep] = useState(0);
  const steps = [
    { title: t('threePeaksStep1Title'), body: t('threePeaksStep1Body') },
    { title: t('threePeaksStep2Title'), body: t('threePeaksStep2Body') },
    { title: t('threePeaksStep3Title'), body: t('threePeaksStep3Body') },
  ];
  const current = steps[step]!;
  const finish = () => {
    if (tutorialCompleted) goHome();
    else {
      completeTutorial();
      if (canResume) resumeGame();
      else startGame();
    }
  };
  return (
    <div className="screen tutorial-screen tp-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted && (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        )}
      </header>
      <WebBetaNotice gameId="three-peaks" />
      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        <div className="tutorial-example tp-example" aria-hidden="true">
          {step === 0 ? (
            <>
              <ExampleCard card={5} />
              <span>→</span>
              <ExampleCard card={19} />
              <span>→</span>
              <ExampleCard card={7} />
            </>
          ) : step === 1 ? (
            <>
              <ExampleCard card={12} />
              <span>↔</span>
              <ExampleCard card={13} />
              <span>↔</span>
              <ExampleCard card={1} />
            </>
          ) : (
            <>
              <ExampleCard />
              <span>→</span>
              <ExampleCard card={0} />
              <span>↶</span>
            </>
          )}
        </div>
        <p className="tutorial-body">{current.body}</p>
      </div>
      <div className="tutorial-actions">
        {step > 0 ? (
          <button type="button" className="btn btn-ghost" onClick={() => setStep(step - 1)}>
            {t('back')}
          </button>
        ) : (
          <span />
        )}
        {step < 2 ? (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {t('next')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={finish}>
            {tutorialCompleted ? t('close') : t('startPlaying')}
          </button>
        )}
      </div>
    </div>
  );
}
