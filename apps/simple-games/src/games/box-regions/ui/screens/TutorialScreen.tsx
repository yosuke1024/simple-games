/**
 * Quick Rules (docs/BOX_REGIONS_RULES.md §12): three steps, one sentence
 * each, shown with a figure rather than explained in prose. There is no
 * "Learn More": the game's guide page is not published while it is in early
 * release (ui/landing.ts).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game, and
 * hardware Back marks it seen on the way out (state/GameContext.tsx).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { UNASSIGNED, type Clue } from '../../game';
import { useBoxRegions } from '../../state/GameContext';
import { cellEdges, TINT_COUNT } from '../components/BoxRegionsBoard';
import { ShapeKindIcon } from '../components/ShapeKindIcon';

const FIGURE_SIZE = 3;

/**
 * A 3×3 figure drawn with the board's own classes. `cells` is one letter per
 * cell (`a`, `b`, …) or `.` for an empty one; `preview` is a rectangle being
 * dragged out, drawn the way the real board draws it. Decorative — the
 * sentence beside it carries the meaning.
 */
function MiniBoard({
  cells,
  clues,
  preview = [],
}: {
  cells: string;
  clues: readonly Clue[];
  preview?: readonly number[];
}) {
  const size = FIGURE_SIZE;
  const region = (index: number): number => {
    const letter = cells[index] ?? '.';
    return letter === '.' ? UNASSIGNED : letter.charCodeAt(0) - 97;
  };
  const count = (r: number): number => [...cells].filter((c) => c.charCodeAt(0) - 97 === r).length;
  const previewRows = preview.map((index) => Math.floor(index / size));
  const previewCols = preview.map((index) => index % size);
  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="br-board br-figure" style={{ '--br-cols': size, '--br-rows': size } as never}>
        <div className="br-cells">
          {[...cells].map((_, index) => {
            const r = region(index);
            const row = Math.floor(index / size);
            const col = index % size;
            const edges = cellEdges(region, index, row, col, size, size);
            const clueIndex = clues.findIndex((c) => c.index === index);
            const clue = clueIndex === -1 ? null : clues[clueIndex]!;
            const held = clueIndex === -1 ? 0 : count(clueIndex);
            const inPreview = preview.includes(index);
            const classes = [
              'br-cell',
              r !== UNASSIGNED ? `br-tint-${r % TINT_COUNT}` : '',
              edges.top ? 'br-edge-t' : '',
              edges.right ? 'br-edge-r' : '',
              edges.bottom ? 'br-edge-b' : '',
              edges.left ? 'br-edge-l' : '',
              inPreview ? 'br-cell-preview br-preview-ok' : '',
              inPreview && row === Math.min(...previewRows) ? 'br-pv-t' : '',
              inPreview && col === Math.max(...previewCols) ? 'br-pv-r' : '',
              inPreview && row === Math.max(...previewRows) ? 'br-pv-b' : '',
              inPreview && col === Math.min(...previewCols) ? 'br-pv-l' : '',
            ]
              .filter(Boolean)
              .join(' ');
            return (
              <span key={index} className={classes}>
                {clue ? (
                  <span className="br-clue">
                    <ShapeKindIcon kind={clue.kind} />
                    {clue.size !== null ? (
                      <span className="br-clue-count">
                        {held === 0 || held === clue.size ? clue.size : `${held}/${clue.size}`}
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

export function BoxRegionsTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startDifficulty, goHome } = useBoxRegions();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('boxRegionsStep1Title'),
      body: t('boxRegionsStep1Body'),
      // A finished board: three boxes, one clue in each.
      example: (
        <MiniBoard
          cells="aabaabccc"
          clues={[
            { index: 0, size: 4, kind: 'square' },
            { index: 5, size: 2, kind: 'tall' },
            { index: 7, size: 3, kind: 'wide' },
          ]}
        />
      ),
    },
    {
      title: t('boxRegionsStep2Title'),
      body: t('boxRegionsStep2Body'),
      // The clues alone: a number and a kind, a kind only, a number only.
      example: (
        <MiniBoard
          cells="........."
          clues={[
            { index: 0, size: 4, kind: 'square' },
            { index: 5, size: null, kind: 'tall' },
            { index: 7, size: 3, kind: 'free' },
          ]}
        />
      ),
    },
    {
      title: t('boxRegionsStep3Title'),
      body: t('boxRegionsStep3Body'),
      // One box drawn, the next being dragged out corner to corner.
      example: (
        <MiniBoard
          cells="aa.aa...."
          clues={[
            { index: 0, size: 4, kind: 'square' },
            { index: 5, size: 2, kind: 'tall' },
            { index: 7, size: 3, kind: 'wide' },
          ]}
          preview={[6, 7, 8]}
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
