/**
 * Quick Rules (docs/PEG_SOLITAIRE_RULES.md §12): three steps, one sentence
 * each, every one led by a picture drawn with the board's own parts
 * (components/BoardParts.tsx):
 * 1. a jump — peg, peg, empty becoming empty, empty, peg;
 * 2. the lines — English's four directions beside Triangle's six;
 * 3. the goal — the English board with its last peg in the ringed hole.
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game (or
 * resuming the one waiting), and hardware Back marks it seen on the way out
 * (state/GameContext.tsx). There is no "Learn More": this game has no guide
 * page (ui/landing.ts), so `gameLandingUrl` answers null.
 */
import { useState, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { ENGLISH, ENGLISH_CENTER } from '../../game';
import { usePegSolitaire } from '../../state/GameContext';
import type { PlateShape } from '../components/BoardParts';
import { PegFigure, type FigureArrow, type FigureHole } from '../components/PegFigure';
import { layoutOf, type Point } from '../layout';

const point = (x: number, y: number): Point => ({ x, y });

/** Step 1: a jump, before and after. */
function JumpFigure() {
  const y = 1.15;
  const before = [0.6, 1.6, 2.6];
  const after = [4.8, 5.8, 6.8];
  const holes: FigureHole[] = [
    { ...point(before[0]!, y), peg: true },
    { ...point(before[1]!, y), peg: true },
    { ...point(before[2]!, y) },
    { ...point(after[0]!, y) },
    { ...point(after[1]!, y) },
    { ...point(after[2]!, y), peg: true },
  ];
  const arrows: FigureArrow[] = [
    // The jump itself, arcing over the peg it removes.
    {
      from: point(before[0]!, y - 0.5),
      via: point(before[1]!, -0.15),
      to: point(before[2]!, y - 0.5),
    },
    // And what the board looks like afterwards.
    { from: point(3.3, y), to: point(4.1, y) },
  ];
  return (
    <PegFigure
      width={7.4}
      height={1.7}
      pitch={34}
      holes={holes}
      arrows={arrows}
      plates={[
        { points: [point(before[0]!, y), point(before[2]!, y)], closed: false },
        { points: [point(after[0]!, y), point(after[2]!, y)], closed: false },
      ]}
    />
  );
}

/** A peg with its neighbours, and an arrow to each hole it could land in. */
function cluster(center: Point, steps: readonly Point[]) {
  const holes: FigureHole[] = [{ ...center, peg: true }];
  const arrows: FigureArrow[] = [];
  const plates: PlateShape[] = [];
  for (const step of steps) {
    const near = point(center.x + step.x, center.y + step.y);
    const far = point(center.x + 2 * step.x, center.y + 2 * step.y);
    holes.push({ ...near, peg: true }, { ...far, dot: true });
    arrows.push({
      from: point(center.x + 0.36 * step.x, center.y + 0.36 * step.y),
      to: point(center.x + 1.72 * step.x, center.y + 1.72 * step.y),
    });
  }
  // One bar per line through the peg: the lines are what the plate shows.
  for (let i = 0; i < steps.length / 2; i++) {
    const step = steps[i]!;
    plates.push({
      points: [
        point(center.x - 2 * step.x, center.y - 2 * step.y),
        point(center.x + 2 * step.x, center.y + 2 * step.y),
      ],
      closed: false,
    });
  }
  return { holes, arrows, plates };
}

const ROW = Math.sqrt(3) / 2;
/** Up and right first, then their opposites, so the first half names each line once. */
const CROSS_STEPS = [point(0, -1), point(1, 0), point(0, 1), point(-1, 0)];
const TRIANGLE_STEPS = [
  point(1, 0),
  point(0.5, ROW),
  point(-0.5, ROW),
  point(-1, 0),
  point(-0.5, -ROW),
  point(0.5, -ROW),
];

/** Step 2: English's four directions beside Triangle's six. */
function LinesFigure() {
  const cross = cluster(point(2.5, 2.5), CROSS_STEPS);
  const triangle = cluster(point(8.6, 2.5), TRIANGLE_STEPS);
  return (
    <PegFigure
      width={11.1}
      height={5}
      pitch={24}
      holes={[...cross.holes, ...triangle.holes]}
      arrows={[...cross.arrows, ...triangle.arrows]}
      plates={[...cross.plates, ...triangle.plates]}
    />
  );
}

/** Step 3: the English board, cleared to its last peg in the ringed hole. */
function GoalFigure() {
  const layout = layoutOf(ENGLISH);
  const holes: FigureHole[] = layout.centers.map((center, index) => ({
    ...center,
    peg: index === ENGLISH_CENTER,
    ring: index === ENGLISH_CENTER,
  }));
  return (
    <PegFigure
      width={layout.width}
      height={layout.height}
      pitch={24}
      holes={holes}
      plates={[{ points: layout.outline, closed: true }]}
    />
  );
}

export function PegSolitaireTutorialScreen() {
  const {
    tutorialCompleted,
    completeTutorial,
    canResume,
    resumeGame,
    startBoard,
    preferredBoard,
    goHome,
  } = usePegSolitaire();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('peg-solitaire', locale);
  const [step, setStep] = useState(0);

  const steps: { title: string; body: string; figure: ReactNode }[] = [
    {
      title: t('pegSolitaireStep1Title'),
      body: t('pegSolitaireStep1Body'),
      figure: <JumpFigure />,
    },
    {
      title: t('pegSolitaireStep2Title'),
      body: t('pegSolitaireStep2Body'),
      figure: <LinesFigure />,
    },
    {
      title: t('pegSolitaireStep3Title'),
      body: t('pegSolitaireStep3Body'),
      figure: <GoalFigure />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Straight into play (§12) — onto the game already waiting, if one is:
      // the flag and the save are separate records, and a lost flag write
      // must not cost the player the game they left. Otherwise a game on the
      // board chosen last, English to begin with.
      if (canResume) resumeGame();
      else startBoard(preferredBoard);
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
        <div className="tutorial-example">{current.figure}</div>
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
