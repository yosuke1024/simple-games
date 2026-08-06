/**
 * Quick Rules (docs/NONOGRAM_RULES.md §11): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useNonogram } from '../../state/GameContext';

/**
 * One line of the real board, with its clue beside it. Every figure is a line
 * the game could actually deal — a figure that broke the rules would teach
 * the wrong thing.
 */
function LineFigure({
  clue,
  cells,
  done = false,
}: {
  clue: string;
  cells: string;
  done?: boolean;
}) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="nono-figure">
        <span className={`nono-figure-clue ${done ? 'nono-figure-clue-done' : ''}`}>{clue}</span>
        {[...cells].map((cell, index) => (
          <span
            key={index}
            className={[
              'nono-figure-cell',
              cell === 'f' ? 'nono-figure-cell-filled' : '',
              cell === 'x' ? 'nono-figure-cell-crossed' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {cell === 'x' ? '×' : ''}
          </span>
        ))}
      </div>
    </div>
  );
}

export function NonoTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useNonogram();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('nonogram', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('nonoStep1Title'),
      body: t('nonoStep1Body'),
      // "1 2": one painted square, a gap of at least one, then two in a row.
      example: <LineFigure clue="1 2" cells="f.ff." />,
    },
    {
      title: t('nonoStep2Title'),
      body: t('nonoStep2Body'),
      // A 3-run pinned to the middle of five cells: the ends are crossed out.
      example: <LineFigure clue="3" cells="xfffx" />,
    },
    {
      title: t('nonoStep3Title'),
      body: t('nonoStep3Body'),
      // A finished line: its clue reads exactly, and dims.
      example: <LineFigure clue="5" cells="fffff" done />,
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
