/**
 * Quick Rules (docs/NUMBER_RECALL_RULES.md §13): three steps, one sentence
 * each, shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md) and is absent until the page exists.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useRecall } from '../../state/GameContext';

/**
 * A 3x3 board drawn like the real one. `layout` is the game's own shape — 0 is
 * an empty cell — so every figure is a position the game could actually be in.
 * `hidden` marks tiles drawn face down, and `mark` the one a miss would point
 * at. A figure that broke the rules would teach the wrong thing.
 */
function BoardFigure({
  layout,
  hidden = [],
  mark,
}: {
  layout: number[];
  hidden?: number[];
  mark?: number;
}) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="recall-figure">
        {layout.map((value, index) => {
          if (value === 0) {
            return <span key={index} className="recall-figure-cell recall-figure-cell-empty" />;
          }
          const down = hidden.includes(value);
          return (
            <span
              key={index}
              className={[
                'recall-figure-cell',
                'recall-figure-tile',
                down ? 'recall-figure-tile-down' : '',
                mark === value ? 'recall-figure-tile-mark' : '',
              ]
                .filter(Boolean)
                .join(' ')}
            >
              {down ? '' : value}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function RecallTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useRecall();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('number-recall', locale);
  const [step, setStep] = useState(0);

  // One three-tile layout, shown three times: all up (the look), 1 taken and
  // the rest down (the recall), and a miss with the wanted tile marked. Using
  // the same layout throughout is what makes the steps read as one round.
  const layout = [0, 2, 0, 1, 0, 0, 0, 0, 3];

  const steps = [
    {
      title: t('recallStep1Title'),
      body: t('recallStep1Body'),
      example: <BoardFigure layout={layout} />,
    },
    {
      title: t('recallStep2Title'),
      body: t('recallStep2Body'),
      example: <BoardFigure layout={layout} hidden={[2, 3]} />,
    },
    {
      title: t('recallStep3Title'),
      body: t('recallStep3Body'),
      example: <BoardFigure layout={layout} hidden={[3]} mark={2} />,
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
