/**
 * Quick Rules (docs/CHECKERS_RULES.md §9): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useCheckers } from '../../state/GameContext';

/**
 * A 4×4 corner of the board, enough to draw one jump without shrinking the
 * pieces to dots. Values: 0 empty, 1 your man, 2 the CPU's, 3 a target dot,
 * 4 the piece the step is about, 5 your king.
 *
 * The squares alternate the way the board does, and the figure starts on a
 * dark one so every piece in it stands where a piece really could.
 */
function BoardFigure({ cells }: { cells: readonly number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="ck-figure">
        {cells.map((value, index) => {
          const dark = (Math.floor(index / 4) + index) % 2 === 0;
          return (
            <span key={index} className={`ck-figure-square ${dark ? 'ck-figure-square-dark' : ''}`}>
              {value === 1 || value === 4 || value === 5 ? (
                <span
                  className={`ck-figure-piece ck-figure-you ${value === 4 ? 'ck-figure-fresh' : ''}`}
                >
                  {value === 5 ? <span className="ck-king-ring" /> : null}
                </span>
              ) : value === 2 ? (
                <span className="ck-figure-piece ck-figure-cpu" />
              ) : value === 3 ? (
                <span className="ck-figure-dot" />
              ) : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Your man on the third row can take the CPU piece ahead of it and land on
 * the dot. The two squares behind are empty and still not offered.
 */
const CAPTURE = [0, 0, 3, 0, 0, 2, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0];

/** Landed, and there is a second piece to take from here. */
const KEEP_JUMPING = [3, 0, 0, 0, 0, 2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0];

/** The far row reached, and the piece is a king — it moves backwards now. */
const CROWNED = [0, 5, 0, 0, 3, 0, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0];

export function CheckersTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useCheckers();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('checkers', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('checkersStep1Title'),
      body: t('checkersStep1Body'),
      example: <BoardFigure cells={CAPTURE} />,
    },
    {
      title: t('checkersStep2Title'),
      body: t('checkersStep2Body'),
      example: <BoardFigure cells={KEEP_JUMPING} />,
    },
    {
      title: t('checkersStep3Title'),
      body: t('checkersStep3Body'),
      example: <BoardFigure cells={CROWNED} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // The first match is against the gentlest opponent; the others are one
      // tap away on the home screen (§4).
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
