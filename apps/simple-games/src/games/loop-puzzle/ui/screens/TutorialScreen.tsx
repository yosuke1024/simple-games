/**
 * Quick Rules (docs/LOOP_PUZZLE_RULES.md §11): three steps, one sentence
 * each, shown with a figure rather than explained in prose. The first pass
 * ends by starting a board at once — the difficulty in `lp.prefs`, Easy on a
 * fresh install — so finishing the rules is one tap from playing. There is no
 * "Learn More": the game's guide page is not published while it is in early
 * release (ui/landing.ts).
 *
 * Two things here are the shell's contract rather than this game's taste
 * (src/test/tutorialBackWiring.test.tsx, issue #142): the heading is the
 * shared `howToPlay` string, and the close button exists only once the
 * tutorial has been completed — the first pass ends by starting a game, and
 * hardware Back marks it seen on the way out (state/GameContext.tsx).
 *
 * "The first pass" is read from `lp.flags`, and a lost flags record brings it
 * back over a player who may have a board suspended — of any difficulty, since
 * `lp.prefs` may be lost with it. That board is resumed rather than replaced
 * by a new one at the remembered difficulty without a word (§11, §12).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { WebBetaNotice } from '@/ui/components/WebBetaNotice';
import { useLoopPuzzle } from '../../state/GameContext';

/** The figures' lattice: 3×3 cells, a 24-unit pitch, an 8-unit margin. */
const SIZE = 3;
const PITCH = 24;
const MARGIN = 8;
const EXTENT = 2 * MARGIN + SIZE * PITCH;

/**
 * The figures' loop: the outline of five cells (row-major, 3×3) — one region
 * with no hole, so its outline is one closed loop, the way every board's
 * answer is made (§8).
 */
const REGION = new Set([0, 1, 4, 5, 7]);
const inRegion = (r: number, c: number): boolean =>
  r >= 0 && r < SIZE && c >= 0 && c < SIZE && REGION.has(r * SIZE + c);

/** The sides of the outline, as segments between dot coordinates [r1, c1, r2, c2]. */
function outline(): [number, number, number, number][] {
  const segments: [number, number, number, number][] = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!inRegion(r, c)) continue;
      if (!inRegion(r - 1, c)) segments.push([r, c, r, c + 1]);
      if (!inRegion(r + 1, c)) segments.push([r + 1, c, r + 1, c + 1]);
      if (!inRegion(r, c - 1)) segments.push([r, c, r + 1, c]);
      if (!inRegion(r, c + 1)) segments.push([r, c + 1, r + 1, c + 1]);
    }
  }
  return segments;
}

/** How many of a cell's sides the outline uses — the number that cell would show (§2). */
function sidesOnLoop(r: number, c: number): number {
  const self = inRegion(r, c);
  return [
    [r - 1, c],
    [r + 1, c],
    [r, c - 1],
    [r, c + 1],
  ].filter(([nr, nc]) => inRegion(nr!, nc!) !== self).length;
}

const at = (index: number): number => MARGIN + index * PITCH;

/**
 * A 3×3 figure: the dots, the loop, and (step 2) the numbers of five cells,
 * one of them — the 3 in the corner — tinted to show which sides it counts.
 * Decorative: the sentence beside it carries the meaning.
 */
function LoopFigure({ numbers }: { numbers: boolean }) {
  const shown = [0, 2, 4, 6, 8];
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="lp-figure" viewBox={`0 0 ${EXTENT} ${EXTENT}`} focusable="false">
        {numbers ? (
          <rect
            className="lp-fig-focus"
            x={at(0) + 3}
            y={at(0) + 3}
            width={PITCH - 6}
            height={PITCH - 6}
            rx={3}
          />
        ) : null}
        {outline().map(([r1, c1, r2, c2]) => (
          <line
            key={`${r1}-${c1}-${r2}-${c2}`}
            className="lp-fig-line"
            x1={at(c1)}
            y1={at(r1)}
            x2={at(c2)}
            y2={at(r2)}
          />
        ))}
        {Array.from({ length: (SIZE + 1) * (SIZE + 1) }, (_, index) => (
          <circle
            key={index}
            className="lp-fig-dot"
            cx={at(index % (SIZE + 1))}
            cy={at(Math.floor(index / (SIZE + 1)))}
            r={2.4}
          />
        ))}
        {numbers
          ? shown.map((cell) => {
              const r = Math.floor(cell / SIZE);
              const c = cell % SIZE;
              return (
                <text
                  key={cell}
                  className="lp-fig-num"
                  x={at(c) + PITCH / 2}
                  y={at(r) + PITCH / 2}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {String(sidesOnLoop(r, c))}
                </text>
              );
            })
          : null}
      </svg>
    </div>
  );
}

/** One edge in its three states, in tap order: empty → line → × → (empty again). */
function TapFigure() {
  const panel = (x: number, state: 'empty' | 'line' | 'cross') => (
    <g key={x}>
      {state === 'line' ? (
        <line className="lp-fig-line" x1={x + 6} y1={20} x2={x + 38} y2={20} />
      ) : null}
      {state === 'cross' ? (
        <path
          className="lp-fig-cross"
          d={`M${x + 18} 16 ${x + 26} 24 M${x + 26} 16 ${x + 18} 24`}
        />
      ) : null}
      <circle className="lp-fig-dot" cx={x + 6} cy={20} r={2.4} />
      <circle className="lp-fig-dot" cx={x + 38} cy={20} r={2.4} />
    </g>
  );
  const arrow = (x: number) => (
    <path
      key={`a${x}`}
      className="lp-fig-arrow"
      d={`M${x} 20 H${x + 14} M${x + 9} 15 ${x + 14} 20 ${x + 9} 25`}
    />
  );
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="lp-figure lp-figure-wide" viewBox="0 0 176 52" focusable="false">
        {panel(0, 'empty')}
        {arrow(48)}
        {panel(66, 'line')}
        {arrow(114)}
        {panel(132, 'cross')}
        {/* …and the next tap clears it again. */}
        <path className="lp-fig-arrow" d="M154 30 C154 48 22 48 22 30 M17 35 22 30 27 35" />
      </svg>
    </div>
  );
}

export function LoopPuzzleTutorialScreen() {
  const {
    tutorialCompleted,
    completeTutorial,
    startDifficulty,
    canResume,
    resumeGame,
    goHome,
    prefs,
  } = useLoopPuzzle();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    {
      title: t('loopPuzzleStep1Title'),
      body: t('loopPuzzleStep1Body'),
      example: <LoopFigure numbers={false} />,
    },
    {
      title: t('loopPuzzleStep2Title'),
      body: t('loopPuzzleStep2Body'),
      example: <LoopFigure numbers />,
    },
    {
      title: t('loopPuzzleStep3Title'),
      body: t('loopPuzzleStep3Body'),
      example: <TapFigure />,
    },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // Straight into a board (§11): the one waiting, if any — never replaced
      // silently — else the difficulty last chosen, Easy at first.
      if (canResume('difficulty')) resumeGame('difficulty');
      else startDifficulty(prefs.difficulty);
    } else {
      goHome();
    }
  };

  return (
    <div className="screen tutorial-screen lp-tutorial">
      <header className="screen-header">
        <h1>{t('howToPlay')}</h1>
        {tutorialCompleted ? (
          <button type="button" className="icon-btn" aria-label={t('close')} onClick={goHome}>
            <IconClose />
          </button>
        ) : null}
      </header>

      {/* The early-release note (docs/WEB_VERSION.md「保存データ」). A first
          visit opens here rather than on the home, and the last step's button
          writes the first save, so the note is read before any step — and it
          is on every step, in one place, so the steps keep their layout.
          Nothing on the app, or once the title is released. */}
      <WebBetaNotice gameId="loop-puzzle" />

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
