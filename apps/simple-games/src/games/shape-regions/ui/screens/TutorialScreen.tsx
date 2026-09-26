/**
 * Quick Rules (docs/SHAPE_REGIONS_RULES.md §12): three steps, one sentence
 * each, shown with a figure rather than explained in prose. There is no
 * "Learn More": the game's guide page is not published while it is in early
 * release (ui/landing.ts).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import {
  normalize,
  offsetsOf,
  regionSatisfiesClue,
  UNASSIGNED,
  type ShapeCategory,
} from '../../game';
import { useShapeRegions } from '../../state/GameContext';
import { ShapeIcon } from '../components/ShapeIcon';
import { cellCorners, cellEdges, TINT_COUNT } from '../components/ShapeRegionsBoard';

interface FigureClue {
  readonly index: number;
  readonly size: number | null;
  readonly shape: ShapeCategory | null;
}

/**
 * A 3×3 figure drawn with the board's own classes. `cells` is one letter per
 * cell (`a`, `b`, …) or `.` for an empty one, and each clue shows what the
 * real board would show at that point. Decorative — the sentence beside it
 * carries the meaning.
 */
function MiniBoard({ cells, clues }: { cells: string; clues: readonly FigureClue[] }) {
  const size = 3;
  const region = (index: number): number => {
    const letter = cells[index] ?? '.';
    return letter === '.' ? UNASSIGNED : letter.charCodeAt(0) - 97;
  };
  const count = (r: number): number => [...cells].filter((c) => c.charCodeAt(0) - 97 === r).length;
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="sr-board sr-figure" style={{ '--sr-cols': size, '--sr-rows': size } as never}>
        <div className="sr-cells">
          {[...cells].map((_, index) => {
            const r = region(index);
            const row = Math.floor(index / size);
            const col = index % size;
            const assigned = r !== UNASSIGNED;
            const edges = cellEdges(region, index, row, col, size, size);
            const corners = cellCorners(edges, assigned);
            const clue = clues.find((c) => c.index === index) ?? null;
            const held = [...cells].flatMap((_, i) => (region(i) === r ? [i] : []));
            const placed =
              clue !== null && clue.shape !== null && regionSatisfiesClue(held, clue, size);
            const iconCells = placed
              ? normalize(offsetsOf(held, size)).map((offset) => [offset.r, offset.c] as const)
              : undefined;
            const classes = [
              'sr-cell',
              assigned ? `sr-tint-${r % TINT_COUNT}` : '',
              edges.top ? 'sr-edge-t' : '',
              edges.right ? 'sr-edge-r' : '',
              edges.bottom ? 'sr-edge-b' : '',
              edges.left ? 'sr-edge-l' : '',
              corners.tl ? 'sr-corner-tl' : '',
              corners.tr ? 'sr-corner-tr' : '',
              corners.bl ? 'sr-corner-bl' : '',
              corners.br ? 'sr-corner-br' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <span key={index} className={classes}>
                {clue ? (
                  <span className="sr-clue">
                    {clue.shape ? <ShapeIcon category={clue.shape} cells={iconCells} /> : null}
                    {clue.size !== null ? (
                      <span className="sr-clue-count">
                        {count(r) === clue.size ? clue.size : `${count(r)}/${clue.size}`}
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function ShapeRegionsTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, goHome } = useShapeRegions();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('shapeRegionsStep1Title'),
      body: t('shapeRegionsStep1Body'),
      // A finished corner of four: the number counts it, the symbol names it.
      example: <MiniBoard cells="a..a..aa." clues={[{ index: 3, size: 4, shape: 'corner' }]} />,
    },
    {
      title: t('shapeRegionsStep2Title'),
      body: t('shapeRegionsStep2Body'),
      // Two of three cells grown from the clue, the count showing the way.
      example: <MiniBoard cells="aa......." clues={[{ index: 0, size: 3, shape: 'line' }]} />,
    },
    {
      title: t('shapeRegionsStep3Title'),
      body: t('shapeRegionsStep3Body'),
      // Every cell in a shape: what a finished board looks like.
      example: (
        <MiniBoard
          cells="aaabccbbc"
          clues={[
            { index: 0, size: 3, shape: 'line' },
            { index: 3, size: 3, shape: 'corner' },
            { index: 8, size: 3, shape: 'corner' },
          ]}
        />
      ),
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startDifficulty('easy');
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
