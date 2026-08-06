/**
 * Quick Rules (docs/BLOCK_PUZZLE_RULES.md §11): three steps, one sentence
 * each, shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useBlockPuzzle } from '../../state/GameContext';

/**
 * A whole 8×8 board, drawn small. Every figure is a position the game could
 * actually be in — no row or column is full except the one the second figure
 * is about to clear, and the ghost always sits on empty cells. A figure that
 * broke the rules would teach the wrong thing.
 *
 * '#' filled, '.' empty, 'o' the piece being dropped, 'x' a line clearing.
 */
type FigureRows = readonly [string, string, string, string, string, string, string, string];

/** A drop in progress: the 2×2 riding above the finger, over open space (§3). */
const FIGURE_DROP: FigureRows = [
  '........',
  '...##...',
  '...##...',
  '....oo..',
  '....oo..',
  '##......',
  '##.#....',
  '###.....',
];

/** The instant a row has filled: eight cells, about to go (§4). */
const FIGURE_LINE: FigureRows = [
  '........',
  '........',
  '...#....',
  '..##....',
  '..##.#..',
  'xxxxxxxx',
  '##.###..',
  '##.###.#',
];

/**
 * A board with nothing left but scattered single cells — every row and every
 * column still has a gap, so nothing has cleared, and yet only a 1×1 would
 * fit. This is what running out of room looks like (§2).
 */
const FIGURE_FULL: FigureRows = [
  '.#######',
  '###.####',
  '######.#',
  '#.######',
  '####.###',
  '#######.',
  '##.#####',
  '#####.##',
];

const CLASS_FOR: Record<string, string> = {
  '#': 'bp-figure-cell bp-figure-cell-filled',
  o: 'bp-figure-cell bp-figure-cell-ghost',
  x: 'bp-figure-cell bp-figure-cell-filled bp-figure-cell-clearing',
};

function BoardFigure({ rows }: { rows: FigureRows }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="bp-figure">
        {rows.map((row, rowIndex) =>
          row
            .split('')
            .map((character, colIndex) => (
              <span
                key={`${rowIndex}-${colIndex}`}
                className={CLASS_FOR[character] ?? 'bp-figure-cell'}
              />
            )),
        )}
      </div>
    </div>
  );
}

export function BlockTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useBlockPuzzle();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('block-puzzle', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('blockStep1Title'),
      body: t('blockStep1Body'),
      example: <BoardFigure rows={FIGURE_DROP} />,
    },
    {
      title: t('blockStep2Title'),
      body: t('blockStep2Body'),
      example: <BoardFigure rows={FIGURE_LINE} />,
    },
    {
      title: t('blockStep3Title'),
      body: t('blockStep3Body'),
      example: <BoardFigure rows={FIGURE_FULL} />,
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

      {/* Only once the guide exists: a "Learn More" built before the page is
          up is a 404 inside our own site (src/ui/landing.ts). */}
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
