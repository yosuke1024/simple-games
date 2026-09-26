/**
 * Quick Rules (docs/NUMBER_PATH_RULES.md §10): three steps, one sentence
 * each, shown with a figure rather than explained in prose. There is no
 * "Learn More" here: the game is in early release on the web and has no
 * guide page yet.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { buildBoard, type Board, type Path } from '../../game';
import { useNumberPath } from '../../state/GameContext';
import { cellClasses, cellView, pathPositions } from '../components/cellView';

/**
 * A 3×3 board with its road drawn as far as the step needs. The same cell
 * view as the live board draws it, so the figure and the game agree on what
 * a wall, a number and a path look like. Decorative — the sentence beside it
 * carries the meaning.
 */
function Figure({ board, path }: { board: Board; path: Path }) {
  const positions = pathPositions(board, path);
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="np-figure">
        {board.numbers.map((_, index) => {
          const view = cellView(board, path, positions, index);
          return (
            <span key={index} className={cellClasses(view).join(' ')}>
              {view.walls.map((side) => (
                <span key={side} className={`np-wall np-wall-${side}`} />
              ))}
              {view.segments.map((side) => (
                <span key={side} className={`np-seg np-seg-${side}`} />
              ))}
              {view.isEnd ? <span className="np-end" /> : null}
              {view.number !== 0 ? <span className="np-digit">{view.number}</span> : null}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/** A road across a 3×3: 1 at a corner, 2 in the middle, 3 at the far corner. */
const ROAD: Path = [0, 1, 2, 5, 4, 3, 6, 7, 8];
const OPEN = buildBoard({
  width: 3,
  height: 3,
  numbers: [
    [0, 1],
    [4, 2],
    [8, 3],
  ],
  walls: [],
})!;
/** The same road with the two walls that leave it no other way. */
const WALLED = buildBoard({
  width: 3,
  height: 3,
  numbers: [
    [0, 1],
    [4, 2],
    [8, 3],
  ],
  walls: ['h1', 'h4'],
})!;

export function NumberPathTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, prefs, goHome } = useNumberPath();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('numberPathStep1Title'),
      body: t('numberPathStep1Body'),
      // The road has reached 2: numbers in order, one line from 1.
      example: <Figure board={OPEN} path={ROAD.slice(0, 5)} />,
    },
    {
      title: t('numberPathStep2Title'),
      body: t('numberPathStep2Body'),
      // The whole road: every square once, ending on 3.
      example: <Figure board={OPEN} path={ROAD} />,
    },
    {
      title: t('numberPathStep3Title'),
      body: t('numberPathStep3Body'),
      // Two walls, and the road bending around them.
      example: <Figure board={WALLED} path={ROAD.slice(0, 6)} />,
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
    </div>
  );
}
