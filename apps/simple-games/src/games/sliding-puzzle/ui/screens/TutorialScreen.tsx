/**
 * Quick Rules (docs/SLIDING_PUZZLE_RULES.md §11): three steps, one sentence
 * each, shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useSlidingPuzzle } from '../../state/GameContext';

/**
 * A 3x3 board drawn like the real one. `moving` marks the tiles a tap would
 * slide; '.' is the gap. Every figure is a position the game could actually be
 * in — a figure that broke the rules would teach the wrong thing.
 */
function BoardFigure({ values, moving = [] }: { values: string[]; moving?: number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="slide-figure">
        {values.map((value, index) => (
          <span
            key={index}
            className={[
              'slide-figure-cell',
              value === '.' ? 'slide-figure-cell-blank' : '',
              moving.includes(index) ? 'slide-figure-cell-move' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {value === '.' ? '' : value}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SlidingPuzzleTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useSlidingPuzzle();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('sliding-puzzle', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('slideStep1Title'),
      body: t('slideStep1Body'),
      // The 8 is beside the gap: tapping it slides it one place right.
      example: (
        <BoardFigure
          values={['1', '2', '3', '4', '5', '6', '7', '8', '.']}
          moving={[7]}
        />
      ),
    },
    {
      title: t('slideStep2Title'),
      body: t('slideStep2Body'),
      // The gap is at the row's start, so tapping the 3 brings all three over.
      example: (
        <BoardFigure
          values={['1', '2', '3', '4', '5', '6', '.', '7', '8']}
          moving={[7, 8]}
        />
      ),
    },
    {
      title: t('slideStep3Title'),
      body: t('slideStep3Body'),
      // The finished board: 1..8 in reading order, gap bottom-right (§2).
      example: <BoardFigure values={['1', '2', '3', '4', '5', '6', '7', '8', '.']} />,
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
