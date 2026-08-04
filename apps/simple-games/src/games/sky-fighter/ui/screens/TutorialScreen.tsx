/**
 * Quick Rules (docs/SKY_FIGHTER_RULES.md §11): three steps, one sentence
 * each, shown with a figure rather than explained in prose.
 * The long-form rules live on the game's landing page behind "Learn More",
 * which quietly does nothing offline (docs/OFFLINE_POLICY.md).
 */
import { useState } from 'react';
import { useSettings } from '@/state/SettingsContext';
import { IconClose } from '@/ui/components/icons';
import { gameLandingUrl } from '@/ui/landing';
import { openExternal } from '@/ui/openExternal';
import { useSkyFighter } from '../../state/GameContext';

/** The player slides; the shots go where the craft goes (§3). */
function AimFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="sf-figure" viewBox="0 0 160 90" role="presentation">
        <g fill="var(--accent)">
          <circle cx="52" cy="26" r="2.5" />
          <circle cx="52" cy="40" r="2.5" />
          <circle cx="52" cy="54" r="2.5" />
        </g>
        <path
          d="M44 70 L36 62 M44 70 L36 78 M60 70 L68 62 M60 70 L68 78"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M52 62 L57 76 L47 76 Z"
          fill="var(--ink)"
          stroke="var(--ink)"
          strokeWidth="3"
          strokeLinejoin="round"
        />
        <path
          d="M112 16 L118 28 L106 28 Z"
          fill="var(--accent)"
          stroke="var(--accent)"
          strokeWidth="3"
          strokeLinejoin="round"
          transform="rotate(180 112 22)"
        />
      </svg>
    </div>
  );
}

/** Bomber → fighters → darts; only the bomber shoots (§4, §6). */
function SplitFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="sf-figure" viewBox="0 0 160 90" role="presentation">
        <g fill="var(--accent)" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round">
          <path d="M36 22 L48 42 L24 42 Z" />
          <path d="M88 18 L96 32 L80 32 Z" />
          <path d="M112 30 L120 44 L104 44 Z" />
          <path d="M134 14 L139 24 L129 24 Z" />
        </g>
        <path
          d="M56 32 L72 26 M56 36 L98 40"
          stroke="var(--ink-soft)"
          strokeWidth="1.5"
          strokeDasharray="3 4"
          strokeLinecap="round"
          fill="none"
        />
        <path d="M36 50 L36 64" stroke="var(--accent)" strokeWidth="3.5" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/** Catch the tiny craft for a barrel; a hit costs one (§5). */
function TokenFigure() {
  return (
    <div className="tutorial-example" aria-hidden="true">
      <svg className="sf-figure" viewBox="0 0 160 90" role="presentation">
        <path
          d="M80 18 L85 30 L75 30 Z"
          fill="var(--accent)"
          stroke="var(--accent)"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <path
          d="M80 36 L80 48 M76 44 L80 49 L84 44"
          stroke="var(--ink-soft)"
          strokeWidth="2"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M80 56 L88 74 L72 74 Z"
          fill="var(--ink)"
          stroke="var(--ink)"
          strokeWidth="3.5"
          strokeLinejoin="round"
        />
        <g fill="var(--accent)">
          <circle cx="72" cy="12" r="2" />
          <circle cx="88" cy="12" r="2" />
        </g>
      </svg>
    </div>
  );
}

export function SkyTutorialScreen() {
  const { tutorialCompleted, completeTutorial, startLevel, progress, goHome } = useSkyFighter();
  const { t, locale } = useSettings();
  const learnMoreUrl = gameLandingUrl('sky-fighter', locale);
  const [step, setStep] = useState(0);

  const steps = [
    { title: t('sfStep1Title'), body: t('sfStep1Body'), example: <AimFigure /> },
    { title: t('sfStep2Title'), body: t('sfStep2Body'), example: <SplitFigure /> },
    { title: t('sfStep3Title'), body: t('sfStep3Body'), example: <TokenFigure /> },
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
