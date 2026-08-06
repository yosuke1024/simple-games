/**
 * Quick Rules (docs/SNAKE_RULES.md §11): three steps, one sentence each, shown
 * with a figure rather than explained in prose. Every figure is a real board
 * in a position the engine would accept, drawn the way the canvas draws it —
 * a rounded chain with a denser head.
 *
 * The long-form rules live on the game's landing page behind "Learn More",
 * which is offered only once that page exists (src/ui/landing.ts) and quietly
 * does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState, type ReactNode } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useSnake } from '../../state/GameContext';

/** The figures' own grid: eight cells by five, at 20px each. */
const FIG_CELL = 20;
const centre = (index: number) => index * FIG_CELL + FIG_CELL / 2;

function Figure({ children }: { children: ReactNode }) {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="sn-figure" viewBox="0 0 160 100" role="presentation">
        {/* The four walls, the same frame in all three steps (§1). */}
        <rect
          x="1"
          y="1"
          width="158"
          height="98"
          rx="8"
          fill="none"
          stroke="var(--line)"
          strokeWidth="2"
        />
        {children}
      </svg>
    </div>
  );
}

/** A body running left to right along one row, head at `headX`. */
function Snake({ tailX, headX, row }: { tailX: number; headX: number; row: number }) {
  const y = centre(row);
  return (
    <>
      <path
        d={`M ${centre(tailX)} ${y} H ${centre(headX)}`}
        stroke="var(--accent)"
        strokeOpacity="0.72"
        strokeWidth="14"
        strokeLinecap="round"
        fill="none"
      />
      <rect x={centre(headX) - 7} y={y - 7} width="14" height="14" rx="5" fill="var(--accent)" />
    </>
  );
}

/** A swipe turns the snake; it never stops and never starts (§3). */
function TurnFigure() {
  return (
    <Figure>
      <Snake tailX={1} headX={3} row={3} />
      <path
        d={`M ${centre(3)} 52 L ${centre(3)} 26`}
        stroke="var(--ink-soft)"
        strokeWidth="2"
        strokeDasharray="1 5"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d={`M ${centre(3) - 5} 32 L ${centre(3)} 25 L ${centre(3) + 5} 32`}
        stroke="var(--ink-soft)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </Figure>
  );
}

/** One meal ahead: it adds a segment and a little speed (§4, §5). */
function FoodFigure() {
  return (
    <Figure>
      <Snake tailX={1} headX={3} row={2} />
      <circle cx={centre(5)} cy={centre(2)} r="6" fill="var(--ink)" />
    </Figure>
  );
}

/** The head against the right wall — one more step and the run is over (§2). */
function WallFigure() {
  return (
    <Figure>
      <Snake tailX={4} headX={7} row={2} />
    </Figure>
  );
}

export function SnakeTutorialScreen() {
  const { tutorialCompleted, completeTutorial, beginAttempt, goHome } = useSnake();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('snake', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('snakeStep1Title'), body: t('snakeStep1Body'), example: <TurnFigure /> },
    { title: t('snakeStep2Title'), body: t('snakeStep2Body'), example: <FoodFigure /> },
    { title: t('snakeStep3Title'), body: t('snakeStep3Body'), example: <WallFigure /> },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      beginAttempt();
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

      {/* Snake's guide is not written yet, so this never renders today. The
          path stays because the release that publishes the guide should need
          nothing here but the id landing in PUBLISHED_GAME_IDS. */}
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
