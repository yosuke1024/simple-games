/**
 * Quick Rules (docs/BRICK_BREAKER_RULES.md §11): three steps, one sentence
 * each, shown with a figure rather than explained in prose.
 *
 * There is no "Learn More" link yet: this game has no landing page, and a
 * link that 404s is worse than no link (ui/landing.ts). Add the button back
 * the day the guide exists on the landing site.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { useBrickBreaker } from '../../state/GameContext';

/** The paddle sends the ball straight from the middle, steep from the edge (§3). */
function AngleFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="bb-figure" viewBox="0 0 160 90" role="presentation">
        <g stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" fill="none">
          <path d="M52 62 L52 18" strokeDasharray="1 6" />
          <path d="M108 62 L138 22" strokeDasharray="1 6" />
        </g>
        <circle cx="52" cy="62" r="5" fill="var(--ink)" />
        <circle cx="108" cy="62" r="5" fill="var(--ink)" />
        <rect x="34" y="72" width="36" height="8" rx="4" fill="var(--ink)" />
        <rect x="96" y="72" width="36" height="8" rx="4" fill="var(--ink)" />
      </svg>
    </div>
  );
}

/** A hollow brick releases a ball; only losing the last ball costs a life (§5). */
function BallBrickFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="bb-figure" viewBox="0 0 160 90" role="presentation">
        <rect x="20" y="16" width="34" height="18" rx="3" fill="var(--accent)" />
        <rect
          x="63"
          y="16"
          width="34"
          height="18"
          rx="3"
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <rect x="106" y="16" width="34" height="18" rx="3" fill="var(--accent)" />
        <circle cx="80" cy="56" r="5" fill="var(--ink)" />
        <circle cx="98" cy="66" r="5" fill="var(--ink)" />
        <path d="M80 40 L80 48" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** The wall creeps toward the line; it must never reach it (§6). */
function DescentFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="bb-figure" viewBox="0 0 160 90" role="presentation">
        <g fill="var(--accent)">
          <rect x="24" y="10" width="34" height="16" rx="3" />
          <rect x="63" y="10" width="34" height="16" rx="3" />
          <rect x="102" y="10" width="34" height="16" rx="3" />
          <rect x="43" y="30" width="34" height="16" rx="3" />
          <rect x="82" y="30" width="34" height="16" rx="3" />
        </g>
        <path
          d="M80 52 L80 60 M76 57 L80 61 L84 57"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M16 72 L144 72"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function BrickTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useBrickBreaker();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('bbStep1Title'), body: t('bbStep1Body'), example: <AngleFigure /> },
    { title: t('bbStep2Title'), body: t('bbStep2Body'), example: <BallBrickFigure /> },
    { title: t('bbStep3Title'), body: t('bbStep3Body'), example: <DescentFigure /> },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      startLevel(progress.highestUnlocked);
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
