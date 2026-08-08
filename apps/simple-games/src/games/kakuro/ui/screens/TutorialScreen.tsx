/**
 * Quick Rules (docs/KAKURO_RULES.md §12): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules live
 * on the game's landing page behind "Learn More", which quietly does nothing
 * offline (docs/OFFLINE_POLICY.md) and is absent entirely until that page is
 * written (ui/landing.ts).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useKakuro } from '../../state/GameContext';

/**
 * A slice of a real board: a clue square, then the run it names.
 *
 * The clue is drawn the way the board draws it — split, with the sum in the
 * upper right — because it is the one thing a first-time player has to learn
 * to read, and a figure that simplified it would teach a square this game
 * never prints.
 *
 * `cells` holds a digit or '.' for empty; `mark` names the square the step is
 * about, and `broken` is the one figure allowed to show a rule being broken.
 */
function RunFigure({
  sum,
  cells,
  mark,
  broken,
}: {
  sum: number;
  cells: readonly string[];
  mark?: number;
  broken?: readonly number[];
}) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div
        className="kakuro-figure"
        style={{ gridTemplateColumns: `repeat(${cells.length + 1}, max-content)` }}
      >
        <span className="kakuro-figure-clue">
          <span className="kakuro-clue-right">{sum}</span>
        </span>
        {cells.map((cell, index) => (
          <span
            key={index}
            className={[
              'kakuro-figure-cell',
              mark === index ? 'kakuro-figure-cell-mark' : '',
              broken?.includes(index) ? 'kakuro-figure-cell-broken' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {cell === '.' ? '' : cell}
          </span>
        ))}
      </div>
    </div>
  );
}

export function KakuroTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useKakuro();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('kakuro', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('kakuroStep1Title'),
      body: t('kakuroStep1Body'),
      // Three cells behind an 11: 2 and 5 are down, so the gap is 4.
      example: <RunFigure sum={11} cells={['2', '.', '5']} mark={1} />,
    },
    {
      title: t('kakuroStep2Title'),
      body: t('kakuroStep2Body'),
      // 3 and 3 do add to 6 — and are still wrong, which is exactly the point
      // of rule 1. The board marks both of them (§5).
      example: <RunFigure sum={6} cells={['3', '3']} broken={[0, 1]} />,
    },
    {
      title: t('kakuroStep3Title'),
      body: t('kakuroStep3Body'),
      // Two cells summing to 16: {7,9} is the only set there is, which is the
      // deduction the whole game is built on (§7 technique 1).
      example: <RunFigure sum={16} cells={['.', '.']} mark={0} />,
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
