/**
 * Quick Rules (docs/REVERSI_RULES.md §10): three steps, one sentence each,
 * shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useReversi } from '../../state/GameContext';

/**
 * A 4×4 corner of the board, enough to draw one capture without shrinking
 * the discs to dots. Cells: 0 empty, 1 black, 2 white, 3 a legal-move dot,
 * 4 the disc the step is about.
 */
function BoardFigure({ cells }: { cells: readonly number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="rv-figure">
        {cells.map((value, index) => (
          <span key={index} className="rv-figure-cell">
            {value === 1 || value === 4 ? (
              <span
                className={`rv-figure-disc rv-figure-black ${value === 4 ? 'rv-figure-fresh' : ''}`}
              />
            ) : value === 2 ? (
              <span className="rv-figure-disc rv-figure-white" />
            ) : value === 3 ? (
              <span className="rv-figure-dot" />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Black to move: the dot closes the line, and two whites are caught. */
const CAPTURE = [0, 0, 0, 0, 1, 2, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0];

/** No dot anywhere for black: the turn passes by itself. */
const NO_MOVES = [1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 0, 0, 0];

/** A full corner counted out: more black than white. */
const COUNTING = [1, 1, 2, 2, 1, 1, 2, 1, 1, 1, 1, 1, 1, 2, 1, 1];

export function ReversiTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useReversi();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('reversi', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('reversiStep1Title'),
      body: t('reversiStep1Body'),
      example: <BoardFigure cells={CAPTURE} />,
    },
    {
      title: t('reversiStep2Title'),
      body: t('reversiStep2Body'),
      example: <BoardFigure cells={NO_MOVES} />,
    },
    {
      title: t('reversiStep3Title'),
      body: t('reversiStep3Body'),
      example: <BoardFigure cells={COUNTING} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // The first match is against the gentlest opponent; the others are one
      // tap away on the home screen (§5).
      startNewGame('easy');
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
