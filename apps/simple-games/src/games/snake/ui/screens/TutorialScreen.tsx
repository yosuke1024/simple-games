/**
 * Quick Rules (docs/SNAKE_RULES.md §12): three steps, one sentence each, a
 * picture first — leading straight into play
 * (docs/PRODUCT_PRINCIPLES.md「初回体験の原則」). The pictures are drawn by the
 * board itself (SnakeBoard, through a window onto part of the grid), so what
 * they show is what the game shows: the turn arrow, the food, the × of a
 * crash against the wall.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends on a ready board, one
 * tap (or one swipe) from moving (or, when a suspended run outlived the
 * flag, back on that run, paused), and hardware Back marks it seen on the way
 * out (state/GameContext.tsx). There is no Learn More: this game has no
 * guide page (ui/landing.ts), and the button only appears when one exists.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { cellAt } from '../../game';
import { useSnake } from '../../state/GameContext';
import { SnakeBoard, type SnakeBoardProps } from '../components/SnakeBoard';

type Figure = Omit<SnakeBoardProps, 'className'>;

/** Moving right along row 7, the food above: the arrow is the turn about to be taken. */
const TURN: Figure = {
  body: [cellAt(7, 5), cellAt(7, 4), cellAt(7, 3)],
  food: cellAt(5, 5),
  direction: 'right',
  status: 'paused',
  crash: null,
  pending: 'up',
  view: { row: 4, col: 2, size: 6 },
};

/** The food right in front of the head: the next move eats it and the snake grows. */
const EAT: Figure = {
  body: [cellAt(6, 5), cellAt(7, 5), cellAt(7, 4), cellAt(7, 3)],
  food: cellAt(5, 5),
  direction: 'up',
  status: 'running',
  crash: null,
  pending: null,
  view: { row: 4, col: 2, size: 6 },
};

/** Against the right-hand wall: the run is over, and the head says so. */
const CRASH: Figure = {
  body: [cellAt(6, 13), cellAt(6, 12), cellAt(6, 11), cellAt(7, 11)],
  food: cellAt(8, 9),
  direction: 'right',
  status: 'over',
  crash: 'wall',
  pending: null,
  view: { row: 4, col: 8, size: 6 },
};

export function SnakeTutorialScreen() {
  const { tutorialCompleted, canResume, completeTutorial, startNewRun, resumeRun, goHome } =
    useSnake();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('snake', locale);
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('snakeStep1Title'),
      body: t('snakeStep1Body'),
      figure: TURN,
      alt: t('snakeFigureTurn'),
    },
    {
      title: t('snakeStep2Title'),
      body: t('snakeStep2Body'),
      figure: EAT,
      alt: t('snakeFigureEat'),
    },
    {
      title: t('snakeStep3Title'),
      body: t('snakeStep3Body'),
      figure: CRASH,
      alt: t('snakeFigureCrash'),
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  /* The first pass ends on a board (§12). Normally a fresh one, ready — but
     a suspended run can outlive the flag that says these steps were seen
     (`sn.flags` lost or unreadable while `sn.saveGame` is intact), and a new
     board would throw that run away without the question the home asks
     first (§6, §11). Then the steps lead back onto that run, paused. */
  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      if (canResume) resumeRun();
      else startNewRun();
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
        <div className="sn-figure" role="img" aria-label={current.alt}>
          <SnakeBoard {...current.figure} />
        </div>
        <h2 className="tutorial-title">{current.title}</h2>
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
