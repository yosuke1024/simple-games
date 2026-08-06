/**
 * Quick Rules (docs/WATER_SORT_RULES.md §11): three steps, one sentence each,
 * shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useWaterSort } from '../../state/GameContext';

/**
 * A little rack of tubes. Every figure is a position the game could actually
 * be in — a figure that broke the rules would teach the wrong thing.
 */
function TubesFigure({ tubes, marked = [] }: { tubes: number[][]; marked?: number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="ws-figure">
        {tubes.map((tube, index) => (
          <span
            key={index}
            className={`ws-figure-tube ${marked.includes(index) ? 'ws-figure-tube-marked' : ''}`}
          >
            {tube.map((color, height) => (
              <span key={height} className={`ws-unit ws-color-${color}`} />
            ))}
          </span>
        ))}
      </div>
    </div>
  );
}

export function WaterTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useWaterSort();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('water-sort', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('waterStep1Title'),
      body: t('waterStep1Body'),
      // Blue on blue: the marked tubes show a legal pour.
      example: <TubesFigure tubes={[[0, 1, 1], [2, 0, 0], [1, 2, 2], []]} marked={[1, 0]} />,
    },
    {
      title: t('waterStep2Title'),
      body: t('waterStep2Body'),
      // The empty tubes are the workspace.
      example: <TubesFigure tubes={[[0, 1, 1], [2, 0], [1, 2, 2, 0], []]} marked={[3]} />,
    },
    {
      title: t('waterStep3Title'),
      body: t('waterStep3Body'),
      // The sorted end state (§2).
      example: <TubesFigure tubes={[[0, 0, 0, 0], [1, 1, 1, 1], [2, 2, 2, 2], []]} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startLevel(progress.highestUnlocked);
    } else {
      goHome();
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

      <div className="tutorial-card">
        <div className="tutorial-step-count" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={`dot ${index === step ? 'dot-active' : ''}`} />
          ))}
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
        {current.example}
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
        {lastStep ? (
          <button type="button" className="btn btn-primary" onClick={finish}>
            {tutorialCompleted ? t('close') : t('startPlaying')}
          </button>
        ) : (
          <button type="button" className="btn btn-primary" onClick={() => setStep(step + 1)}>
            {t('next')}
          </button>
        )}
      </div>

      {learnMoreUrl ? (
        <div className="home-links">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => openExternal(learnMoreUrl)}
          >
            {t('learnMore')}
          </button>
        </div>
      ) : null}
    </div>
  );
}
