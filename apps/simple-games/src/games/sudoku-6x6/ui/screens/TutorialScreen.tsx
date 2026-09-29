/**
 * Quick Rules (docs/SUDOKU_6X6_RULES.md §12): three steps, one sentence each,
 * shown with a figure rather than explained in prose. There is no "Learn
 * More" while the game is in early release — ui/landing.ts decides that, not
 * this screen.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useSudoku6x6 } from '../../state/GameContext';

/**
 * A small real 6×6 board: `rows` as six strings of '1'–'6' or '.', with the
 * cells of `focus` tinted. Drawn with the grid's own seams (after column 3,
 * after rows 2 and 4), so the picture teaches the box shape as well as the
 * rule. Decorative; the sentence beside it carries the meaning.
 */
function BoardFigure({ rows, focus }: { rows: readonly string[]; focus: readonly number[] }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="s6-figure">
        {rows.flatMap((line, row) =>
          [...line].map((character, col) => {
            const index = row * 6 + col;
            return (
              <span
                key={index}
                className={`s6-figure-cell ${focus.includes(index) ? 's6-figure-cell-focus' : ''}`}
                data-seam-right={col === 2}
                data-seam-bottom={row === 1 || row === 3}
              >
                {character === '.' ? '' : character}
              </span>
            );
          }),
        )}
      </div>
    </div>
  );
}

/** Notes in one cell: three pencilled candidates, in their 3×2 corners. */
function NotesFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <span className="s6-figure-note-cell">
        <span className="s6-notes">
          {['1', '', '3', '', '5', ''].map((note, index) => (
            <span key={index} className="s6-note">
              {note}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}

/** The top-left box of a legal board, and where it sits. */
const BOX_FILLED = ['123...', '456...', '......', '......', '......', '......'];
const BOX_CELLS = [0, 1, 2, 6, 7, 8];
/** The same box missing its 5: exactly what a hint points at. */
const BOX_MISSING = ['123...', '4.6...', '......', '......', '......', '......'];

export function Sudoku6x6TutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, prefs, goHome } = useSudoku6x6();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('sudoku-6x6', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('sudoku6x6Step1Title'),
      body: t('sudoku6x6Step1Body'),
      example: <BoardFigure rows={BOX_FILLED} focus={BOX_CELLS} />,
    },
    {
      title: t('sudoku6x6Step2Title'),
      body: t('sudoku6x6Step2Body'),
      example: <NotesFigure />,
    },
    {
      title: t('sudoku6x6Step3Title'),
      body: t('sudoku6x6Step3Body'),
      example: <BoardFigure rows={BOX_MISSING} focus={[7]} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startDifficulty(prefs.difficulty);
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
