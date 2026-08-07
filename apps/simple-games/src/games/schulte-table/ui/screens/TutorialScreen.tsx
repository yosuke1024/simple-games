/**
 * Quick Rules (docs/SCHULTE_TABLE_RULES.md §12): three steps, one sentence
 * each, shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md) and is absent until the page exists.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useSchulte } from '../../state/GameContext';

/**
 * A 3x3 board drawn like the real one. `done` marks cells already tapped —
 * every figure is a position the game could actually be in, because a figure
 * that broke the rules would teach the wrong thing.
 */
function BoardFigure({ values, done = [] }: { values: number[]; done?: number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="schulte-figure">
        {values.map((value) => (
          <span
            key={value}
            className={`schulte-figure-cell ${done.includes(value) ? 'schulte-figure-cell-done' : ''}`}
          >
            {value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SchulteTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useSchulte();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('schulte-table', locale);
  const [step, setStep] = useState(0);

  // One scattered 3x3, shown three times: untouched, part-way, and finished.
  // Using the same board throughout is what makes the three steps read as one
  // round rather than three unrelated pictures.
  const figure = [7, 2, 9, 4, 6, 1, 3, 8, 5];

  const steps = [
    {
      title: t('schulteStep1Title'),
      body: t('schulteStep1Body'),
      example: <BoardFigure values={figure} />,
    },
    {
      title: t('schulteStep2Title'),
      body: t('schulteStep2Body'),
      example: <BoardFigure values={figure} done={[1, 2, 3]} />,
    },
    {
      title: t('schulteStep3Title'),
      body: t('schulteStep3Body'),
      example: <BoardFigure values={figure} done={figure} />,
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
