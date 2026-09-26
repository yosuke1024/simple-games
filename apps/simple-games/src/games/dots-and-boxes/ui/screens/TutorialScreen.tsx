/**
 * Quick Rules (docs/DOTS_AND_BOXES_RULES.md §9): three steps, one sentence or
 * two each, shown with a small board rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which appears only once that page exists (src/ui/landing.ts) and quietly
 * does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { BOX_CPU, BOX_PLAYER, EDGE_OPEN, EDGE_PLAYER, hEdge, vEdge, type Board } from '../../game';
import { useDotsAndBoxes } from '../../state/GameContext';
import { BoxMark } from '../components/DotsAndBoxesBoard';

/** A 2×2 corner of a board, drawn with the board's own classes. */
function MiniBoard({ board, fresh }: { board: Board; fresh: number | null }) {
  const { n, edges, boxes } = board;
  const line = (key: string, edge: number, orientation: 'h' | 'v') => {
    const state = edges[edge];
    const owner = state === EDGE_OPEN ? '' : state === EDGE_PLAYER ? 'db-line-you' : 'db-line-cpu';
    // The line the step is about wears a still halo — a figure explains, it
    // does not replay a move.
    const mark = edge === fresh ? 'db-line-figure-fresh' : '';
    return (
      <span
        key={key}
        className={['db-edge', `db-edge-${orientation}`, owner, mark].filter(Boolean).join(' ')}
      />
    );
  };

  const cells: ReactNode[] = [];
  for (let gridRow = 0; gridRow <= 2 * n; gridRow++) {
    for (let gridCol = 0; gridCol <= 2 * n; gridCol++) {
      const key = `${gridRow}-${gridCol}`;
      if (gridRow % 2 === 0 && gridCol % 2 === 0) {
        cells.push(<span key={key} className="db-dot" />);
      } else if (gridRow % 2 === 0) {
        cells.push(line(key, hEdge(n, gridRow / 2, (gridCol - 1) / 2), 'h'));
      } else if (gridCol % 2 === 0) {
        cells.push(line(key, vEdge(n, (gridRow - 1) / 2, gridCol / 2), 'v'));
      } else {
        const owner = boxes[((gridRow - 1) / 2) * n + (gridCol - 1) / 2];
        cells.push(
          owner === BOX_PLAYER ? (
            <span key={key} className="db-box db-box-you">
              <BoxMark owner="you" />
            </span>
          ) : owner === BOX_CPU ? (
            <span key={key} className="db-box db-box-cpu">
              <BoxMark owner="cpu" />
            </span>
          ) : (
            <span key={key} className="db-box" />
          ),
        );
      }
    }
  }

  return (
    <div className="tutorial-example" aria-hidden="true">
      <div className="db-board db-board-2 db-figure">{cells}</div>
    </div>
  );
}

/*
 * Edges of a 2×2 board, in the game's own order (§1): six horizontal lines
 * h(0,0) h(0,1) h(1,0) h(1,1) h(2,0) h(2,1), then six vertical ones
 * v(0,0) v(0,1) v(0,2) v(1,0) v(1,1) v(1,2). '1' is yours, '2' the CPU's.
 */

/** A few lines down, and yours just drawn on the right. */
const FIRST_LINE: Board = { n: 2, edges: '100002001000', boxes: '....' };

/** Your fourth side on the top-left box: it is yours, and you draw again. */
const CLOSED_BOX: Board = { n: 2, edges: '102002210001', boxes: 'p...' };

/** Every line drawn: three boxes to one. */
const FULL_BOARD: Board = { n: 2, edges: '121122112121', boxes: 'ppcp' };

export function DotsAndBoxesTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startNewGame, goHome } = useDotsAndBoxes();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('dots-and-boxes', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('dotsAndBoxesStep1Title'),
      body: t('dotsAndBoxesStep1Body'),
      example: <MiniBoard board={FIRST_LINE} fresh={vEdge(2, 0, 2)} />,
    },
    {
      title: t('dotsAndBoxesStep2Title'),
      body: t('dotsAndBoxesStep2Body'),
      example: <MiniBoard board={CLOSED_BOX} fresh={vEdge(2, 0, 1)} />,
    },
    {
      title: t('dotsAndBoxesStep3Title'),
      body: t('dotsAndBoxesStep3Body'),
      example: <MiniBoard board={FULL_BOARD} fresh={null} />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // The first match is on the smallest board; the others are one tap
      // away on the home screen (§9).
      startNewGame('small');
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
