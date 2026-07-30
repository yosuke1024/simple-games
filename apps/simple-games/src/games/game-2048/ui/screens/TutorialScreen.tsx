/**
 * Quick Rules (docs/GAME_2048_RULES.md §9): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules live
 * on the game's landing page behind "Learn More", which quietly does nothing
 * offline (docs/OFFLINE_POLICY.md).
 */
import { LANDING_BASE_URL } from '@simple-games/brand';
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { openExternal } from '@/ui/openExternal';
import { useGame2048 } from '../../state/GameContext';

/** A short line of squares — 0 draws an empty one. */
function TileStrip({ values }: { values: readonly number[] }) {
  return (
    <div className="g2048-strip">
      {values.map((value, index) =>
        value === 0 ? (
          <span key={index} className="g2048-strip-empty" />
        ) : (
          <span
            key={index}
            className="g2048-face g2048-strip-tile"
            data-value={value}
            data-digits={String(value).length}
          >
            {value}
          </span>
        ),
      )}
    </div>
  );
}

/** Before and after, with the move between them. */
function StepFigure({
  before,
  after,
  arrow,
}: {
  before: readonly number[];
  after: readonly number[];
  arrow: string;
}) {
  return (
    <div className="tutorial-example g2048-figure" aria-hidden="true">
      <TileStrip values={before} />
      <span className="g2048-figure-arrow">{arrow}</span>
      <TileStrip values={after} />
    </div>
  );
}

export function Game2048TutorialScreen() {
  const { tutorialCompleted, completeTutorial, startClassic, goHome } = useGame2048();
  const { t, locale } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('g2048Step1Title'),
      body: t('g2048Step1Body'),
      // Everything travels, all the way, in one move.
      example: <StepFigure before={[2, 0, 0, 4]} after={[0, 0, 2, 4]} arrow="→" />,
    },
    {
      title: t('g2048Step2Title'),
      body: t('g2048Step2Body'),
      // Two equal tiles, one doubled tile — and the score it is worth.
      example: <StepFigure before={[0, 0, 2, 2]} after={[0, 0, 0, 4]} arrow="→" />,
    },
    {
      title: t('g2048Step3Title'),
      body: t('g2048Step3Body'),
      example: (
        <div className="tutorial-example g2048-figure" aria-hidden="true">
          <TileStrip values={[1024, 1024]} />
          <span className="g2048-figure-arrow">→</span>
          <TileStrip values={[2048]} />
        </div>
      ),
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startClassic();
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

      <div className="home-links">
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => openExternal(`${LANDING_BASE_URL}/games/2048/${locale}/`)}
        >
          {t('learnMore')}
        </button>
      </div>
    </div>
  );
}
