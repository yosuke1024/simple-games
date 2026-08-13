/**
 * Quick Rules (docs/plans/2026-08-08-mahjong-bubble-ludo.md §Bubble Pop):
 * three steps, one sentence each, shown with a figure rather than explained
 * in prose. The long-form rules would live on the game's landing page behind
 * "Learn More", which quietly does nothing until that guide is published
 * (src/ui/landing.ts) — Bubble Pop's is not yet, so no such link renders.
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { LEVEL_COUNT } from '../../game/levels';
import { useBubblePop } from '../../state/GameContext';

/** Drag from the launcher; the dashed guide always shows the true landing spot (§8). */
function AimFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="bu-figure" viewBox="0 0 160 90" role="presentation">
        <path
          d="M80 82 L34 20"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeDasharray="3 5"
          strokeLinecap="round"
          fill="none"
        />
        <circle cx="34" cy="20" r="9" fill="var(--accent)" opacity="0.3" />
        <circle cx="80" cy="82" r="9" fill="var(--ink)" />
        <polygon points="80,74 86,86 74,86" fill="var(--surface)" />
      </svg>
    </div>
  );
}

/** Three of the same mark, connected, pop; anything left floating falls too (§2). */
function MatchFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="bu-figure" viewBox="0 0 160 90" role="presentation">
        <circle
          cx="50"
          cy="30"
          r="16"
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle
          cx="82"
          cy="30"
          r="16"
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle
          cx="66"
          cy="58"
          r="16"
          fill="var(--accent-soft)"
          stroke="var(--accent)"
          strokeWidth="2"
        />
        <circle cx="118" cy="30" r="14" fill="var(--ink)" opacity="0.18" />
        <path
          d="M118 44 L118 62 M112 55 L118 63 L124 55"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </div>
  );
}

/** The ceiling creeps toward the dotted loss line; it must never reach it (§3). */
function DescentFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="bu-figure" viewBox="0 0 160 90" role="presentation">
        <g fill="var(--accent)">
          <circle cx="34" cy="20" r="14" />
          <circle cx="66" cy="20" r="14" />
          <circle cx="98" cy="20" r="14" />
          <circle cx="50" cy="42" r="14" />
          <circle cx="82" cy="42" r="14" />
        </g>
        <path
          d="M80 62 L80 70 M76 66 L80 71 L84 66"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M16 80 L144 80"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeDasharray="5 5"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function BubbleTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useBubblePop();
  const { t } = useSettings();
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('bubbleStep1Title'), body: t('bubbleStep1Body'), example: <AimFigure /> },
    { title: t('bubbleStep2Title'), body: t('bubbleStep2Body'), example: <MatchFigure /> },
    { title: t('bubbleStep3Title'), body: t('bubbleStep3Body'), example: <DescentFigure /> },
  ];
  const current = steps[step] ?? steps[0]!;
  const lastStep = step === steps.length - 1;

  const finish = () => {
    if (!tutorialCompleted) {
      completeTutorial();
      // highestUnlocked can be LEVEL_COUNT+1 once fully cleared (see
      // statsLogic.ts); this always starts a real, playable level.
      startLevel(Math.min(progress.highestUnlocked, LEVEL_COUNT));
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
