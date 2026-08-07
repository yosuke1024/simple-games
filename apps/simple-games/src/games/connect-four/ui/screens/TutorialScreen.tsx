/**
 * Quick Rules (docs/CONNECT_FOUR_RULES.md §9): three steps, one sentence
 * each, shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useConnectFour } from '../../state/GameContext';

/**
 * A 5×4 corner of the grid, enough to draw a line of four. Cells: 0 empty,
 * 1 the player's disc, 2 the CPU's, 3 a disc the step is about.
 */
function GridFigure({ cells }: { cells: readonly number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="c4-figure">
        {cells.map((value, index) => (
          <span key={index} className="c4-figure-slot">
            {value === 1 || value === 3 ? (
              <span
                className={`c4-figure-disc c4-figure-you ${value === 3 ? 'c4-figure-fresh' : ''}`}
              />
            ) : value === 2 ? (
              <span className="c4-figure-disc c4-figure-cpu" />
            ) : null}
          </span>
        ))}
      </div>
    </div>
  );
}

/** A disc landing on the stack in its column: gravity, drawn. */
const DROP = [0, 0, 3, 0, 0, 0, 0, 2, 0, 0, 0, 2, 1, 0, 0, 1, 2, 1, 2, 0];

/** Four of the player's discs on a diagonal — the win, drawn. */
const LINE = [0, 0, 0, 3, 0, 0, 0, 1, 2, 0, 0, 1, 2, 2, 0, 1, 2, 1, 2, 0];

/** The CPU one disc from four: the square that has to be taken. */
const BLOCK = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3, 0, 0, 0, 0, 2, 2, 2, 1, 0];

export function ConnectFourTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useConnectFour();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('connect-four', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('fourStep1Title'),
      body: t('fourStep1Body'),
      example: <GridFigure cells={DROP} />,
    },
    {
      title: t('fourStep2Title'),
      body: t('fourStep2Body'),
      example: <GridFigure cells={LINE} />,
    },
    {
      title: t('fourStep3Title'),
      body: t('fourStep3Body'),
      example: <GridFigure cells={BLOCK} />,
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
