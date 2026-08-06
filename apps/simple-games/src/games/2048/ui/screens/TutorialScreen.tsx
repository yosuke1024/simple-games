/**
 * Quick Rules (docs/GAME_2048_RULES.md §11): three steps, one sentence each,
 * shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useGame2048 } from '../../state/GameContext';

/**
 * A whole 4×4 board, so the picture teaches the shape as well as the rule.
 * Every figure is a position the game could actually reach — a figure that
 * broke the rules would teach the wrong thing.
 */
function BoardFigure({ cells, fresh }: { cells: readonly number[]; fresh?: number }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="tm-figure">
        {cells.map((value, index) => (
          <span
            key={index}
            className={[
              'tm-figure-cell',
              value === 0 ? 'tm-figure-cell-empty' : '',
              index === fresh ? 'tm-figure-cell-fresh' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {value === 0 ? '' : value}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Before: two 2s side by side, and a 4 that has nothing to join. */
const BEFORE = [0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 4, 0, 0, 0, 0, 0];

/** After a swipe left: the 2s are one 4, everything is packed over, and one
 *  new tile has arrived (§4, §5). */
const AFTER = [0, 0, 0, 2, 4, 0, 0, 0, 4, 0, 0, 0, 0, 0, 0, 0];

/** A board with one square left — the position Undo is for (§6). */
const TIGHT = [2, 4, 8, 16, 4, 2, 4, 8, 2, 8, 2, 4, 4, 2, 4, 0];

export function Game2048TutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useGame2048();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('2048', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('mergeStep1Title'),
      body: t('mergeStep1Body'),
      example: <BoardFigure cells={BEFORE} />,
    },
    {
      title: t('mergeStep2Title'),
      body: t('mergeStep2Body'),
      example: <BoardFigure cells={AFTER} fresh={3} />,
    },
    {
      title: t('mergeStep3Title'),
      body: t('mergeStep3Body'),
      example: <BoardFigure cells={TIGHT} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startNewGame();
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
