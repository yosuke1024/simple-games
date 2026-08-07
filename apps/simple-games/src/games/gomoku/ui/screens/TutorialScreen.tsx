/**
 * Quick Rules (docs/GOMOKU_RULES.md §9): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules
 * live on the game's landing page behind "Learn More", which quietly does
 * nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useGomoku } from '../../state/GameContext';

/**
 * A 5×5 corner of the board, enough to draw a line of five without shrinking
 * the stones to dots. Values: 0 empty, 1 black, 2 white, 3 the aimed-at
 * point, 4 the stone the step is about.
 */
function BoardFigure({ cells }: { cells: readonly number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="gm-figure">
        {cells.map((value, index) => (
          <span key={index} className="gm-figure-point">
            {value === 1 || value === 4 ? (
              <span
                className={`gm-figure-stone gm-figure-black ${value === 4 ? 'gm-figure-fresh' : ''}`}
              />
            ) : value === 2 ? (
              <span className="gm-figure-stone gm-figure-white" />
            ) : value === 3 ? (
              <span className="gm-figure-ghost" />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A stone aimed at, waiting for its second tap. */
const AIMING = [0, 0, 0, 0, 0, 0, 2, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0];

/** Five black across the middle row: the game, finished. */
const FIVE = [0, 0, 2, 0, 0, 0, 2, 0, 0, 0, 1, 1, 1, 1, 4, 0, 0, 2, 0, 0, 0, 0, 0, 0, 0];

/** Three white with both ends open — the shape to take before it is four. */
const OPEN_THREE = [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 3, 2, 2, 2, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0];

export function GomokuTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useGomoku();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('gomoku', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('gomokuStep1Title'),
      body: t('gomokuStep1Body'),
      example: <BoardFigure cells={AIMING} />,
    },
    {
      title: t('gomokuStep2Title'),
      body: t('gomokuStep2Body'),
      example: <BoardFigure cells={FIVE} />,
    },
    {
      title: t('gomokuStep3Title'),
      body: t('gomokuStep3Body'),
      example: <BoardFigure cells={OPEN_THREE} />,
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
