/**
 * Quick Rules (docs/FUTOSHIKI_RULES.md §12): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules live
 * on the game's landing page behind "Learn More", which quietly does nothing
 * offline (docs/OFFLINE_POLICY.md) and is absent entirely until that page is
 * written (ui/landing.ts).
 */
import { Fragment, useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useFutoshiki } from '../../state/GameContext';

/**
 * One line of a real board: squares with the signs between them, drawn the way
 * the board draws them. Every figure is a line the game could actually deal —
 * a figure that broke the rules would teach the wrong thing.
 *
 * `cells` holds a digit or '.' for empty; `signs[i]` is what sits between
 * cell i and cell i+1, or null for a plain gap. `mark` names the square the
 * step is about.
 */
function LineFigure({
  cells,
  signs,
  mark,
}: {
  cells: readonly string[];
  signs: readonly (string | null)[];
  mark?: number;
}) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="futoshiki-figure">
        {cells.map((cell, index) => (
          <Fragment key={index}>
            <span
              className={`futoshiki-figure-cell ${
                mark === index ? 'futoshiki-figure-cell-mark' : ''
              }`}
            >
              {cell === '.' ? '' : cell}
            </span>
            {index < cells.length - 1 ? (
              <span className="futoshiki-figure-sign">{signs[index] ?? ''}</span>
            ) : null}
          </Fragment>
        ))}
      </div>
    </div>
  );
}

export function FutoshikiTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useFutoshiki();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('futoshiki', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('futoshikiStep1Title'),
      body: t('futoshikiStep1Body'),
      // One row of a 4×4 with 1, 3 and 4 already down: the gap can only be 2.
      example: <LineFigure cells={['3', '1', '.', '4']} signs={[null, null, null]} mark={2} />,
    },
    {
      title: t('futoshikiStep2Title'),
      body: t('futoshikiStep2Body'),
      // The point aims at the 2, so the square beside it is 3 or 4.
      example: <LineFigure cells={['2', '.']} signs={['<']} mark={1} />,
    },
    {
      title: t('futoshikiStep3Title'),
      body: t('futoshikiStep3Body'),
      // A chain across a whole 4×4 row settles all four squares: 1 2 3 4. The
      // kind of reason a hint hands over when a board looks empty.
      example: <LineFigure cells={['.', '.', '.', '.']} signs={['<', '<', '<']} mark={0} />,
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
