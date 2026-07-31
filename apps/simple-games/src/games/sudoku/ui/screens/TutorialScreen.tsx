/**
 * Quick Rules (docs/SUDOKU_RULES.md §13): three steps, one sentence each,
 * shown with a figure rather than explained in prose. The long-form rules live
 * on the game's landing page behind "Learn More", which quietly does nothing
 * offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useSudoku } from '../../state/GameContext';

/** A 3x3 box with one missing cell: the whole rule in one picture. */
function BoxExample({ values, highlight }: { values: string[]; highlight?: number }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sudoku-tutorial-box">
        {values.map((value, index) => (
          <span
            key={index}
            className={`sudoku-tutorial-cell ${index === highlight ? 'sudoku-tutorial-cell-focus' : ''}`}
          >
            {value === '.' ? '' : value}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Notes in one cell: three pencilled candidates. */
function NotesExample() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sudoku-tutorial-box sudoku-tutorial-box-single">
        <span className="sudoku-tutorial-cell">
          <span className="sudoku-notes">
            {['1', '', '3', '', '', '', '7', '', ''].map((note, index) => (
              <span key={index} className="sudoku-note">
                {note}
              </span>
            ))}
          </span>
        </span>
      </div>
    </div>
  );
}

export function SudokuTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useSudoku();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('sudoku', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('sudokuStep1Title'),
      body: t('sudokuStep1Body'),
      example: (
        <BoxExample values={['1', '2', '3', '4', '5', '6', '7', '8', '.']} highlight={8} />
      ),
    },
    {
      title: t('sudokuStep2Title'),
      body: t('sudokuStep2Body'),
      example: <NotesExample />,
    },
    {
      title: t('sudokuStep3Title'),
      body: t('sudokuStep3Body'),
      // A box missing one digit: exactly what a hint points at, and a legal
      // position — a figure that broke the rules would teach the wrong thing.
      example: (
        <BoxExample values={['1', '2', '3', '4', '.', '6', '7', '8', '9']} highlight={4} />
      ),
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
